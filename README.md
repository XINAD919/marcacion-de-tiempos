# Medición de tiempos

Aplicación web interna para que la fundación controle las horas de práctica de sus practicantes.
La marcación se hace por **reconocimiento facial** desde PCs kiosko con cámara web, con el QR del
carnet estudiantil como respaldo. Reemplaza el proceso actual en papel + Excel de Drive.

Contexto, arquitectura, modelo de datos y sistema de diseño: ver [AGENTS.md](AGENTS.md).

## Stack

- Next.js 16 (App Router) + TypeScript + React 19
- shadcn/ui + Tailwind CSS 4
- SQL Server 2022 (vía Docker en desarrollo) + Prisma 6
- NextAuth v5 (login de administradores)
- `face-api.js` + TensorFlow.js (detección en el navegador, matching en el servidor con `tfjs-node`)
- Vitest (unitarias) y Playwright (e2e)

## Requisitos previos

| Herramienta | Versión | Notas |
|---|---|---|
| Node.js | ≥ 20.12 | El seed usa `process.loadEnvFile` |
| pnpm | 10.x | Gestor de paquetes del proyecto (no usar npm/yarn) |
| Docker + Docker Compose | reciente | Para levantar SQL Server local |
| Toolchain de compilación | — | `canvas` y `@tensorflow/tfjs-node` compilan binarios nativos |
| mkcert | opcional | Next lo descarga solo si no está instalado |

En Debian/Ubuntu (incluido WSL2), las dependencias nativas de `canvas`:

