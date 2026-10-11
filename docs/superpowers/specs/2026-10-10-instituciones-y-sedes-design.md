# Instituciones y sedes (maqueta 4f)

Fecha: 2026-10-10 · Estado: aprobado en conversación, pendiente de revisión escrita

## Contexto

Hoy `User.universidad` y `User.entidad` son texto libre. Los desplegables de filtros y el
autocompletado del formulario salen de un `SELECT DISTINCT` sobre los usuarios
(`listFilterOptions`), así que cualquier variante de tipeo crea una "entidad" nueva sin que nadie
lo note.

La maqueta 4f ("Entidades y sedes") muestra en realidad **dos catálogos planos e independientes**:

- **Sedes:** lugar físico donde se practica (nombre, dirección, horario, practicantes).
- **Instituciones educativas:** de dónde viene el practicante (nombre, tipo, activos, horas
  exigidas).

Lo decidido con el usuario:

- El tipo universidad / técnica / colegio **vive en la institución**, no en el usuario.
  `User.tipo` se reduce a `practicante | natural`. Esto reemplaza el tipo de tres valores del
  spec `2026-10-10-tipos-de-usuario-design.md` (ya implementado) en modelo, formulario,
  filtros e importación; sus reglas para naturales no cambian.
- Los voluntarios naturales **no tienen institución ni sede**.
- La sede no guarda días de atención; solo horario de apertura y cierre.
- Sin "fusionar" duplicados: aún no hay datos reales; se edita e inactiva.
- Sin estado de kioskos en las tarjetas de sede.
- Vocabulario único en toda la UI: **Institución** y **Sede** (adiós "Entidad").

## 1. Modelo de datos (`prisma/schema.prisma`)

```prisma
model Institucion {
  id            Int     @id @default(autoincrement())
  nombre        String  @unique @db.NVarChar(150)
  // universidad | tecnica | colegio (src/lib/catalogo/institucion.ts)
  tipo          String  @db.VarChar(20)
  // Valor por defecto de horasRequeridas al asignarla; cada usuario conserva el suyo.
  horasExigidas Int     @default(0)
  activa        Boolean @default(true)
  usuarios      User[]
}

model Sede {
  id           Int     @id @default(autoincrement())
  nombre       String  @unique @db.NVarChar(150)
  direccion    String? @db.NVarChar(200)
  // Horario por defecto de sus practicantes, "HH:mm".
  horaApertura String? @db.VarChar(5)
  horaCierre   String? @db.VarChar(5)
  activa       Boolean @default(true)
  usuarios     User[]
}
```

`User`:

- Nuevos `institucionId Int?` y `sedeId Int?`, con relación e índice.
- Se eliminan `universidad` y `entidad`.
- `tipo` pasa a `practicante | natural` (`@default("practicante")`).

Regla (en TypeScript, no en la base): un practicante necesita institución y sede; un natural
guarda ambas en `NULL`. `tipo` de institución se valida igual que `exigenciaReconocimiento`
(sin enum ni `CHECK`).

La intercalación por defecto de SQL Server (`…_CI_AS`) no distingue mayúsculas: el `@unique`
de `nombre` impide "universidad nacional" si ya existe "Universidad Nacional".

### Migración (una sola, sin pérdida de datos)

1. Crear `Institucion` con los valores distintos de `LTRIM(RTRIM(universidad))` no vacíos.
   - `tipo`: el `User.tipo` más frecuente entre sus usuarios (`universidad` o `colegio`).
   - `horasExigidas`: el `horasRequeridas` más frecuente entre sus usuarios.
2. Crear `Sede` con los valores distintos de `LTRIM(RTRIM(entidad))` no vacíos; dirección y
   horario en `NULL`.
3. Llenar `institucionId` / `sedeId` cruzando por nombre recortado.
4. `UPDATE User SET tipo = 'practicante' WHERE tipo IN ('universidad', 'colegio')`.
5. Eliminar las columnas `universidad` y `entidad`.

## 2. Módulos puros (`src/lib/catalogo/`, nuevo)

- `institucion.ts`: `TIPOS_INSTITUCION` (`universidad`, `tecnica`, `colegio`),
  `TIPO_INSTITUCION_LABEL` (`Universidad`, `Técnica`, `Colegio`), `isTipoInstitucion`,
  `validateInstitucionInput` (nombre obligatorio ≤150, tipo válido, horas enteras ≥ 0).
