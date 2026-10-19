# Perfil del practicante, correcciones manuales y Marcaciones de hoy — diseño

Cubre las maquetas **4d** (detalle del practicante con historial) y **4e** (corrección
manual de marcaciones) y la pantalla **Marcaciones de hoy** del menú *Operación*, que hoy
aparece deshabilitada (`href: null` en `src/components/admin/nav-config.ts`).

El envío masivo de carnets virtuales es un proyecto aparte (documento propio).

## Por qué

Hoy el kiosko rechaza la salida anticipada y le pide al practicante «hablar con
coordinación», y una salida olvidada deja la entrada abierta sin sumar horas. Pero
coordinación no tiene dónde registrar ninguna de las dos: las horas de ese día se
pierden. Tampoco hay forma de arreglar una marcación equivocada (p. ej. una entrada que el
kiosko le asignó a otra persona). Sin esto, el sistema no puede reemplazar al Excel como
fuente de verdad.

## Metas

1. Ver el perfil de un practicante con sus horas y su historial día por día.
2. Registrar desde el perfil una **salida temprana** de la jornada abierta de hoy.
3. Listar y resolver las **salidas sin marcar** (entradas de días anteriores sin salida)
   tanto en el perfil como en una lista general de todos los practicantes.
4. **Corregir la hora** o **anular** una marcación equivocada.
5. Ver en **Marcaciones de hoy** todo lo que se marcó hoy, las novedades y los pendientes.

## No metas

- No se registran los intentos bloqueados de salida anticipada en el kiosko (siguen sin
  guardarse; decisión de la usuaria).
- No se crean entradas manuales (alguien que nunca marcó entrada). *Decisión mía:* el
  caso pedido es siempre una salida que falta; si aparece la necesidad se agrega luego.
- Sin roles: todo administrador puede corregir (los roles de 4g siguen pendientes).
- No se toca el «Cierre automático sin salida» de 4g.

## Anti-metas (sería un fracaso aunque funcione)

- Que una corrección **borre o sobrescriba** datos sin dejar rastro: debe saberse siempre
  qué marcó el kiosko, qué cambió coordinación, quién y por qué.
- Que las horas mostradas en el perfil, en Reportes y en el kiosko no coincidan: todas
  salen de la misma función (`sumWorkedMs`) sobre los mismos registros válidos.
- Mensajes técnicos o códigos de error para la coordinadora.

## Modelo de datos

Se amplía `attendance_logs` (nueva migración Prisma). Nada se borra nunca.

| Campo nuevo | Tipo | Uso |
|---|---|---|
| `metodo` | ya existe | se agrega el valor `"manual"` además de `face` / `qr` |
| `registradoPorId` | `String?` FK → `Admin` | quién creó la marcación manual; `NULL` si la hizo el kiosko |
| `motivo` | `String?` (NVARCHAR 300) | motivo de la marcación manual (obligatorio en manuales) |
| `anuladaEn` | `DateTime?` | si no es `NULL`, la marcación no cuenta para nada |
| `anuladaPorId` | `String?` FK → `Admin` | quién la anuló |
| `motivoAnulacion` | `String?` (NVARCHAR 300) | por qué (obligatorio al anular) |
| `reemplazaAId` | `String?` FK → `attendance_logs.id` | en una corrección de hora, la marcación original que reemplaza |

`deviceId` de las manuales: `"coordinacion"`.

**Corregir la hora** (*decisión mía*) = anular la original con motivo y crear una nueva
manual con la hora correcta y `reemplazaAId` apuntando a la original, en una transacción.
Así la original queda intacta para auditoría sin tabla aparte.

**Regla transversal:** toda consulta que alimente horas, tipo de la siguiente marcación,
reportes, exportaciones o Marcaciones de hoy filtra `anuladaEn: null`. Hoy las consultas
están en `marcacionService.ts` (2) y `reporteService.ts` (1); conviene un único
`where` exportado (p. ej. `MARCACION_VALIDA`) para que una consulta nueva no lo olvide.

