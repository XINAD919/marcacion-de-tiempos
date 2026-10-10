# Tipos de usuario: universidad, colegio y voluntario natural

Fecha: 2026-10-10 · Estado: aprobado en conversación, pendiente de revisión escrita

## Contexto

Hoy todos los usuarios son "practicantes" con universidad/colegio, entidad, horas requeridas,
fecha de inicio y horario. La fundación tiene en realidad tres tipos:

| Tipo | Qué es | Meta de horas |
|---|---|---|
| `universidad` | Practicante universitario | Sí (convenio) |
| `colegio` | Practicante de colegio | Sí (convenio) |
| `natural` | Voluntario sin práctica formal | No |

Lo decidido con el usuario:

- Un checkbox "¿es natural?" no alcanza (tres estados), así que se usa un campo `tipo`.
- Los naturales **sí acumulan horas** (se ven en reportes y en el kiosko), pero sin meta, sin
  barra de progreso y sin fecha estimada de fin.
- Los naturales **no tienen universidad ni entidad**: solo hora de llegada y hora de salida.
- Configuración tiene una **tolerancia de llegada** y un **tiempo mínimo antes de la salida**
  propios de los naturales. El resto de reglas (exigencia del reconocimiento, intentos antes
  del respaldo, jornada máxima) siguen siendo globales.

## 1. Modelo de datos (`prisma/schema.prisma`)

`User`:

- Nuevo `tipo String @default("universidad") @db.VarChar(20)`, con índice para filtrar.
  Valores `universidad | colegio | natural`, validados en TypeScript (mismo patrón que
  `exigenciaReconocimiento`; sin enum ni `CHECK` en SQL Server).
- `universidad` y `entidad` pasan a `String?`. Para `natural` se guardan `NULL`; para los
  otros dos tipos siguen siendo obligatorias, pero lo exige la validación, no la base.
- `horasRequeridas` queda en `0` y `fechaInicio` en `NULL` para `natural`.
- `horaInicio` / `horaFin` no cambian de tipo; son obligatorias para `natural`.

`Configuracion`:

- `toleranciaLlegadaNaturalMin Int @default(10)`
- `minMinutosAntesSalidaNatural Int @default(60)`

Migración de datos existentes: todos quedan `tipo = 'universidad'`, salvo los que tengan
"colegio" o "institución educativa" (sin distinguir mayúsculas) en `universidad`, que quedan
`colegio`. La coordinadora corrige los casos que la heurística no cubra.

## 2. Tipo compartido (`src/lib/usuarios/tipoUsuario.ts`, nuevo)

Módulo puro con `TIPOS_USUARIO`, `type TipoUsuario`, `isTipoUsuario`, `TIPO_USUARIO_LABEL`
(`Universidad`, `Colegio`, `Voluntario natural`) y `tieneMetaDeHoras(tipo)` (false solo para
`natural`). Todo lo demás pregunta por el tipo a través de este módulo.

## 3. Validación (`src/lib/usuarios/userInput.ts`)

La validación depende de `tipo`:

- `universidad` / `colegio`: igual que hoy (universidad, entidad, horas, fecha y horario).
- `natural`: nombre, cédula, email opcional, `horaInicio` y `horaFin` obligatorias y con
  `horaFin` posterior a `horaInicio`. Universidad, entidad, horas y fecha se ignoran y se
  guardan vacías aunque lleguen en el formulario.
- Tipo ausente o desconocido → error "Elige el tipo de usuario."

## 4. Formulario (`src/app/admin/usuarios/_form/usuario-form.tsx`)

- Arriba de los bloques, un selector segmentado **"Tipo de usuario"** (radios con estilo de
  la marca) con las tres opciones.
- `universidad` / `colegio` → bloque **"Práctica"** actual; la etiqueta del campo pasa de
  "Universidad / Colegio" a "Universidad" o "Colegio" según el tipo.
- `natural` → bloque **"Horario"** con solo hora de llegada y hora de salida.
- Los campos ocultos no se envían (se desmontan), y el servidor no los exige (punto 3).
- Al editar un usuario se puede cambiar su tipo; las marcaciones no se tocan.

## 5. Reglas de marcación (`src/lib/configRules.ts`, `src/lib/server/marcacionService.ts`)

- `ConfigValues` y `parseConfigForm` incluyen los dos campos nuevos (mismos rangos y
  mensajes que sus equivalentes globales).
- Nueva función pura `reglasPara(config, tipo)` → `{ toleranciaLlegadaMin, minMinutosAntesSalida }`.
- `marcacionService` (entrada/salida por rostro y por QR) usa `reglasPara(config, user.tipo)`
  en vez de leer `config.toleranciaLlegadaMin` / `config.minMinutosAntesSalida` directamente.

## 6. Configuración (`src/app/admin/configuracion/*`)

Nueva subsección **"Voluntarios naturales"** en el formulario de reglas, con "Tolerancia de
llegada" y "Tiempo mínimo antes de la salida". Las reglas actuales se rotulan como
aplicables a practicantes de universidad y colegio.

## 7. Kiosko (`src/lib/client/marcacionResult.ts`, `result-screens.tsx`)

- La respuesta de marcación incluye el tipo (o un `metaHoras: number | null`).
- SALIDA de un natural: "Jornada de hoy" y "Total acumulado: 126 h", sin "/ 240" ni progreso.
- ENTRADA y llegada tarde: sin cambios (la tolerancia ya viene por tipo desde el servidor).

## 8. Listado y filtros (`src/app/admin/usuarios/*`, `src/lib/usuarios/filters.ts`)

- Filtro **Tipo** con el patrón de chips existente.
- Columna de horas: natural muestra `126 h` sin barra; universidad/entidad vacías se ven "—".

## 9. Importación (`src/lib/usuarios/importRows.ts`)

- Columna opcional **"Tipo"** (acepta "Universidad", "Colegio", "Natural", "Voluntario",
  sin distinguir mayúsculas ni tildes). Si falta la columna o la celda, se asume
  `universidad` para no romper los archivos actuales.
- Valor no reconocido → fila con error "El tipo debe ser Universidad, Colegio o Natural".
- Filas `natural` no exigen universidad, entidad, horas ni fecha; sí horario.

## 10. Carnet y enrolamiento

Se omite la línea de universidad / entidad cuando está vacía (`src/lib/server/carnet.ts`,
`src/app/admin/enrolar/[userId]/page.tsx`).

## 11. Pruebas

Unitarias (Vitest, junto a los módulos):

- `tipoUsuario`: `isTipoUsuario`, `tieneMetaDeHoras`.
- `userInput`: campos exigidos y descartados por tipo.
- `configRules`: `parseConfigForm` con los campos nuevos y `reglasPara` por tipo.
- `importRows`: columna Tipo ausente, válida, inválida y fila natural sin universidad.
- `marcacionResult`: SALIDA de natural sin meta.

## Fuera de alcance

- Reglas propias para colegio (por ejemplo, por ser menores de edad): `reglasPara` deja el
  punto de extensión, pero no se agregan ahora.
- Catálogo de entidades y sedes (4f) y reportes dedicados por tipo.

## Documentación

Actualizar `AGENTS.md` (modelo de datos, reglas de marcación por tipo) al implementar.
