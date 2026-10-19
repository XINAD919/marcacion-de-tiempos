# Avisos y envío masivo de carnets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada acción de la administración confirme su resultado con un aviso, y que coordinación envíe el carnet virtual a todos los pendientes respetando un tope por hora, con progreso, pausa y reanudación.

**Architecture:** Sonner (shadcn/ui) con un helper puro que traduce el `{ ok, message, errors }` de las acciones a un aviso. El envío masivo se guarda en dos tablas (`envio_carnets`, `envio_carnet_item`). Un servicio Prisma procesa un item por llamada, con reglas de ritmo puras y reclamo condicional. Un trabajador en el mismo proceso de Next.js, arrancado por `instrumentation.ts`, lo llama en bucle.

**Tech Stack:** Next.js App Router (leer `node_modules/next/dist/docs/` sobre `instrumentation` y server actions antes de escribir), TypeScript, Prisma + SQL Server, nodemailer, shadcn/ui + Sonner, Vitest contra la BD de Docker, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-envio-masivo-carnets-design.md`

## Global Constraints

- Pendiente = `activo = true`, `email` no vacío y (`carnet_virtual` no existe o `enviado_en IS NULL`).
- `carnets_por_hora` por defecto **100**, mínimo 1. Intervalo = `3600 / carnets_por_hora` s. Tope: carnets con `enviado_en` en los últimos 60 min (incluye los individuales).
- Un solo envío masivo `en-curso` o `pausado` a la vez. Instantánea de pendientes al iniciar.
- Estados de item: `pendiente` | `enviando` | `enviado` | `omitido` | `error`. Estados de envío: `en-curso` | `pausado` | `terminado`.
- Error global (pausa al primero): `SmtpNotConfiguredError`, `EAUTH`, `ECONNECTION`, `ETIMEDOUT`, `ESOCKET`, `EDNS`, `ETLS`. Cualquier otro error es del destinatario.
- Item en `enviando` por más de 10 min al arrancar → `error` con motivo exacto «No sabemos si el correo llegó: el servidor se reinició mientras se enviaba».
- Avisos: éxito 4 s, error 8 s con botón de cerrar. Con errores de campo, el aviso dice «Revisa los campos marcados». Error sin mensaje: «No pudimos completar la acción. Inténtalo de nuevo.». No hay avisos en el kiosko ni en el login. No hay modo oscuro: quitar `next-themes` del componente generado.
- Solo tokens de marca (`brand-green` éxito, `brand-red` + texto en error, `brand-amber` aviso). Interfaz en español llano, `tabular-nums` en cifras.
- Toda server action verifica `auth()`. Nunca texto de excepción en pantalla.
- Commits en español, Conventional Commits, **sin** `Co-Authored-By`.
- **Línea base** (registrada al empezar): `pnpm test` 361/361, `pnpm exec tsc --noEmit` limpio, `pnpm lint` 0 errores y 1 aviso previo (`reportes/cumplimiento/page.tsx`).
- **Toda tarea que crea o cambia una pantalla la carga de verdad**: una prueba Playwright que la abre y comprueba un elemento clave. Un error de importación entre servidor y cliente no lo detecta ni tsc ni lint.

## Review Focus

1. **Dos procesos o un doble arranque del trabajador** (HMR en dev llama `register()` otra vez): no se debe enviar dos veces el mismo item. Prueba en Task 4 (dos `procesarSiguiente` en paralelo) y Task 5 (guarda de arranque único).
2. **El SMTP cae a mitad del lote**: debe pausar al primer error global y devolver ese item a `pendiente`, sin marcar 2.000 errores. Prueba en Task 4.
3. **Un envío individual durante el lote**: cuenta para el tope de la hora y el item del lote queda `omitido`. Prueba en Task 4.
4. **Cambiar `carnets_por_hora` a 0, a texto o a un número enorme** en Configuración: error de campo, nada se guarda. Prueba en Task 3.
5. **Reanudar justo después de pausar** no debe enviar de inmediato si el intervalo o la ventana de la hora no lo permiten. Prueba en Task 4 con `now` inyectado.

---

### Task 1: Avisos — componente, helper y Toaster

**Files:**
- Create: `src/components/ui/sonner.tsx` (con `pnpm dlx shadcn@latest add sonner`, luego quitar `next-themes` y aplicar tokens), `src/lib/client/avisos.ts`
- Modify: `src/app/admin/layout.tsx` (un único `<Toaster />`)
- Test: `src/lib/client/avisos.test.ts`

**Interfaces:**
- Produces:
```ts
export type ResultadoAccion = { ok: true } | { ok: false; message?: string; errors?: Partial<Record<string, string>> };
export interface Aviso { tipo: "exito" | "error"; texto: string }
export const AVISO_CAMPOS = "Revisa los campos marcados";
export const AVISO_GENERICO = "No pudimos completar la acción. Inténtalo de nuevo.";
export function avisoDe(result: ResultadoAccion, exito: string): Aviso; // puro
export function notificar(result: ResultadoAccion, exito: string): void; // toast.success 4000 ms | toast.error 8000 ms closeButton
```
Reglas de `avisoDe`: si `ok`, devuelve éxito con `exito`. Si hay al menos un error de campo, devuelve error con `AVISO_CAMPOS`, aunque también venga `message`. Si solo hay `message`, devuelve error con ese mensaje. Si no hay nada, error con `AVISO_GENERICO`.

- [ ] **Step 1: Pruebas que fallan** (`avisoDe`): `{ok:true}` y `"Sede guardada"` → `{tipo:"exito",texto:"Sede guardada"}`; `{ok:false,errors:{nombre:"x"},message:"y"}` → `AVISO_CAMPOS`; `{ok:false,errors:{}}` y `"m"`… → `AVISO_GENERICO`; `{ok:false,message:"Tu sesión terminó…"}` → ese texto.
- [ ] **Step 2: Correr y ver que falla** → `pnpm test src/lib/client/avisos.test.ts` FAIL.
- [ ] **Step 3: Agregar Sonner, implementar `avisos.ts` y montar `<Toaster position="bottom-right" />` en el layout de admin.** Colores con `toastOptions.classNames` y tokens (`bg-white border-navy/12 text-navy`; icono o borde izquierdo `brand-green` / `brand-red`).
- [ ] **Step 4: Correr, tsc y lint** → PASS.
- [ ] **Step 5: Commit** `feat(ui): agrega avisos de resultado con sonner`

---

### Task 2: Avisos en todas las acciones existentes

**Files (lote mecánico; cada pantalla llama a `notificar` con su texto de éxito):**

| Pantalla / archivo | Acción | Texto de éxito |
|---|---|---|
| `src/app/admin/_correcciones/dialogs.tsx` | registrar salida / entrada / corregir hora / anular / restaurar / reasignar | «Salida registrada» / «Entrada registrada» / «Hora corregida» / «Marcación anulada» / «Marcación restaurada» / «Marcación reasignada» |
| `src/app/admin/instituciones-y-sedes/catalogo-ui.tsx` (`useCatalogoForm`) + diálogos | guardar institución / sede | «Institución guardada» / «Sede guardada» |
| `src/app/admin/configuracion/config-form.tsx` | guardar reglas | «Configuración guardada» |
| `src/app/admin/configuracion/smtp-form.tsx` | guardar SMTP | «Correo de salida guardado» |
| `src/app/admin/configuracion/prueba-correo.tsx` | correo de prueba | «Correo de prueba enviado a <correo>» |
| `src/app/admin/configuracion/admins-panel.tsx` (fetch) | crear / editar / activar / inactivar administrador | «Administrador guardado» |
| `src/app/admin/usuarios/_form/usuario-form.tsx` | guardar usuario | «Usuario guardado» |
| `src/app/admin/usuarios/_form/carnet-card.tsx` | enviar carnet | «Carnet enviado a <correo>» |
| `src/app/admin/usuarios/importar/importador.tsx` (fetch) | importar | «Importación terminada: N insertados» (el resumen de tres cifras se queda) |
| `src/app/admin/enrolar/[userId]/enrolamiento.tsx` (fetch) | guardar fotos | «Rostro guardado» |

Regla: si la pantalla hoy muestra un mensaje general de éxito o error dentro de la página, el aviso lo **reemplaza**. Los errores por campo, el resumen de importación y la fecha de envío del carnet se quedan. Los flujos con `fetch` arman un `ResultadoAccion` desde la respuesta, y un error de red da `AVISO_GENERICO`.

**Interfaces:**
- Consumes: `notificar`, `ResultadoAccion` (Task 1).

- [ ] **Step 1: Prueba e2e que falla** `e2e/avisos.spec.ts`: login, crear una sede en `/admin/instituciones-y-sedes` → aparece el aviso «Sede guardada»; intentar guardar la misma sede con otras mayúsculas → aparece «Revisa los campos marcados». Limpieza de la sede en `afterAll` (patrón de `e2e/instituciones-y-sedes.spec.ts`).
- [ ] **Step 2: Correr y ver que falla** → `pnpm exec playwright test e2e/avisos.spec.ts` FAIL.
- [ ] **Step 3: Cablear cada fila de la tabla.**
- [ ] **Step 4: Correr e2e (`avisos` + `instituciones-y-sedes` + `correcciones`), suite, tsc y lint** → PASS. Si un e2e existente dependía de un mensaje dentro de la página que se reemplazó, actualizarlo al aviso.
- [ ] **Step 5: Commit** `feat(ui): confirma con avisos todas las acciones de administración`

---

### Task 3: Tope por hora en Configuración y clasificación de errores de correo

**Files:**
- Modify: `prisma/schema.prisma` (`Configuracion.carnetsPorHora Int @default(100)`), `src/lib/configRules.ts` (`ConfigValues.carnetsPorHora`, `DEFAULT_CONFIG.carnetsPorHora = 100`, `parseConfigForm` acepta entero 1–10000), `src/lib/server/config.ts`, `src/app/admin/configuracion/config-form.tsx` (nueva fila «Carnets por hora», con la ayuda «Cuántos carnets virtuales se envían como máximo por hora. Ajústalo al límite de tu proveedor de correo.»), `src/lib/server/mailer.ts`
- Create: migración `<ts>_carnets_por_hora` (generada)
- Test: `src/lib/configRules.test.ts`, `src/lib/server/mailer.test.ts` (nuevo)

**Interfaces:**
- Produces: `ConfigValues.carnetsPorHora: number`; `export function clasificarMailError(error: unknown): "global" | "destinatario"` en `mailer.ts`.

- [ ] **Step 1: Pruebas que fallan**: `parseConfigForm` con `carnetsPorHora` `"0"`, `"abc"`, `"10001"` → error de campo; `"250"` → 250. `clasificarMailError(new SmtpNotConfiguredError())` y `{code:"EAUTH"|"ECONNECTION"|"ETIMEDOUT"|"ESOCKET"|"EDNS"|"ETLS"}` → `"global"`; `{code:"EENVELOPE"}`, `{responseCode:550}` y `new Error("x")` → `"destinatario"`.
- [ ] **Step 2: Correr y ver que falla.**
- [ ] **Step 3: Migración** `pnpm exec prisma migrate dev --name carnets_por_hora` (nunca reset) **e implementación.**
- [ ] **Step 4: Prueba e2e de carga**: en `e2e/avisos.spec.ts`, agregar un caso que abre `/admin/configuracion` y ve el campo «Carnets por hora» con valor 100 (o el guardado).
- [ ] **Step 5: Suite, tsc, lint y e2e** → PASS.
- [ ] **Step 6: Commit** `feat(configuracion): agrega el tope de carnets por hora y clasifica errores de correo`

---

### Task 4: Servicio del envío masivo

**Files:**
- Modify: `prisma/schema.prisma` (modelos `EnvioCarnets`, `EnvioCarnetItem`; relaciones a `Admin` y `User`)
- Create: migración `<ts>_envio_masivo_carnets`, `src/lib/carnets/ritmo.ts`, `src/lib/server/envioCarnetsService.ts`
- Test: `src/lib/carnets/ritmo.test.ts`, `src/lib/server/envioCarnetsService.test.ts` (prefijo de cédula `990091`)

**Interfaces:**
- Consumes: `sendCarnet`, `SendCarnetResult` (`carnet.ts`), `clasificarMailError`, `describeMailError` (`mailer.ts`), `getConfig().carnetsPorHora` (Task 3).
- Produces (modelo): `EnvioCarnets { id String @id @default(uuid()), iniciadoPorId String, estado String @db.VarChar(12), motivoPausa String? @db.NVarChar(300), total Int, creadoEn DateTime @default(now()), terminadoEn DateTime? }`; `EnvioCarnetItem { id, envioId, userId, estado String @db.VarChar(10), motivoError String? @db.NVarChar(300), intentadoEn DateTime?, @@unique([envioId, userId]), @@index([envioId, estado]) }`. FK con `onDelete: NoAction, onUpdate: NoAction` donde SQL Server lo exija.
- Produces (`ritmo.ts`, puro):
```ts
export function intervaloMs(porHora: number): number; // 3_600_000 / porHora
export function esperarHasta(i: { now: Date; ultimoEnvioLote: Date | null; enviadosUltimaHora: number;
  masAntiguoUltimaHora: Date | null; porHora: number }): Date | null; // null = puede enviar ya