## Qué es una «salida sin marcar»

Una `IN` válida de un día **anterior a hoy** que no tiene una `OUT` válida posterior antes
de la siguiente `IN` (o del fin de los registros). Se deriva, no se guarda. Incluye
**todos los días anteriores**, no solo ayer (un viernes olvidado se ve el lunes). La `IN`
abierta de hoy no es pendiente: es la jornada en curso.

También es inconsistencia una **salida sin entrada**: una `OUT` válida sin `IN` válida
previa ese día (p. ej. tras anular solo la entrada). Aparece en «Por corregir» con la
acción **Registrar entrada** o **Anular** (*decisión mía*).

**Quién entra en las listas** (*decisión mía*): solo usuarios **activos**, practicantes y
naturales por igual. Un inactivo con pendientes se ve en su perfil, no en la lista
general. Sin fecha de corte.

**Rendimiento:** la lista general se pinta en cada refresco de Marcaciones de hoy; no debe
cargar todos los registros de todos en memoria como hace hoy `reporteService`. El
implementador elige la consulta (p. ej. solo la última marcación válida por usuario y día),
con el índice `[userId, marcadoEn]` existente.

Se calcula con una función pura nueva junto a `sumWorkedMs` (mismo recorrido de pares),
p. ej. `openEntries(marks)` en `src/lib/server/workedTime.ts` o un módulo hermano.

## Acciones de corrección (server actions con `auth()`)

Todas validan sesión de administrador activo, escriben el `Admin` de la sesión y
devuelven errores en español llano.

1. **Registrar salida temprana** — solo si hay `IN` abierta hoy. Pide hora (por defecto
   ahora, editable) y motivo. La hora debe ser posterior a la entrada y no futura. **No**
   aplica «Tiempo mínimo antes de la salida»: esa regla existe para el kiosko.
2. **Registrar salida olvidada** — sobre una salida sin marcar. Pide hora y motivo; por
   defecto sugiere la `hora_fin` del horario asignado de ese día. La hora debe ser
   posterior a la entrada, del mismo día y anterior a la siguiente marcación válida.
3. **Corregir hora** — de cualquier marcación válida. Pide nueva hora y motivo; la nueva
   hora debe mantener el orden con la marcación anterior y la siguiente del mismo día.
4. **Anular** — de cualquier marcación válida. Pide motivo y confirmación. Si se anula una
   `IN` cuya `OUT` sigue válida, esa `OUT` queda huérfana y no suma; *decisión mía:* el
   diálogo lo advierte y ofrece anular ambas.

5. **Restaurar** — de una marcación anulada por error (*decisión mía*). No borra la
   anulación: crea una copia manual de la original con `reemplazaAId` apuntando a ella y
   motivo obligatorio. Así el rastro queda completo.
6. **Registrar entrada** — solo sobre una *salida sin entrada* (ver abajo). Pide hora y
   motivo. Es la única entrada manual permitida (*decisión mía*).

7. **Reasignar a otro practicante** (decisión de la usuaria) — de cualquier marcación
   válida que el kiosko le asignó a la persona equivocada. Pide el practicante correcto
   (buscador por nombre o cédula) y motivo. En una transacción: anula la original y crea una
   copia manual (mismo `tipo` y `marcadoEn`) para el practicante correcto, con
   `reemplazaAId` apuntando a la original. Valida que la copia no rompa el orden de las
   marcaciones del destino ese día; si lo rompe, lo explica y no hace nada.

Las validaciones de orden/horas son funciones puras con pruebas (Vitest), como
`markingRules.ts`.

Tras cada acción: `revalidatePath` del perfil, Marcaciones de hoy y Reportes.

## Pantallas

Validadas con mockups en la sesión (`.superpowers/brainstorm/`). Se construyen con shadcn/ui
y los tokens de `globals.css`; nada de colores o radios nuevos.

