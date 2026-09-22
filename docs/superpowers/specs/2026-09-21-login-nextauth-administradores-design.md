# Spec: Login con NextAuth.js y gestión de administradores

## Contexto

`AGENTS.md` define NextAuth.js como la autenticación de `/admin`, pero hasta ahora el proyecto no
tiene ninguna pieza de autenticación: `/admin/enrolar/[userId]` y toda la API de `/api/usuarios/*`
están completamente abiertas. Este spec cubre la primera implementación real de login y el módulo
para gestionar las cuentas que pueden usarlo.

El proyecto corre sobre **Next.js 16.3.5**, que en esta versión renombró `middleware.ts` a
`proxy.ts` (mismo comportamiento, mismo runtime Node.js, distinto nombre de archivo/export —
confirmado en `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
Cualquier código que siga el patrón clásico de NextAuth con `middleware.ts` no se ejecutaría en
este proyecto.

## Decisiones

- **Alcance:** login de staff (`Admin`) + CRUD de esas cuentas (alta, inactivar/reactivar, resetear
  contraseña) + protección de las rutas de `/admin/*` y de la API de practicantes que hoy están
  abiertas. Fuera de alcance: reseteo de contraseña por correo (no hay SMTP configurado), roles
  múltiples (ver más abajo), importación de Excel, reportes.
- **Un solo rol (`Admin`), sin columna `role`.** No hay ninguna decisión en el sistema que dependa
  hoy de un rol distinto a "admin", así que agregar la columna sería peso muerto (ver principio
  YAGNI de `AGENTS.md`). Si en el futuro se necesita un segundo rol, es una migración de una línea
  (`role String @default("admin")`).
- **Modelo de cuentas separado del `User` (practicante).** Un practicante nunca hace login (se
  reconoce por rostro/QR); mezclar ambos conceptos en la misma tabla acoplaría dos ciclos de vida
  distintos (alta masiva por Excel vs. alta manual de staff).
- **NextAuth v5 / Auth.js (`5.0.0-beta.32`)**, no v4. Next.js recomienda esta versión para App
  Router en su propia guía de autenticación; su API (`auth()`, Server Actions para `signIn`) encaja
  con el resto del proyecto (Server Components, Route Handlers). Es beta pero ampliamente usada en
  producción; v4 exigiría el patrón más manual de `getServerSession`.
- **Sesión JWT, no database session.** El `CredentialsProvider` de Auth.js requiere JWT si no se
  usa un adapter de base de datos completo; para el tamaño de este sistema (unos pocos admins) no
  se justifica la complejidad de sesiones en BD. El payload del JWT solo lleva `id`, `email`,
  `nombre` (nunca el hash de contraseña).
- **Hashing con `bcryptjs`** (implementación pura en JS), no el paquete nativo `bcrypt`. Evita
  depender de compilación nativa específica de la plataforma del servidor final de la fundación,
  con costo de performance irrelevante a esta escala (login ocasional de pocos admins).
- **Protección de rutas vía `proxy.ts`** en la raíz del proyecto (no `middleware.ts`), usando
  `callbacks.authorized` de Auth.js para centralizar el redirect a `/login`. Protegido:
  `/admin/:path*`, `/api/usuarios/:path*`, `/api/administradores/:path*`. Explícitamente público:
  `/marcacion`, `/api/marcacion`, `/login`, estáticos — el kiosko no debe requerir sesión bajo
  ninguna circunstancia (regla explícita de `AGENTS.md`: "sin ningún control de administración
  visible").
- **Alta de contraseñas es manual, no autoservicio por correo.** Quien crea una cuenta define la
  contraseña inicial; un admin puede resetear la contraseña de otra cuenta (o la propia) desde el
  CRUD. No hay flujo de "olvidé mi contraseña" hasta que se defina infraestructura de correo.
- **Salvaguardas del CRUD:** un admin no puede inactivarse a sí mismo; el sistema rechaza inactivar
  al último admin activo (evitaría bloquear el acceso a todo el sistema).
- **Test runner:** Vitest, siguiendo el patrón ya usado en el proyecto (`route.test.ts` junto a
  cada route handler).
- **UI con shadcn/ui + Tailwind, tema por defecto.** A partir de este spec, shadcn/ui queda como
  estándar para componentes de formulario/tabla/UI en todo el proyecto (empezando por el login y
  el CRUD de administradores). Se usa el tema neutro que trae `shadcn init` por defecto — **no**
  se cablean los tokens de marca (`navy`/`red`/`Archivo`, etc.) de la sección "Imagen de marca y
  sistema de diseño" de `AGENTS.md` todavía; eso queda para una sesión dedicada a brandear toda la
  app de una vez (incluyendo las pantallas ya existentes de enrolamiento/marcación, que tampoco
  los tienen hoy). Este spec no toca `globals.css` más allá de lo que `shadcn init` agrega.

## Arquitectura y flujo de datos

```
Request → proxy.ts (Auth.js: callbacks.authorized)
            │
            ├─ /marcacion, /api/marcacion, /login, estáticos → pasa sin chequeo
            │
            └─ /admin/*, /api/usuarios/*, /api/administradores/* → ¿hay sesión JWT válida?
                    │no                              │sí
                    ▼                                ▼
              redirect /login                   continúa a la ruta

/login (Server Component + Server Action)
    → signIn("credentials", { email, password })
        → src/lib/server/auth.ts: CredentialsProvider.authorize()
            → prisma.admin.findUnique({ where: { email } })
            → chequea activo === true
            → bcryptjs.compare(password, passwordHash)
        → JWT { id, email, nombre } en cookie httpOnly
    → redirect /admin/administradores (o página protegida original)

/admin/administradores (Server Component, protegido por proxy.ts)
    → lista Admin (email, nombre, estado)
    → acciones: crear, inactivar/reactivar, resetear contraseña
    → API: src/app/api/administradores/route.ts (GET, POST)
            src/app/api/administradores/[adminId]/route.ts (PATCH)
```

## Componentes y contratos

### 0. Setup de shadcn/ui

`npx shadcn@latest init` (tema por defecto, no personalizado) + `npx shadcn@latest add button
input label card table dialog badge` (los componentes que usan el login y el CRUD de
administradores). Esto crea `components.json` y `src/components/ui/*`.

### 1. Esquema Prisma (`prisma/schema.prisma`)

```prisma
model Admin {
  id           String   @id @default(uuid())
  email        String   @unique
  nombre       String
  passwordHash String
  activo       Boolean  @default(true)
  creadoEn     DateTime @default(now())
}
```

Migración con `prisma migrate dev`. Se agrega un script de seed (`prisma/seed.ts`) que crea el
primer `Admin` a partir de variables de entorno (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
`SEED_ADMIN_NOMBRE`), idempotente (si ya existe, no hace nada) — es el único mecanismo para crear
la *primera* cuenta, ya que el CRUD requiere estar autenticado.

### 2. `src/lib/server/auth.ts`

Config de Auth.js: `CredentialsProvider` con `authorize(credentials)`, `session: { strategy: "jwt" }`,
`pages: { signIn: "/login" }`, `callbacks.jwt` (copia `id`/`nombre` al token en el login),
`callbacks.session` (expone `id`/`nombre` en `session.user`), `callbacks.authorized` (lógica de
proxy descrita arriba). Exporta `{ handlers, auth, signIn, signOut }`.

### 3. `src/app/api/auth/[...nextauth]/route.ts`

`export { GET, POST } from "@/lib/server/auth"`.

### 4. `proxy.ts` (raíz del proyecto)

`export { auth as proxy } from "@/lib/server/auth"` + `matcher` que cubre todo excepto estáticos
(el filtrado fino de qué rutas exigen sesión vive en `callbacks.authorized`, no en el matcher, para
tener un solo lugar con la lista de rutas protegidas).

### 5. `src/app/login/page.tsx` + Server Action

Formulario email/contraseña armado con componentes `shadcn/ui` (`Card`, `Input`, `Label`,
`Button`, tema por defecto). La Server Action llama `signIn("credentials", ...)`, captura
`CredentialsSignin` y devuelve `"Correo o contraseña incorrectos"` (español llano, sin excepción
cruda — mismo patrón que ya usa `src/app/api/usuarios/[userId]/enrolar/route.ts`).

### 6. Módulo de administradores

- `src/app/admin/administradores/page.tsx`: tabla (`Table` de shadcn/ui: email, nombre, estado,
  fecha de alta) + acción textual (`Inactivar` / `Reactivar`, `Button variant="destructive"`
  donde aplique) + `Dialog` con formulario de alta + acción de resetear contraseña. Tema por
  defecto de shadcn — sin las píldoras/colores de marca de `AGENTS.md` todavía (ver decisión de
  UI más arriba).
- `src/app/api/administradores/route.ts`:
  - `GET`: lista todos los admins (nunca expone `passwordHash` — DTO explícito).
  - `POST`: crea admin (`email`, `nombre`, `password` inicial) → hashea con `bcryptjs`, valida
    email único (mensaje en español si duplicado, no el error crudo de Prisma).
- `src/app/api/administradores/[adminId]/route.ts`:
  - `PATCH`: soporta `{ activo }` (inactivar/reactivar, con las dos salvaguardas descritas arriba)
    y `{ password }` (resetear contraseña, re-hashea).
- Todas las rutas requieren sesión (via `proxy.ts`); además cada handler vuelve a llamar `auth()`
  para obtener el admin actual y aplicar las salvaguardas de auto-inactivación / último admin.

## Manejo de errores

Mismo estándar que el resto del proyecto: mensajes en español llano, sin stack traces ni códigos
de excepción crudos, status HTTP apropiados (`401` sin sesión, `403` acción no permitida por
salvaguarda, `409` email duplicado, `404` admin inexistente).

## Testing

- `src/lib/server/auth.test.ts`: `authorize()` con credenciales válidas, contraseña incorrecta,
  cuenta inactiva, email inexistente.
- `src/app/api/administradores/route.test.ts` y `[adminId]/route.test.ts`: alta, email duplicado,
  inactivar, reactivar, las dos salvaguardas, resetear contraseña.
- No se agrega Playwright para el login en este spec (el E2E existente cubre el flujo de
  marcación); se puede sumar después si se prioriza.

## Fuera de alcance (explícito)

- Reseteo de contraseña por correo.
- Roles múltiples / permisos granulares.
- CRUD completo de practicantes, importación de Excel, reportes (ya trackeados como pendientes en
  `AGENTS.md`).
