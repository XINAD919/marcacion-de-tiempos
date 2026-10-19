# Perfil, correcciones manuales y Marcaciones de hoy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que coordinación vea el perfil de cada practicante (4d), corrija sus marcaciones a mano (4e) y siga el día en «Marcaciones de hoy», sin perder nunca el rastro de lo que marcó el kiosko.

**Architecture:** `attendance_logs` gana campos de auditoría y anulación; nada se borra. La lógica de días, inconsistencias, validación de correcciones y novedades vive en módulos puros (`src/lib/marcaciones/`) con pruebas Vitest. Un servicio Prisma aplica las correcciones en transacciones y otro arma las consultas de perfil y del día. Las pantallas son Server Components con diálogos cliente que llaman server actions.

**Tech Stack:** Next.js App Router (leer `node_modules/next/dist/docs/` antes de tocar rutas o server actions), TypeScript, Prisma + SQL Server, shadcn/ui (Base UI: `DialogTrigger render=…`), Tailwind con los tokens de `globals.css`, Vitest (contra la BD de Docker), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-perfil-y-correcciones-design.md`

## Global Constraints

- Nada se borra: anular = `anuladaEn` + `anuladaPorId` + `motivoAnulacion`; corregir/restaurar/reasignar = anular + crear copia con `reemplazaAId`.
- Toda consulta que alimente horas, tipo de la siguiente marcación, reportes, exportaciones o Marcaciones de hoy filtra `anuladaEn: null` usando `MARCACION_VALIDA` (Task 1).
- Las horas salen siempre de `sumWorkedMs` con `maxDailyMs = jornadaMaximaHoras h`; llegada tarde y salida temprana se derivan, nunca se guardan.
- Manuales: `metodo = "manual"`, `deviceId = "coordinacion"`, `registradoPorId` = admin de la sesión, `motivo` obligatorio (3–300 caracteres).
- No se aplica «Tiempo mínimo antes de la salida» a las manuales.
- Listas de pendientes: solo usuarios activos; sin fecha de corte; días en hora local del servidor.
- Toda server action verifica `auth()` y devuelve mensajes en español llano; nunca texto de excepción.
- UI solo con tokens existentes (`bg-navy`, `text-brand-red-ink`, `bg-bone-2`, `bg-row-alt`, `Badge` activo/inactivo/sin-rostro…); `tabular-nums` en horas, cédulas y cifras; filas con 15–17 px de padding vertical.
- Commits en español, Conventional Commits, **sin** línea `Co-Authored-By`.

## Review Focus

1. **Días en zona local vs. UTC** — una marcación a las 19:30 en Colombia es del día siguiente en UTC; la consulta SQL de pendientes debe agrupar por día local igual que `startOfDay`. Prueba en Task 5.
2. **Anular la entrada de una jornada cerrada** sin anular la salida deja una salida sin entrada que debe aparecer en «Por corregir» y no sumar horas. Prueba en Task 2 y Task 4.
3. **Restaurar una marcación ya reemplazada** (corregida o reasignada) duplicaría la marcación; debe rechazarse. Prueba en Task 4.
4. **Hora vacía o con formato inválido** en un diálogo (`""`, `"25:00"`, `"7"`) debe dar un error de campo, no una excepción. Prueba en Task 3.
5. **El kiosko tras una corrección**: si hoy se anula la entrada, la próxima marcación del kiosko debe ser ENTRADA. Prueba en Task 1.

---

### Task 1: Migración y filtro de marcaciones válidas

**Files:**
- Modify: `prisma/schema.prisma` (modelos `AttendanceLog`, `Admin`)
- Create: `prisma/migrations/<timestamp>_correcciones_manuales/migration.sql` (generada)
- Create: `src/lib/server/marcacionValida.ts`
- Modify: `src/lib/server/marcacionService.ts:30,73`, `src/lib/server/reporteService.ts:37`
- Test: `src/lib/server/marcacionService.test.ts` (nuevo)

**Interfaces:**
- Produces: campos Prisma `registradoPorId String?`, `motivo String? @db.NVarChar(300)`, `anuladaEn DateTime?`, `anuladaPorId String?`, `motivoAnulacion String? @db.NVarChar(300)`, `reemplazaAId String?` en `AttendanceLog`, con relaciones `registradoPor Admin? @relation("MarcacionRegistrada")`, `anuladaPor Admin? @relation("MarcacionAnulada")`, `reemplazaA AttendanceLog? @relation("Reemplazo", onDelete: NoAction, onUpdate: NoAction)` y su inversa `reemplazos AttendanceLog[] @relation("Reemplazo")`. SQL Server exige `NoAction` en las FK que forman ciclos o múltiples caminos: ponlo en las tres relaciones nuevas.
- Produces: `export const MARCACION_VALIDA = { anuladaEn: null } as const satisfies Prisma.AttendanceLogWhereInput;` y `export const DEVICE_COORDINACION = "coordinacion";`, ambos en `marcacionValida.ts`.

- [ ] **Step 1: Escribir la prueba que falla** en `marcacionService.test.ts` (crea su propio usuario con cédula prefijo `990088`, limpia `attendanceLog` y `user` en `afterAll`):

```ts
it("ignora una entrada anulada al decidir el tipo de la siguiente marcación", async () => {
  await prisma.attendanceLog.create({
    data: { userId, tipo: "IN", metodo: "face", deviceId: "t", marcadoEn: new Date(), anuladaEn: new Date(), motivoAnulacion: "prueba" },
  });
  const result = await registrarMarcacion(user, DEFAULT_CONFIG, { metodo: "qr", confianza: null, deviceId: "t" });
  expect(result).toMatchObject({ matched: true, tipo: "IN" });
});

