# Spec: Reconocimiento facial con face-api.js (arquitectura híbrida)

## Contexto

`medicion-tiempos` reemplaza el control manual en papel/Excel de ~2.700 practicantes de una
fundación por marcación con reconocimiento facial (QR como respaldo). `AGENTS.md` documenta la
decisión funcional y de producto, pero al momento de escribir este spec no existe código real:
ni `src/`, ni acceso a base de datos, ni tests. `package.json` ya incluye `face-api.js`,
`@tensorflow/tfjs-node` y `canvas`, lo que señalaba una decisión de arquitectura sin resolver
(¿inferencia en el navegador o en el servidor?). Este documento fija esa decisión y el contrato de
cada pieza, para poder implementarlas con TDD (test antes que código, capa por capa).

Este spec cubre la **primera pieza real de código del proyecto**: el motor de reconocimiento
facial y su integración mínima end-to-end (enrolamiento + marcación + persistencia real en SQL
Server).

## Decisiones

- **Arquitectura híbrida.** El cliente solo corre `TinyFaceDetector` (liviano) para dar feedback
  visual en vivo en el óvalo del kiosko/enrolamiento y decidir cuándo capturar un frame. El
  servidor (Route Handlers de Next.js) hace la extracción real del descriptor (con
  `@tensorflow/tfjs-node` + `canvas`, modelos `face_landmark_68` + `face_recognition`) y el
  matching contra SQL Server.
  - *Por qué no 100% cliente*: cada kiosko tendría que cargar y correr el modelo pesado de
    reconocimiento (~6 MB) sin garantía de GPU, y el umbral/precisión quedaría disperso en N
    navegadores en vez de un solo lugar auditable.
  - *Por qué no 100% servidor*: perder el feedback visual en vivo del óvalo degradaría la UX del
    kiosko (regla de `AGENTS.md`: "el color comunica antes que el texto", respuesta en 1-2 s).
  - Las fotos ya viajan por HTTPS interno de todas formas (requisito ya definido en `AGENTS.md`),
    así que enviarlas al servidor para el paso pesado no introduce una superficie nueva de riesgo.
- **Alcance de este spec**: motor de reconocimiento + integración mínima end-to-end (páginas de
  enrolamiento y marcación mínimas, persistencia real en SQL Server). Fuera de alcance: CRUD
  completo de usuarios, importación de Excel, reportes, NextAuth, UI final pulida.
- **Test runner**: Vitest.
- **Modelo de detección cliente**: `TinyFaceDetector` (liviano, pensado para tiempo real en
  hardware modesto/sin GPU — los kioskos son PCs de especificación desconocida).
- **Acceso a datos**: Prisma, provider `sqlserver` (migraciones versionadas, cliente tipado,
  fácil de mockear en tests unitarios).
- **DB de desarrollo/tests**: Docker Compose con la imagen oficial
  `mcr.microsoft.com/mssql/server`.

## Arquitectura y flujo de datos

```
Cliente (navegador, kiosko o enrolamiento)         Servidor (Next.js, PC único de la fundación)
┌───────────────────────────────┐                  ┌─────────────────────────────────────┐
│ getUserMedia (webcam)          │                  │ Route Handlers                        │
│  → TinyFaceDetector            │  POST foto        │  /api/marcacion                       │
│    (solo guía visual: óvalo,   │  (JPEG,           │  /api/usuarios/[userId]/enrolar       │
│     "¿hay rostro bien          │  multipart/       │       │                                │
│     encuadrado?")              │  form-data)        │       ▼                                │
│  → captura still frame cuando  │──────────────────▶│  src/lib/server/faceEngine.ts          │
│    la detección es estable     │                  │   (carga modelos 1 vez por proceso,    │
└───────────────────────────────┘                  │    decodifica imagen, detección +      │
                                                     │    landmarks + descriptor con          │
                                                     │    tfjs-node/canvas)                   │
                                                     │       ▼                                │
                                                     │  src/lib/server/faceMatcher.ts         │
                                                     │   (Prisma: lee/guarda embeddings,      │
                                                     │    faceapi.FaceMatcher, umbral,        │
                                                     │    escribe attendance_logs)            │
                                                     │       ▼                                │
                                                     │  SQL Server (Prisma; Docker Compose     │
                                                     │  en desarrollo)                        │
                                                     └─────────────────────────────────────┘
```