export function estimadoRestanteMs(pendientes: number, porHora: number): number;
```
  `esperarHasta` devuelve el mayor entre `ultimoEnvioLote + intervalo` y, si `enviadosUltimaHora >= porHora`, `masAntiguoUltimaHora + 60 min`. Devuelve `null` si ese valor es `<= now`.
- Produces (`envioCarnetsService.ts`):
```ts
export const PENDIENTE_WHERE: Prisma.UserWhereInput;
export function contarPendientes(): Promise<number>;
export function listarSinCorreo(): Promise<{ id: string; nombre: string; cedula: string }[]>; // activos sin correo
export function iniciarEnvio(adminId: string): Promise<{ ok: true; envioId: string; total: number } | { ok: false; reason: "hay-otro"; envioId: string } | { ok: false; reason: "sin-pendientes" }>;
export function pausarEnvio(envioId: string): Promise<boolean>;   // solo desde en-curso
export function reanudarEnvio(envioId: string): Promise<boolean>; // solo desde pausado; limpia motivoPausa
export interface EnvioResumen { id: string; estado: string; motivoPausa: string | null; total: number; enviados: number;
  pendientes: number; omitidos: number; errores: number; creadoEn: Date; terminadoEn: Date | null; estimadoRestanteMs: number }
export function envioActivo(): Promise<EnvioResumen | null>; // en-curso o pausado
export function getEnvio(id: string): Promise<(EnvioResumen & { erroresDetalle: { userId: string; nombre: string; email: string | null; motivo: string }[] }) | null>;
export type ResultadoPaso = "enviado" | "omitido" | "error" | "pausado" | "esperando" | "terminado" | "sin-envio";
export function procesarSiguiente(deps?: { now?: Date; enviar?: (userId: string) => Promise<SendCarnetResult> }): Promise<ResultadoPaso>;
export function recuperarAlArrancar(now?: Date): Promise<number>; // items enviando >10 min → error
```
Algoritmo de `procesarSiguiente`:
1. Si no hay envío `en-curso`, devuelve `sin-envio`.
2. Calcula `esperarHasta` con `ultimoEnvioLote` (el `intentadoEn` más reciente de un item `enviado` del lote) y la ventana de 60 min de `carnet_virtual.enviado_en`. Si no puede enviar, devuelve `esperando`.
3. Toma un item `pendiente` y lo reclama con `updateMany({ where: { id, estado: "pendiente" }, data: { estado: "enviando", intentadoEn: now } })`. Si el conteo es 0, intenta con otro. Si no queda ninguno, marca el envío `terminado` con `terminadoEn` y devuelve `terminado`.
4. Vuelve a comprobar que el usuario cumple `PENDIENTE_WHERE`. Si no, el item queda `omitido`.
5. Llama a `enviar`: `ok` → `enviado`; `ok:false` → `omitido`; si lanza un error global, el item vuelve a `pendiente` y el envío pasa a `pausado` con `motivoPausa = describeMailError(e)`; si lanza un error del destinatario, el item queda `error` con `motivoError = describeMailError(e)`.

- [ ] **Step 1: Pruebas que fallan**:
  - `ritmo`: `intervaloMs(100)` = 36 000; con `ultimoEnvioLote` hace 10 s y 100/h → espera 26 s; con 100 enviados en la hora, el más antiguo hace 59 min y el último del lote hace 1 h → espera 1 min; sin envíos → `null`; `estimadoRestanteMs(50, 100)` = 1 800 000.
  - Servicio, con `enviar` simulado que solo registra los ids:
    - `contarPendientes` excluye inactivos, sin correo y con `enviadoEn`; incluye a quien tiene `carnet_virtual` con `enviadoEn null`.
    - `iniciarEnvio` hace la instantánea y un usuario creado después no entra; un segundo `iniciarEnvio` da `hay-otro`; sin pendientes da `sin-pendientes`.
    - **Dos `procesarSiguiente` en paralelo** con `now` que permite enviar: entre los dos, `enviar` se llama **una sola vez por item**.
    - Error global (`{code:"EAUTH"}`) → envío `pausado` con motivo, item `pendiente` y `enviar` no se vuelve a llamar.
    - Error del destinatario → item `error` con motivo en español y el envío sigue `en-curso`.
    - Un usuario que recibió su carnet de forma individual antes de su turno → `omitido`, y su `enviadoEn` cuenta para la ventana.
    - Reanudar y luego `procesarSiguiente` con `now` = último envío + 10 s → `esperando`.
    - `recuperarAlArrancar` con un item `enviando` de hace 11 min → `error` con el motivo exacto; uno de hace 5 min no cambia.
    - Al acabarse los items → `terminado` y `terminadoEn`.
- [ ] **Step 2: Correr y ver que falla.**
- [ ] **Step 3: Migración** `pnpm exec prisma migrate dev --name envio_masivo_carnets` **e implementación.**
- [ ] **Step 4: Correr enfocado, suite y tsc** → PASS.
- [ ] **Step 5: Commit** `feat(carnets): agrega el servicio de envío masivo con ritmo y reanudación`

---

### Task 5: Trabajador en segundo plano

**Files:**
- Create: `src/lib/server/envioCarnetsWorker.ts`, `src/instrumentation.ts`
- Test: `src/lib/server/envioCarnetsWorker.test.ts`

**Interfaces:**
- Consumes: `procesarSiguiente`, `recuperarAlArrancar` (Task 4).
- Produces: `export function iniciarTrabajador(opts?: { tickMs?: number; paso?: () => Promise<ResultadoPaso> }): () => void` (devuelve la función para detenerlo). Una guarda en `globalThis` impide un segundo arranque en el mismo proceso. Llama a `recuperarAlArrancar()` una vez. Cada `tickMs` (por defecto 5 000) llama a `paso`, pero **nunca dos a la vez**: si el anterior sigue en curso, ese tick se salta. Los errores van a `console.error` y el bucle sigue.
- `instrumentation.ts`: `export async function register()` que solo con `process.env.NEXT_RUNTIME === "nodejs"` y `process.env.NODE_ENV !== "test"` importa dinámicamente el trabajador y lo arranca.

- [ ] **Step 1: Pruebas que fallan** (`vi.useFakeTimers`): llamar dos veces a `iniciarTrabajador` arranca un solo bucle (`paso` se llama 1 vez por tick); un `paso` lento (promesa pendiente) no se solapa con el siguiente tick; un `paso` que lanza no detiene el bucle; la función devuelta lo detiene.
- [ ] **Step 2: Correr y ver que falla.**
- [ ] **Step 3: Implementar** (leer `node_modules/next/dist/docs/` sobre `instrumentation`).
- [ ] **Step 4: Suite, tsc, lint**, y arrancar `pnpm exec next build` para confirmar que `instrumentation.ts` compila en el build → PASS.
- [ ] **Step 5: Commit** `feat(carnets): procesa el envío masivo en segundo plano`

---

### Task 6: Pantallas del envío masivo

**Files:**
- Create: `src/app/admin/usuarios/carnets/page.tsx` (progreso), `src/app/admin/usuarios/carnets/actions.ts`, `src/app/admin/usuarios/carnets/enviar-dialog.tsx`, `src/app/admin/usuarios/carnets/controles.tsx`
- Modify: `src/app/admin/usuarios/page.tsx` (botón y aviso de envío activo)

**Interfaces:**
- Consumes: Task 4 (`contarPendientes`, `listarSinCorreo`, `iniciarEnvio`, `pausarEnvio`, `reanudarEnvio`, `envioActivo`, `getEnvio`, `estimadoRestanteMs`), `notificar` (Task 1), `AutoRefresh` (`src/app/admin/reportes/auto-refresh.tsx`), `ProgressBar`, `PageHeader`, `Table`.
- Produces: server actions `iniciarEnvioAction(): Promise<ResultadoAccion & { envioId?: string }>`, `pausarEnvioAction(envioId: string)`, `reanudarEnvioAction(envioId: string)`. Todas verifican `auth()` y hacen `revalidatePath("/admin/usuarios", "layout")`.

Textos fijos:
- Botón en Usuarios (secundario): «Enviar carnets pendientes (N)». Con N = 0 queda deshabilitado con «Todos tienen su carnet». Si hay un envío activo, el botón lleva al progreso con «Ver envío de carnets».
- Diálogo: título «Enviar carnets pendientes»; texto «Se enviarán N carnets, a unos P por hora (unas H horas).». Si M > 0, agrega «M usuarios activos no tienen correo y no lo recibirán:» con la lista y un enlace a Editar de cada uno. Botón primario «Empezar envío». Al empezar, aviso «Envío de carnets iniciado» y redirección a `/admin/usuarios/carnets`.
- Progreso: título «Envío de carnets»; barra verde con `enviados / total` (siempre con el número); cifras Enviados, Pendientes, Omitidos y Con error; «Tiempo estimado restante: …»; botones «Pausar» / «Reanudar», con avisos «Envío pausado» / «Envío reanudado».
- Si `motivoPausa` existe: aviso ámbar «El envío se pausó solo: <motivo>. Revisa el correo de salida en Configuración y luego reanúdalo.» con enlace a Configuración.
- Tabla de errores: usuario, correo, motivo y enlace a Editar. Sin envíos activos ni anteriores: «No hay envíos de carnets.». Al terminar: «Envío terminado» con las cifras finales.
- La pantalla se actualiza sola cada 10 s (`AutoRefresh seconds={10}`) mientras el estado es `en-curso`.
- En Usuarios, con un envío activo, aparece un aviso en la parte superior: «Hay un envío de carnets en curso: X de Y enviados.» (o «pausado: …»), con enlace al progreso.

- [ ] **Step 1: Prueba e2e que falla** `e2e/envio-carnets.spec.ts`. Crea 2 usuarios activos con correo y sin carnet (prefijo propio). La simulación del SMTP queda a criterio del implementador; la opción recomendada es `MAIL_TRANSPORT=json` (en `mailer.ts`, solo fuera de producción, usa `jsonTransport` de nodemailer), definida en el `webServer.env` de Playwright.
  - El botón de Usuarios muestra «Enviar carnets pendientes (» → abre el diálogo → «Empezar envío» → aparece el aviso «Envío de carnets iniciado» → se carga `/admin/usuarios/carnets` con el título «Envío de carnets».
  - El servicio se drena desde la prueba (llamando a `procesarSiguiente` con `now` futuro y el `enviar` real con el transporte JSON) → tras recargar se ve «Envío terminado» y ambos usuarios tienen `enviadoEn`.
  - Limpieza de items, envío, carnets y usuarios.
- [ ] **Step 2: Correr y ver que falla.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: E2e (`envio-carnets` + `avisos`), suite, tsc y lint** → PASS.
- [ ] **Step 5: Commit** `feat(carnets): agrega el envío masivo de carnets con su progreso`

---

### Task 7: Documentación

**Files:**
- Modify: `AGENTS.md`:
  - Modelo de datos: `envio_carnets`, `envio_carnet_item` y `configuracion.carnets_por_hora`.
  - Stack › Correo: el trabajador de `instrumentation.ts` y la variable `MAIL_TRANSPORT` si se agregó.
  - Patrones de UI: los avisos (`notificar`, duraciones, cuándo no usarlos).
  - Pendientes: marcar «Envío masivo de carnets» como hecho, mantener el de confirmar el límite SMTP con IT y agregar «La app debe correr como un único proceso `next start` (el trabajador de carnets vive dentro)».

- [ ] **Step 1: Editar AGENTS.md.**
- [ ] **Step 2: Suite completa, tsc, lint y todos los e2e** (`pnpm exec playwright test`) → PASS.
- [ ] **Step 3: Commit** `docs: documenta avisos y envío masivo de carnets en AGENTS.md`