it("no suma horas de una salida anulada en el acumulado del kiosko", async () => {
  // IN hace 3 h (válida), OUT hace 1 h (anulada) → la próxima es OUT y acumuladoMs ≈ 3 h, no 2 h + 3 h.
});
```

- [ ] **Step 2: Correr y ver que falla**
Run: `pnpm test src/lib/server/marcacionService.test.ts`
Expected: FAIL (campo `anuladaEn` desconocido para Prisma).

- [ ] **Step 3: Editar el schema y generar la migración**
Run: `pnpm exec prisma migrate dev --name correcciones_manuales`
Expected: migración creada y aplicada; cliente regenerado.

- [ ] **Step 4: Crear `marcacionValida.ts` y aplicar `MARCACION_VALIDA`** en los tres `where` existentes (spread junto al filtro actual).

- [ ] **Step 5: Correr la suite completa**
Run: `pnpm test`
Expected: PASS (incluidas las pruebas de reportes y marcación existentes).

- [ ] **Step 6: Commit**
```bash
git add prisma src/lib/server
git commit -m "feat(marcacion): agrega anulación y auditoría a las marcaciones"
```

---

### Task 2: Días e inconsistencias (puro)

**Files:**
- Create: `src/lib/marcaciones/dias.ts`
- Test: `src/lib/marcaciones/dias.test.ts`

**Interfaces:**
- Consumes: `AttendanceMark` (`workedTime.ts`), `startOfDay`, `isSameDay` (`src/lib/reportes/dates.ts`).
- Produces:
```ts
export interface Marca extends AttendanceMark { id: string }
export type Inconsistencia =
  | { tipo: "sin-salida"; marca: Marca }   // IN de un día anterior a hoy sin OUT a continuación ese día
  | { tipo: "sin-entrada"; marca: Marca }; // OUT sin IN inmediatamente antes ese día (también hoy)