```bash
sudo apt-get install -y build-essential python3 pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

## Setup inicial

### 1. Clonar e instalar dependencias

```bash
git clone git@github.com:XINAD919/marcacion-de-tiempos.git
cd marcacion-de-tiempos
pnpm install
```

`pnpm-workspace.yaml` ya autoriza los scripts de build de `canvas` y `@tensorflow/tfjs-node`
(pnpm 10 los bloquea por defecto). Si la instalación falla en uno de ellos, casi siempre falta
alguna librería del sistema de la tabla anterior.

### 2. Variables de entorno

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `SA_PASSWORD` | Contraseña del usuario `sa` de SQL Server (la usa `docker-compose.yml`). Debe cumplir la política de SQL Server: ≥ 8 caracteres con mayúsculas, minúsculas, números y símbolos. |
| `DATABASE_URL` | Cadena de conexión de Prisma. La contraseña debe coincidir con `SA_PASSWORD`. |
| `FACE_MATCH_THRESHOLD` | Distancia euclidiana máxima para aceptar un rostro (por defecto `0.5`; menor = más estricto). |
| `AUTH_SECRET` | Secreto de NextAuth. Generarlo con `openssl rand -base64 32`. |
| `SEED_ADMIN_EMAIL` | Correo del primer administrador. |
| `SEED_ADMIN_PASSWORD` | Contraseña del primer administrador. **Cambiarla**: el seed se omite si se deja `changeme`. |
| `SEED_ADMIN_NOMBRE` | Nombre visible del primer administrador. |

### 3. Levantar SQL Server

```bash
docker compose up -d db
```

Espera unos segundos a que el contenedor termine de arrancar (`docker compose logs -f db` hasta
ver `SQL Server is now ready for client connections`). Los datos persisten en el volumen
`mssql-data`.

### 4. Base de datos: migraciones y primer admin

```bash
pnpm exec prisma migrate dev   # crea la BD, aplica migraciones y genera el cliente
pnpm exec prisma db seed       # crea el primer administrador a partir de SEED_ADMIN_*
```

`migrate dev` también ejecuta el seed automáticamente cuando crea la base desde cero. El seed es
idempotente: si el admin ya existe, no hace nada.

Para inspeccionar los datos: `pnpm prisma:studio`.

### 5. Ejecutar en desarrollo

```bash
pnpm dev
```

Abre <https://localhost:3000>. El servidor corre con **HTTPS** (`--experimental-https`) porque el
navegador solo permite usar la cámara en contexto seguro. La primera vez Next genera un
certificado local con mkcert en `certificates/` (ignorado por git).

> **Linux / WSL2 sin sudo:** si `mkcert -install` falla, Next vuelve en silencio a HTTP y la
> cámara deja de funcionar. Instala la CA solo en el almacén del usuario:
>
> ```bash
> TRUST_STORES=nss pnpm dev
> ```

### Rutas principales

| Ruta | Descripción |
|---|---|
| `/login` | Ingreso de administradores |
| `/marcacion` | Kiosko de marcación (cámara + reconocimiento facial) |
| `/admin/administradores` | Gestión de administradores |
| `/admin/enrolar/[userId]` | Captura de rostro de un practicante |

Los modelos de `face-api.js` ya vienen en `public/models/` (tiny face detector, landmarks 68 y
reconocimiento); no hay que descargarlos.

## Desarrollo en Windows

**Opción recomendada: WSL2.** Instala Ubuntu en WSL2 y sigue este README tal cual. Clona el repo
dentro del sistema de archivos de Linux (`~/proyectos/...`), **no** en `/mnt/c/...`: ahí pnpm y el
watcher de Next son muy lentos. Así se evitan los problemas de compilación nativa descritos abajo.

**Windows nativo (PowerShell)** también es posible, con estas diferencias:

- **Herramientas de compilación:** en lugar de los paquetes `apt-get`, instala
  [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con la
  carga de trabajo *"Desarrollo para el escritorio con C++"* y Python 3. `canvas` normalmente usa un
  binario precompilado, pero `@tensorflow/tfjs-node` puede necesitar compilar.
- **Error de `tfjs-node` al iniciar** (`The specified module could not be found ... tfjs_binding.node`):
  copia `tensorflow.dll` desde `node_modules/@tensorflow/tfjs-node/deps/lib/` a
  `node_modules/@tensorflow/tfjs-node/lib/napi-v8/`.
- **SQL Server:** usa Docker Desktop (backend WSL2) igual que en el paso 3, o instala
  [SQL Server Developer/Express](https://www.microsoft.com/sql-server/sql-server-downloads)
  directamente y ajusta `DATABASE_URL` a esa instancia.
- **Certificado HTTPS:** `mkcert -install` usa el almacén de certificados de Windows y muestra un
  diálogo para confirmar la CA; acéptalo. No hace falta `TRUST_STORES=nss`.
- **Comandos equivalentes:**

  | README (Linux) | PowerShell |
  |---|---|
  | `cp .env.example .env` | `Copy-Item .env.example .env` |
  | `openssl rand -base64 32` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

Los scripts de `package.json` no usan sintaxis de bash, así que `pnpm dev`, `pnpm test`, etc.
funcionan igual.

## Pruebas

```bash
pnpm test          # Vitest (unitarias)
pnpm test:watch    # Vitest en modo watch
pnpm lint          # ESLint

pnpm exec playwright install chromium   # solo la primera vez
pnpm exec playwright test               # e2e
```

Las pruebas e2e levantan el servidor HTTPS (o reutilizan uno ya corriendo) y simulan la cámara con
`test/fixtures/fake-camera.y4m`, así que no necesitan webcam real.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo con HTTPS local |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` | ESLint |
| `pnpm test` / `pnpm test:watch` | Pruebas unitarias |
| `pnpm prisma:studio` | Explorador visual de la base de datos |

## Problemas comunes

- **La cámara no arranca en otro PC de la red:** los kioskos deben entrar por HTTPS con un
  certificado en el que confíen. El certificado de desarrollo solo sirve para `localhost`; el
  despliegue en red interna requiere el reverse proxy con CA propia descrito en
  [AGENTS.md](AGENTS.md).
- **`Login failed for user 'sa'`:** `SA_PASSWORD` y la contraseña de `DATABASE_URL` no coinciden, o
  el contenedor se creó con otra contraseña. Recréalo con `docker compose down -v` (borra los datos
  locales) y vuelve a levantarlo.
- **El seed dice "omitiendo seed":** revisa que `SEED_ADMIN_*` estén definidas y que la contraseña
  no sea `changeme`.
- **Errores tipo `t.toFloat is not a function`:** hay dos copias de `@tensorflow/tfjs-core`. El
  override en `package.json` y el alias de `next.config.ts` lo evitan; no los quites y reinstala
  con `pnpm install`.