## Componentes y contratos

### 0. Reestructuración mínima

Mover `app/` → `src/app/` y crear `src/lib/`, `src/store/`, siguiendo la "Estructura de carpetas
sugerida" que `AGENTS.md` ya documenta pero que aún no existe. Next.js soporta `src/app` de forma
nativa (ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/src-folder.md`),
sin cambios de configuración adicionales.

### 1. Esquema Prisma (`prisma/schema.prisma`)

Solo lo necesario para este alcance (subconjunto del modelo de datos completo de `AGENTS.md`):

- `User`: `id`, `cedula` (unique), `nombre`, `email`, `universidad`, `entidad`, `activo`,
  `fechaRegistro`.
- `FaceEmbedding`: `id`, `userId` (FK), `embedding` (`Bytes` — el `Float32Array` serializado como
  buffer), `modelo` (string, ej. `"face-api-recognition-v1"`), `fechaCaptura`.
- `AttendanceLog`: `id`, `userId` (FK), `tipo` (`"IN" | "OUT"`, validado en capa de app),
  `metodo` (`"face" | "qr"`), `confianza` (float nullable), `deviceId`, `marcadoEn`.

### 2. Cliente — `src/lib/client/faceDetection.ts`

- `loadDetectionModel(): Promise<void>` — carga los pesos de `TinyFaceDetector` desde `/models`
  una sola vez (promesa cacheada, idempotente).
- `detectFace(video: HTMLVideoElement): Promise<boolean>` — una detección puntual sobre el frame
  actual del video; solo indica si hay o no un rostro, ya que nada en este alcance consume el
  bounding box ni el score.
- Un hook `useFaceGuide` (usado por las páginas de kiosko y enrolamiento) corre esto en un loop de
  `requestAnimationFrame`, gobierna el estado visual del óvalo (esperando/detectando/listo) y, tras
  N frames estables, dibuja el frame en un canvas offscreen, lo exporta como `Blob` JPEG y lo sube.

### 3. Servidor — `src/lib/server/faceEngine.ts`

- `getFaceDescriptor(imageBuffer: Buffer): Promise<Float32Array>`.
  - Antes de cualquier detección: `faceapi.env.monkeyPatch({ Canvas, Image, ImageData })` con el
    paquete `canvas`, backend `@tensorflow/tfjs-node`.
  - Carga (singleton a nivel de módulo, una vez por proceso) `tinyFaceDetector` +
    `faceLandmark68Net` + `faceRecognitionNet` desde `public/models` (path de filesystem, no HTTP).
  - `detectAllFaces(...).withFaceLandmarks().withFaceDescriptors()`.
  - 0 rostros detectados → lanza `NoFaceDetectedError`.
  - Más de 1 rostro detectado → lanza `MultipleFacesDetectedError`.
  - Exactamente 1 rostro → retorna el descriptor.

### 4. Servidor — `src/lib/server/faceMatcher.ts`

- `saveEnrollmentDescriptor(userId: string, descriptor: Float32Array, modelo: string): Promise<void>`
  — persiste una fila en `FaceEmbedding`.
- `findMatch(descriptor: Float32Array): Promise<{ userId: string; distance: number } | null>`
  — trae embeddings de usuarios activos vía Prisma, los agrupa por `userId` en
  `LabeledFaceDescriptors`, construye `faceapi.FaceMatcher(labeled, threshold)` y llama
  `findBestMatch`. Retorna `null` si el mejor resultado es `"unknown"`.
- Umbral configurable por `FACE_MATCH_THRESHOLD` (default `0.5`, más estricto que el `0.6` por
  defecto de face-api.js: un falso positivo aquí marca la asistencia de la persona equivocada).
  Queda documentado como valor a afinar empíricamente una vez haya uso real.
- Reutiliza `faceapi.FaceMatcher` tal cual (matemática pura sobre arrays, sin canvas/DOM) en vez de
  reimplementar el cálculo de distancia. Con ~2.700 usuarios, reconstruirlo por request es
  trivialmente barato — no hace falta cache ni un índice aproximado (vector DB).

### 5. Route Handlers

- `POST /api/usuarios/[userId]/enrolar/route.ts`: lee `formData()`, obtiene el buffer de la foto,
  llama `faceEngine.getFaceDescriptor` → `faceMatcher.saveEnrollmentDescriptor`. Responde `201` o
  `422` con mensaje en español mapeado desde el error tipado (sin stack traces).
- `POST /api/marcacion/route.ts`: mismo parseo → `getFaceDescriptor` → `findMatch`. Si hay match:
  determina `IN`/`OUT` según el último log del día del usuario, inserta `AttendanceLog`, responde
  `200` con `{ nombre, hora, tipo }`. Si no hay match: responde `200` con `{ matched: false }` (es
  un resultado esperado, no un error de servidor) para que el cliente muestre el fallback QR.

### 6. Manejo de errores

En español, sin jerga técnica (regla ya fijada en `AGENTS.md`):

- "No se detectó ningún rostro"
- "Se detectaron varios rostros, asegúrate de estar solo frente a la cámara"
- "No se pudo acceder a la cámara"
- "No reconocido" (dispara fallback QR)

La distancia real de matching se loguea server-side para tuning, nunca se expone al usuario final.

### 7. Gestión de modelos

Un solo directorio, `public/models/`: el cliente los pide por HTTP (solo `tiny_face_detector`), el
servidor los lee del filesystem (`path.join(process.cwd(), "public", "models")`, incluyendo además
`face_landmark_68` y `face_recognition`). Nada duplicado.

## Estrategia de tests (TDD, por capas)

Cada contrato de arriba se escribe como test **antes** que la implementación (rojo → verde →
refactor). Capas, de más rápida/aislada a más end-to-end:

1. **Unitaria pura** (Vitest, sin modelos reales, sin DB): lógica de `findMatch` (agrupación de
   embeddings, umbral, decisión match/no-match) usando `Float32Array` sintéticos y un Prisma
   client mockeado. No necesita fixtures de fotos ni tfjs-node.
2. **Integración de modelo** (Vitest + `tfjs-node` + `canvas`, pesos reales, sin DB): valida
   `faceEngine.getFaceDescriptor` contra fotos reales en `test/fixtures/faces/`.
   **Prerrequisito concreto**: se necesitan fotos de al menos 2 personas distintas (varias por
   persona), una foto sin rostro y una con varios rostros, para cubrir los tres caminos de
   error/éxito. Esto es exactamente para lo que ya están instalados `@tensorflow/tfjs-node` y
   `canvas` — no son dependencias sobrantes, son la base de esta capa de test.
3. **Integración de route handler** (Vitest, Prisma real contra el SQL Server de Docker Compose,
   modelos reales): ciclo completo request→response de ambos endpoints, incluyendo rutas de error
   (sin rostro, sin match, doble enrolamiento).
4. **E2E/manual**: Playwright con `--use-fake-device-for-media-stream` (o checklist manual) para el
   flujo de cámara y la UI del óvalo, como smoke test (permisos, render, transición de estados), no
   para validar precisión de reconocimiento (poco confiable en headless).

## Fuera de alcance (explícito)

CRUD de usuarios, importación de Excel, reportes, NextAuth para admin, UI final pulida del
kiosko/enrolamiento (se resuelve visualmente después, sobre esta base funcional), ajuste fino del
umbral en producción real.