export function marcasPorDia<T extends AttendanceMark>(marcas: T[]): Map<string, T[]>; // clave toDayParam, cada lista ordenada asc
export function findInconsistencias(marcas: Marca[], now: Date): Inconsistencia[]; // solo marcas válidas; orden: día desc
export function jornadaAbiertaHoy(marcas: Marca[], now: Date): Marca | null; // última marca de hoy si es IN
export function encaja(dia: Marca[], nueva: { tipo: string; marcadoEn: Date }): boolean;
```
Regla de `encaja` (inserta `nueva` ordenada en `dia`): el anterior inmediato debe ser de tipo opuesto, o no existir y `nueva.tipo === "IN"`; el siguiente inmediato debe ser de tipo opuesto o no existir. La pareja se evalúa **por día**, igual que `findInconsistencias`.

- [ ] **Step 1: Escribir las pruebas que fallan** (helper `at(hhmm, day)` como en `workedTime.test.ts`; `now = at("10:00","2026-10-18")`):
  - `IN 7:00 / OUT 13:00` del 17 → `[]`.
  - `IN 7:00` del 17 sin salida → `[{ tipo: "sin-salida", marca: { id: "a" } }]`.
  - `IN 7:00` de hoy (18) sin salida → `[]` y `jornadaAbiertaHoy` devuelve esa marca.
  - `IN 7:00, IN 13:00` del 17 → la primera es sin-salida y la segunda también.
  - `OUT 13:00` del 17 sola → `sin-entrada`; `OUT 9:00` de hoy sola → `sin-entrada`.
  - Orden día descendente con pendientes del 14 y del 17.
  - `encaja`: `[IN 7:00]` + `OUT 12:00` → true; `[IN 7:00]` + `IN 12:00` → false; `[]` + `OUT 9:00` → false; `[OUT 13:00]` + `IN 7:00` → true; `[IN 7, OUT 13]` + `OUT 10:00` → false.

- [ ] **Step 2: Correr y ver que falla**
Run: `pnpm test src/lib/marcaciones/dias.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `dias.ts`.**

- [ ] **Step 4: Correr y ver que pasa** → PASS.

- [ ] **Step 5: Commit** `feat(marcaciones): detecta salidas y entradas sin pareja`

---

### Task 3: Validación de correcciones y novedades (puro)

**Files:**
- Create: `src/lib/marcaciones/correcciones.ts`, `src/lib/marcaciones/novedades.ts`
- Test: `src/lib/marcaciones/correcciones.test.ts`, `src/lib/marcaciones/novedades.test.ts`

**Interfaces:**
- Consumes: `lateMinutes` (`markingRules.ts`), `Marca` (Task 2).
- Produces (`correcciones.ts`):
```ts
export const MENSAJE = {
  motivoCorto: "Escribe el motivo (mínimo 3 caracteres).",
  motivoLargo: "El motivo no puede pasar de 300 caracteres.",
  horaInvalida: "Escribe la hora en formato HH:mm, por ejemplo 13:00.",
  futuro: "La hora no puede ser posterior a este momento.",
  desorden: "Con esa hora quedarían dos entradas o dos salidas seguidas ese día.",
  salidaAntesDeEntrada: "La salida debe quedar después de la entrada y antes de la siguiente marcación.",
  noExiste: "Esa marcación ya no existe o fue anulada. Recarga la página.",
  reemplazada: "Esta marcación ya fue reemplazada por una corrección; corrige esa en su lugar.",
  mismoUsuario: "Elige a otro practicante: la marcación ya es de esta persona.",
  destinoInactivo: "Ese practicante está inactivo.",
  noAnulada: "Esa marcación no está anulada.",
} as const;
export function parseMotivo(value: unknown): { ok: true; value: string } | { ok: false; error: string }; // trim
export function horaEnDia(dia: Date, hhmm: unknown): Date | null; // "HH:mm" en el día local de `dia`
export function horaSugerida(dia: Date, horaFin: string | null, horaCierre: string | null): string | null; // "HH:mm"
```
- Produces (`novedades.ts`):
```ts
export type Novedad = { tipo: "tarde"; minutos: number } | { tipo: "salida-temprana" } | { tipo: "manual" } | { tipo: "qr" };
export function horaFinEfectiva(user: { horaFin: string | null; sede: { horaCierre: string | null } | null }): string | null;
export function novedadesDe(
  marca: { tipo: string; metodo: string; marcadoEn: Date },
  ctx: { primeraEntradaDelDia: boolean; horaInicio: string | null; horaFin: string | null; toleranciaMin: number }
): Novedad[];
export const NOVEDAD_LABEL: Record<Novedad["tipo"], string>; // "tarde" se pinta como "N min tarde"
```
Reglas: `tarde` solo en la primera IN del día y si `lateMinutes` no es null; `salida-temprana` en OUT anterior a `horaFin` ese día (sin `horaFin` no aplica); `manual` si `metodo === "manual"` y no es salida temprana; `qr` si `metodo === "qr"`.