### Perfil del practicante — `/admin/usuarios/[userId]`

- Encabezado: nombre, cédula, institución · sede, horario, píldora de estado y botón
  secundario **Editar datos** (lleva a la pantalla de edición existente).
- **Aviso de jornada abierta** (solo si hay `IN` abierta hoy): borde izquierdo ámbar,
  «Jornada abierta hoy: entrada a las 7:04», botón primario **Registrar salida temprana**.
- Tarjeta de **avance**: anillo `conic-gradient` con %, `126 / 240 h`, horas restantes y
  fin estimado (reutilizar `progress.ts` / `rows.ts`). Voluntarios naturales: solo horas
  acumuladas, sin meta ni anillo.
- Bloque **Por corregir** con contador: cada salida sin marcar con día, entrada y acción
  **Registrar salida**. Texto: «No suman horas hasta corregirlas». Vacío: no se muestra.
- **Historial de marcaciones** agrupado por día, más reciente primero: entrada (hora ·
  método), salida (hora · método o «Sin salida» en ámbar), jornada del día, notas
  (píldora «N min tarde», «Salida temprana: <motivo> · registró <admin>», «Corregida»).
  Cada marcación tiene acciones **Corregir hora** / **Anular**. Las anuladas se muestran
  tachadas con su motivo, plegadas tras «Ver anuladas» (*decisión mía*). Paginación por
  días (p. ej. 30 días por página).

En el listado de Usuarios, el nombre enlaza al perfil; la acción de fila (`Editar` /
`Enrolar`) se mantiene como está.

### Marcaciones de hoy — `/admin/marcaciones`

- Título y fecha; se actualiza sola (reutilizar `auto-refresh.tsx` de Reportes).
- Filtros siempre visibles por **sede** e **institución** (chips como en el resto).
- Cinco cifras: dentro ahora · ya salieron · llegadas tarde · salidas tempranas · salidas
  sin marcar (días anteriores, borde rojo).
- **Salidas sin marcar** (lista general, todos los practicantes): practicante (enlace al
  perfil), día, entrada, horario, acción **Registrar salida** en el mismo lugar (diálogo),
  sin entrar al perfil. Muestra las más recientes con «Ver todas» que expande/pagina.
- **Marcaciones de hoy**: hora, practicante, tipo (ENTRADA/SALIDA), método, novedad.
  Alternador **Todas / Solo novedades**.
- **Novedades** (decisión de la usuaria): llegada tarde, salida temprana, salida corregida
  a mano, marcación con QR.
- **Salida temprana** (decisión de la usuaria) = cualquier `OUT` válida de hoy, del kiosko
  o manual, anterior a la `hora_fin` del usuario (o la `hora_cierre` de su sede si no
  tiene). Sin hora de fin conocida no se clasifica como temprana. Se deriva, nunca se
  guarda, igual que la llegada tarde. Una salida manual que no es temprana cuenta como
  *corregida a mano*.

Relación con **Reportes › Asistencia de hoy**: esa vista es por persona (quién vino, quién
no); Marcaciones de hoy es por evento y es donde se actúa. Ambas se mantienen.

Menú: `marcaciones` pasa a `href: "/admin/marcaciones"`.

## Pruebas

- Vitest para lo puro: salidas sin marcar, validaciones de hora de cada acción,
  clasificación de novedades, que lo anulado no suma.
- Pruebas de las server actions/servicios al estilo de las existentes (`*.test.ts`).
- Un e2e de Playwright: entrada abierta de ayer → aparece en Marcaciones de hoy → se
  registra la salida → aparece en el historial y suma horas.

## Lo que queda al implementador

Nombres de archivos y componentes, forma de los diálogos, paginación exacta y cómo
compartir las consultas entre perfil, Marcaciones de hoy y Reportes. Actualizar
`AGENTS.md` (modelo de datos, pendientes 4d/4e marcados) al terminar.