- `sede.ts`: `validateSedeInput` (nombre obligatorio ≤150, dirección opcional ≤200, horas
  "HH:mm" opcionales; si vienen ambas, cierre posterior a apertura), `formatHorario`
  ("07:00 – 17:00" o "Sin horario").
- `nombres.ts`: `normalizeNombre` (sin tildes, minúsculas, espacios colapsados) y
  `buildCatalogIndex(items)` → `Map` de nombre normalizado → `{ id, activa }` para la
  importación.

`src/lib/usuarios/tipoUsuario.ts`:

- `TIPOS_USUARIO = ["practicante", "natural"]`, etiquetas `Practicante` / `Voluntario natural`.
- `parseTipoUsuario` acepta `practicante`, `universidad`, `universitario`, `tecnica`,
  `técnica`, `colegio` → `practicante`; `natural`, `voluntario`, `voluntario natural` →
  `natural`.
- `describeAfiliacion({ tipo, institucion, sede })` con los nombres de la relación →
  "Universidad Nacional · Sede Centro" o "Voluntario natural".
- `tieneMetaDeHoras` y `reglasPara` siguen preguntando solo por `natural`: sin cambios de
  comportamiento.

## 3. Pantalla "Instituciones y sedes" (`src/app/admin/instituciones-y-sedes/`)

- Menú: "Entidades y sedes" → **"Instituciones y sedes"**, `href` a la ruta nueva.
- Encabezado: título, subtítulo "Dónde practican y desde qué instituciones vienen",
  **+ Agregar institución** (secundario) y **+ Agregar sede** (primario).
- **Tarjetas de sede** en grilla `repeat(auto-fill, minmax(300px, 1fr))`: nombre, dirección,
  "Editar", PRACTICANTES (usuarios activos asignados, cifra tabular) y HORARIO
  (`formatHorario`). Sin bloque de kioskos.
- **Tabla de instituciones**: NOMBRE · TIPO · ACTIVOS · HORAS EXIGIDAS · Editar; filas alternas
  `row-alt`, 15 px de padding vertical, cifras tabulares a la derecha.
- Inactivas al final de su grupo, atenuadas, con la píldora `inactivo` existente.
- Estado vacío por grupo: "Aún no hay sedes" / "Aún no hay instituciones" con su botón.
- Conteos con dos `groupBy` de Prisma sobre `User` (`activo = true`) por `sedeId` e
  `institucionId`; nunca una consulta por tarjeta.
- Correcciones a la maqueta: etiquetas en versalitas con `rgba(19,30,61,.62)` (≈4,8:1, la
  maqueta usa `.55` ≈3,8:1) y "Editar" con área clicable de al menos 24 px de alto.

### Crear / editar (modal)

`Dialog` de shadcn con server actions que verifican la sesión y validan con los módulos puros.

- Institución: nombre, tipo (selector segmentado Universidad / Técnica / Colegio), horas
  exigidas; al editar, además "Activa".
- Sede: nombre, dirección (opcional), hora de apertura, hora de cierre; al editar, además
  "Activa".
- Nombre repetido (violación del `@unique`) → "Ya existe una institución con ese nombre" /
  "Ya existe una sede con ese nombre".

**Inactivar, no borrar.** No hay acción de eliminar. Una inactiva sale de los desplegables y de
la importación, pero sus usuarios la conservan.

## 4. Formulario de usuario (`src/app/admin/usuarios/_form/`)

- Selector **Tipo de usuario**: Practicante / Voluntario natural.
- Bloque "Práctica" (solo practicantes):
  - **Institución**: combobox con búsqueda (`Command` + `Popover` de shadcn), agrupado
    Universidades / Técnicas / Colegios. Se envía `institucionId`.
  - **Sede**: `Select`. Se envía `sedeId`.
  - Opciones: las activas, más la actual del usuario si está inactiva, rotulada
    "Nombre (inactiva)".
  - Enlace bajo los campos: "¿No está en la lista? Agrégala en Instituciones y sedes".
- **Precarga:** al elegir institución se llenan las horas requeridas con `horasExigidas`; al
  elegir sede, hora de inicio / fin con apertura / cierre. Solo si el campo está vacío o aún
  tiene el último valor precargado (se guarda en estado y se compara), para no pisar lo escrito
  a mano.
- Las páginas `nuevo` y `[userId]/editar` cargan el catálogo con un `listCatalogo()` en vez de
  `listFilterOptions()`.

Validación:

- `userInput.ts`: los campos `universidad` / `entidad` pasan a `institucionId` / `sedeId`
  (enteros positivos). Practicante sin ellos → "Elige la institución" / "Elige la sede".
  Natural: se descartan aunque lleguen.
- `usuarioService` (create/update) confirma que existan y estén activas, o que sean las que el
  usuario ya tenía. Si no → "Esa institución ya no está disponible; elige otra" (ídem sede).

## 5. Listado y filtros (`src/app/admin/usuarios/`, `src/lib/usuarios/filters.ts`)

- Columnas **Institución** y **Sede** ("—" para naturales).
- Filtros con el patrón de chips existente, alimentados por el catálogo:
  - **Tipo**: Universidad · Técnica · Colegio · Voluntario natural. Los tres primeros filtran por
    `institucion.tipo`; el último por `User.tipo = 'natural'`.
  - **Institución** y **Sede**: todas las del catálogo que tengan usuarios o estén activas.
- URL con IDs: `?tipo=colegio&institucion=3&sede=2`. `parseUsuarioFilters` descarta IDs que no
  sean enteros positivos.
- `listFilterOptions` (DISTINCT sobre usuarios) se elimina.

## 6. Afiliación: kiosko, carnet y enrolamiento

`marcacionService`, `carnet.ts` y `enrolar/[userId]/page.tsx` incluyen
`institucion: { select: { nombre } }` y `sede: { select: { nombre } }` y pasan esos nombres a
`describeAfiliacion`. Sin cambios visibles.

## 7. Importación (`src/lib/usuarios/importRows.ts`, `api/usuarios/importar`)

- Columnas: **"Institución"** (alias `institución`, `universidad / colegio`, `universidad`,
  `colegio`) y **"Sede"** (alias `sede`, `entidad`, `entidad donde practica`).
- `classifyImportRows(rows, cedulasExistentes, catalogo)` recibe los índices de
  `buildCatalogIndex`; la ruta los carga con una consulta por catálogo.
- Búsqueda por `normalizeNombre`. **Nunca se crean** instituciones ni sedes desde el archivo:
  - "La institución «X» no existe. Agrégala en Instituciones y sedes o corrige el nombre."
  - "La sede «X» no existe. Agrégala en Instituciones y sedes o corrige el nombre."
  - "La institución «X» está inactiva." / "La sede «X» está inactiva."
- Columna "Tipo" con `parseTipoUsuario`; ausente o vacía → `practicante`. No reconocido →
  "El tipo debe ser Practicante o Natural".
- Valores por defecto: "Horas requeridas" vacía → `horasExigidas` de la institución; horario
  vacío → apertura / cierre de la sede.
- Plantilla (`importar/plantilla`): columnas "Institución" y "Sede", con nombres del catálogo
  como ejemplo si existen.

## 8. Pruebas

Unitarias (Vitest, junto a los módulos):

- `catalogo/institucion` y `catalogo/sede`: validación y `formatHorario`.
- `catalogo/nombres`: `normalizeNombre` (tildes, mayúsculas, espacios) y `buildCatalogIndex`.
- `tipoUsuario`: `parseTipoUsuario` con los alias nuevos, `describeAfiliacion`.
- `userInput`: practicante sin institución / sede, natural que las descarta.
- `filters`: tipo, institución y sede; IDs inválidos.
- `importRows`: institución / sede inexistente, inactiva, alias de columnas viejas, horas y
  horario por defecto, tipo ausente.

E2E (Playwright, `e2e/`): crear sede e institución, crear practicante eligiéndolas y ver la
precarga, filtrar el listado por sede.

Migración: correrla sobre la base de desarrollo con datos sembrados que incluyan variantes de
mayúsculas y espacios; verificar que se unan y que ningún practicante quede con
`institucionId` o `sedeId` en `NULL`.

## Fuera de alcance (quedan como pendientes en AGENTS.md)

- Estado de los kioskos por sede (va con el identificador por kiosko).
- Fusionar instituciones o sedes duplicadas.
- Días de atención de la sede.
- Reportes por institución o sede (módulo 3).

## Documentación

Al implementar, actualizar `AGENTS.md`: modelo de datos (`Institucion`, `Sede`, `User.tipo`
`practicante | natural`), vocabulario Institución / Sede, pendiente 4f marcado y los nuevos
pendientes. Anotar en `2026-10-10-tipos-de-usuario-design.md` que su modelo de tipo quedó
reemplazado por este spec.