- [ ] **Step 1: Escribir las pruebas que fallan**:
  - `parseMotivo("  ab ")` → error `motivoCorto`; 301 caracteres → `motivoLargo`; `" Cita médica "` → `"Cita médica"`.
  - `horaEnDia(día, "13:05")` → ese día 13:05; `""`, `"25:00"`, `"7"`, `null` → `null`.
  - `horaSugerida(d, "13:00", "17:00")` → `"13:00"`; `(d, null, "17:00")` → `"17:00"`; `(d, null, null)` → `null`.
  - `novedadesDe` OUT kiosko 11:00 con horaFin 13:00 → `[{tipo:"salida-temprana"}]`; OUT manual 13:30 → `[{tipo:"manual"}]`; OUT manual 11:00 → solo salida-temprana; IN qr 7:22 con inicio 7:00 tolerancia 10 → tarde 22 + qr; segunda IN del día a las 14:00 → sin tarde; OUT con horaFin null → `[]`.
  - `horaFinEfectiva` usa la sede si el usuario no tiene.

- [ ] **Step 2: Correr y ver que falla** → `pnpm test src/lib/marcaciones` FAIL.
- [ ] **Step 3: Implementar ambos módulos.**
- [ ] **Step 4: Correr y ver que pasa** → PASS.
- [ ] **Step 5: Commit** `feat(marcaciones): valida correcciones y clasifica novedades`

---

### Task 4: Servicio de correcciones (Prisma)

**Files:**
- Create: `src/lib/server/correccionService.ts`
- Test: `src/lib/server/correccionService.test.ts` (prefijo de cédula `990089`; crea un `Admin` de prueba y lo borra)

**Interfaces:**
- Consumes: Tasks 1–3 (`MARCACION_VALIDA`, `DEVICE_COORDINACION`, `marcasPorDia`, `encaja`, `MENSAJE`).
- Produces (todas en una `prisma.$transaction` interactiva; `now` inyectable para pruebas, por defecto `new Date()`):
```ts
export type CorreccionResult = { ok: true } | { ok: false; field?: "hora" | "motivo" | "destino"; message: string };
interface Base { adminId: string; motivo: string; now?: Date }
export function registrarSalida(i: Base & { entradaId: string; hora: Date }): Promise<CorreccionResult>;
export function registrarEntrada(i: Base & { salidaId: string; hora: Date }): Promise<CorreccionResult>;
export function corregirHora(i: Base & { marcaId: string; hora: Date }): Promise<CorreccionResult>;
export function anular(i: Base & { marcaId: string; incluirPareja: boolean }): Promise<CorreccionResult>;
export function restaurar(i: Base & { marcaId: string }): Promise<CorreccionResult>;
export function reasignar(i: Base & { marcaId: string; destinoUserId: string }): Promise<CorreccionResult>;
export function parejaDe(marcaId: string): Promise<{ id: string; tipo: string; marcadoEn: Date } | null>; // la OUT que cierra una IN (o la IN de una OUT) ese día; para el aviso de Anular
```
Reglas por acción (hora ≤ `now` → si no, `MENSAJE.futuro`; mismo día local de la marca de referencia):
  - `registrarSalida`: la entrada debe ser IN válida; el anterior inmediato de la nueva OUT debe ser esa entrada y `encaja` → si no, `salidaAntesDeEntrada`.
  - `registrarEntrada`: la salida debe ser OUT válida; `encaja` en el día.
  - `corregirHora`: quita la original del día, `encaja` la nueva con el mismo tipo; anula la original y crea copia (`metodo: "manual"`, `reemplazaAId`).
  - `anular`: si `incluirPareja`, anula también `parejaDe`.
  - `restaurar`: la marca debe estar anulada (`noAnulada`); si alguna marca válida tiene `reemplazaAId = marcaId` → `reemplazada`; `encaja` en el día; crea copia manual con `reemplazaAId = marcaId`.
  - `reasignar`: destino ≠ dueño (`mismoUsuario`), destino activo (`destinoInactivo`), `encaja` en el día del destino; anula original y crea copia manual para el destino.

- [ ] **Step 1: Escribir las pruebas que fallan** (una por regla, contra la BD):
  - registrarSalida en una IN abierta de ayer → ok; `sumWorkedMs` de las marcas válidas suma el tramo; la nueva tiene `metodo "manual"`, `deviceId "coordinacion"`, `registradoPorId` y `motivo`.
  - registrarSalida con hora anterior a la entrada → `{ ok:false, field:"hora", message: MENSAJE.salidaAntesDeEntrada }`; con hora futura → `MENSAJE.futuro`.
  - corregirHora → la original queda con `anuladaEn` y la nueva con `reemplazaAId` = original.
  - anular IN de jornada cerrada con `incluirPareja:false` → `findInconsistencias` devuelve `sin-entrada` para la OUT; con `true` → ambas anuladas.
  - restaurar una marca corregida → `MENSAJE.reemplazada`; restaurar una anulada sin reemplazo → ok.
  - reasignar al mismo usuario → `mismoUsuario`; a un destino con OUT ya cerrada en ese horario → `desorden`; caso feliz → la original anulada, la copia pertenece al destino.

- [ ] **Step 2: Correr y ver que falla** → `pnpm test src/lib/server/correccionService.test.ts` FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr y ver que pasa** → PASS.
- [ ] **Step 5: Commit** `feat(marcaciones): agrega servicio de correcciones manuales`

---

### Task 5: Consultas de perfil, pendientes y del día

**Files:**
- Create: `src/lib/server/marcacionesQuery.ts`
- Test: `src/lib/server/marcacionesQuery.test.ts` (prefijo `990090`)

**Interfaces:**
- Consumes: Tasks 1–3, `buildReporteRow` (`src/lib/reportes/rows.ts`), `getConfig`, `reglasPara`.
- Produces:
```ts
export interface MarcaHistorial { id: string; tipo: string; metodo: string; marcadoEn: Date; motivo: string | null;
  registradoPor: string | null; anuladaEn: Date | null; motivoAnulacion: string | null; anuladaPor: string | null;
  reemplazaAId: string | null; novedades: Novedad[] }
export interface DiaHistorial { dia: Date; marcas: MarcaHistorial[]; jornadaMs: number } // marcas incluye anuladas
export function getPerfil(userId: string, page: number, now?: Date): Promise<null | {
  user: { id; nombre; cedula; tipo; activo; email; horaInicio; horaFin; institucion: string | null; sede: string | null };
  avance: ReporteRow; jornadaAbierta: Marca | null; inconsistencias: Inconsistencia[];
  sugerencia: { horaFin: string | null }; dias: DiaHistorial[]; page: number; pages: number }>; // 30 días por página
export interface Pendiente { inconsistencia: Inconsistencia; user: { id; nombre; cedula; horaInicio; horaFin }; horaSugerida: string | null }
export function listPendientes(scope: { sede?: number; institucion?: number }, opts: { limit: number; offset: number }, now?: Date):
  Promise<{ rows: Pendiente[]; total: number }>;
export interface MarcacionDelDia { marca: MarcaHistorial; user: { id: string; nombre: string } }
export function getMarcacionesDelDia(scope: { sede?: number; institucion?: number }, now?: Date): Promise<{
  rows: MarcacionDelDia[]; // solo válidas, hora desc
  resumen: { dentroAhora: number; yaSalieron: number; tarde: number; salidasTempranas: number; pendientes: number } }>;
```
`listPendientes` **no** carga todos los registros: usa `prisma.$queryRaw` con `LAG`/`LEAD` particionado por `userId` y por **día local** (`CAST(DATEADD(minute, ${offsetMin}, marcadoEn) AS date)` con `offsetMin = -now.getTimezoneOffset()`), filtrando `anuladaEn IS NULL` y usuarios activos del alcance; devuelve los ids de las IN sin OUT siguiente de días `< hoy` y de las OUT sin IN anterior. Luego trae usuarios con Prisma. Debe coincidir con `findInconsistencias`.

- [ ] **Step 1: Escribir las pruebas que fallan**:
  - Perfil: con IN+OUT de hace 2 días, IN abierta de ayer e IN de hoy → `inconsistencias` tiene 1 sin-salida, `jornadaAbierta` es la de hoy, `avance.workedMs` solo cuenta el par cerrado, `dias[0]` es hoy.
  - Perfil incluye anuladas en `dias` pero no en `avance`.
  - `listPendientes` devuelve la misma inconsistencia que `findInconsistencias` del perfil y excluye a un usuario inactivo con pendiente.
  - **Zona horaria:** IN a las 19:30 locales de ayer + OUT a las 21:00 locales de ayer → no hay pendiente (cruzan medianoche UTC en Colombia).
  - `getMarcacionesDelDia`: dos usuarios, uno dentro y uno que ya salió antes de su `horaFin` → `dentroAhora 1`, `yaSalieron 1`, `salidasTempranas 1`.
  - Filtro por sede excluye al usuario de otra sede.

- [ ] **Step 2: Correr y ver que falla** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr y ver que pasa** → PASS.
- [ ] **Step 5: Commit** `feat(marcaciones): consulta perfil, pendientes y marcaciones del día`

---

### Task 6: Server actions y diálogos de corrección

**Files:**
- Create: `src/app/admin/_correcciones/actions.ts`, `src/app/admin/_correcciones/dialogs.tsx`
- Test: `src/app/admin/_correcciones/actions.test.ts` (solo la sesión: sin sesión → mensaje; mockear `auth` con `vi.mock("@/lib/server/auth")`)

**Interfaces:**
- Consumes: Task 4, `parseMotivo`, `horaEnDia`, `listUsuarios` (`usuarioService.ts`).
- Produces (todas `"use server"`, reciben `FormData` con `marcaId`, `hora` "HH:mm", `motivo`, y donde aplique `destinoUserId` / `incluirPareja`; el día se toma de la marca en el servidor):
```ts
export type CorreccionActionResult = { ok: true } | { ok: false; errors?: Partial<Record<"hora" | "motivo" | "destino", string>>; message?: string };
export async function registrarSalidaAction(fd: FormData): Promise<CorreccionActionResult>;
export async function registrarEntradaAction(fd: FormData): Promise<CorreccionActionResult>;
export async function corregirHoraAction(fd: FormData): Promise<CorreccionActionResult>;
export async function anularAction(fd: FormData): Promise<CorreccionActionResult>;
export async function restaurarAction(fd: FormData): Promise<CorreccionActionResult>;
export async function reasignarAction(fd: FormData): Promise<CorreccionActionResult>;
export async function buscarPracticantesAction(q: string): Promise<{ id: string; nombre: string; cedula: string }[]>; // activos, máx. 8
```
Sin sesión → `{ ok:false, message: "Tu sesión terminó. Vuelve a iniciar sesión." }`. Tras éxito: `revalidatePath("/admin", "layout")`.
- Produces (`dialogs.tsx`, cliente; siguen el patrón de `sede-dialog.tsx`: `Dialog` controlado, `DialogTrigger render`, error por campo con `aria-invalid`/`aria-describedby`, mensaje general arriba del pie):
  `RegistrarSalidaDialog({ entradaId, entradaHora: string, sugerida: string | null, temprana: boolean, trigger })` — título «Registrar salida temprana» o «Registrar salida»; `<input type="time">` prellenado con ahora (temprana) o `sugerida`;
  `RegistrarEntradaDialog({ salidaId, salidaHora })`; `CorregirHoraDialog({ marcaId, tipo, hora })`;
  `AnularDialog({ marcaId, descripcion, pareja: { hora: string } | null })` — si hay pareja, casilla «Anular también la salida de las 13:00» marcada por defecto y aviso de que si no, esa salida no suma;
  `RestaurarDialog({ marcaId })`; `ReasignarDialog({ marcaId, descripcion })` — buscador por nombre o cédula con `buscarPracticantesAction` (debounce 300 ms) y lista para elegir.
  Todos piden **Motivo** (textarea, obligatorio) y el botón primario dice la acción («Registrar salida», «Anular marcación»…).

- [ ] **Step 1: Escribir la prueba que falla** (`registrarSalidaAction` sin sesión → mensaje de sesión; con sesión y `hora=""` → `errors.hora === MENSAJE.horaInvalida` sin tocar la BD).
- [ ] **Step 2: Correr y ver que falla** → FAIL.
- [ ] **Step 3: Implementar actions y diálogos.**
- [ ] **Step 4: Correr pruebas y lint**
Run: `pnpm test src/app/admin/_correcciones && pnpm lint`
Expected: PASS, sin errores de lint.
- [ ] **Step 5: Commit** `feat(marcaciones): agrega acciones y diálogos de corrección`

---

### Task 7: Perfil del practicante (4d)

**Files:**
- Create: `src/app/admin/usuarios/[userId]/page.tsx`, `src/app/admin/usuarios/[userId]/historial.tsx`
- Modify: `src/app/admin/usuarios/page.tsx:125` (el nombre de la fila enlaza a `/admin/usuarios/${user.id}`; la acción Editar/Enrolar no cambia)

**Interfaces:**
- Consumes: `getPerfil` (Task 5), diálogos (Task 6), `PageHeader`, `ProgressRing`, `Badge`, `Table`, `formatDayShort`, `formatTime`, `msToHours`, `NOVEDAD_LABEL`.

Contenido (spec › Perfil): `PageHeader` con nombre, descripción `C.C. · institución · sede · horaInicio–horaFin`, píldora de estado y botón secundario **Editar datos** → `/admin/usuarios/[id]/editar`; aviso ámbar de jornada abierta con `RegistrarSalidaDialog temprana`; tarjeta de avance con `ProgressRing`, `126 / 240 h`, restantes (naturales: solo acumuladas); bloque **Por corregir** (contador, «No suman horas hasta corregirlas», acción **Registrar salida** o **Registrar entrada**; oculto si vacío); **Historial** por día (`?page=` de 30 días) con entrada, salida, jornada, notas y acciones por marca (**Corregir hora**, **Anular**, **Reasignar**); anuladas tachadas con su motivo tras el botón «Ver anuladas» (estado cliente en `historial.tsx`), cada una con **Restaurar**. `notFound()` si no existe.

- [ ] **Step 1: Implementar la página.**
- [ ] **Step 2: Verificar a mano** con `pnpm dev`, en 1366×768 y 1920×1080: un usuario con IN abierta hoy muestra el aviso; registrar la salida temprana la mueve al historial con «Salida temprana: <motivo> · registró <admin>»; sin contenido recortado.
- [ ] **Step 3: Lint** → `pnpm lint` sin errores.
- [ ] **Step 4: Commit** `feat(usuarios): agrega el perfil del practicante con su historial`

---

### Task 8: Marcaciones de hoy y menú

**Files:**
- Create: `src/app/admin/marcaciones/page.tsx`, `src/app/admin/marcaciones/filtros.tsx`
- Modify: `src/components/admin/nav-config.ts` (`marcaciones` → `href: "/admin/marcaciones"`), `src/components/admin/nav-config.test.ts`

**Interfaces:**
- Consumes: `getMarcacionesDelDia`, `listPendientes` (Task 5), `RegistrarSalidaDialog`/`RegistrarEntradaDialog` (Task 6), `AutoRefresh` (`src/app/admin/reportes/auto-refresh.tsx`), `listCatalogo`.

Contenido (spec › Marcaciones de hoy): `PageHeader` «Marcaciones de hoy» con `formatDayLong(now)`; chips de **Sede** e **Institución** siempre visibles (parámetros `?sede=&institucion=`, mismo estilo de chip que Reportes); cinco cifras (la de pendientes con borde izquierdo rojo); **Salidas sin marcar**: 10 filas y «Ver todas» (`?pendientes=todas`, paginado de 20) con practicante enlazado al perfil, día, entrada, horario y acción en diálogo; **Marcaciones de hoy** con alternador **Todas / Solo novedades** (`?vista=novedades`), columnas hora, practicante, tipo (ENTRADA/SALIDA), método (rostro/QR/manual), novedad (píldora ámbar para tarde). `AutoRefresh seconds={60}`.

- [ ] **Step 1: Prueba que falla en `nav-config.test.ts`**: `NAV_SECTIONS` tiene el ítem `marcaciones` con `href "/admin/marcaciones"` e `isNavItemActive` es true en `/admin/marcaciones`.
- [ ] **Step 2: Correr y ver que falla** → `pnpm test src/components/admin` FAIL.
- [ ] **Step 3: Cambiar `nav-config.ts` e implementar la página.**
- [ ] **Step 4: Correr pruebas y lint** → PASS.
- [ ] **Step 5: Verificar a mano** en 1366×768: registrar una salida desde la lista la quita de pendientes y suma a «Ya salieron» si es de hoy.
- [ ] **Step 6: Commit** `feat(marcaciones): agrega la pantalla de marcaciones de hoy`

---

### Task 9: Prueba de punta a punta y documentación

**Files:**
- Create: `e2e/correcciones.spec.ts`
- Modify: `AGENTS.md` (modelo de datos de `attendance_logs`; marcar 4d y 4e como hechas; quitar «hoy remiten a coordinación»)

- [ ] **Step 1: Escribir el e2e** (patrón de `e2e/instituciones-y-sedes.spec.ts`: login con `SEED_ADMIN_*`, datos con sufijo `E2E <timestamp>`, limpieza en `afterAll` con `PrismaClient`): crea un practicante con una IN de ayer a las 07:00 → abre `/admin/marcaciones` → ve su fila en «Salidas sin marcar» → «Registrar salida» con hora `13:00` y motivo «Olvidó marcar» → la fila desaparece → en su perfil el día muestra salida 13:00 · manual y el avance `6 / 240 h`.
- [ ] **Step 2: Correr**
Run: `pnpm exec playwright test e2e/correcciones.spec.ts`
Expected: PASS.
- [ ] **Step 3: Actualizar `AGENTS.md`.**
- [ ] **Step 4: Suite completa** → `pnpm test && pnpm lint` PASS.
- [ ] **Step 5: Commit** `test(e2e): cubre la corrección de una salida olvidada` y `docs: documenta correcciones manuales en AGENTS.md` (o uno solo si se prefiere).
