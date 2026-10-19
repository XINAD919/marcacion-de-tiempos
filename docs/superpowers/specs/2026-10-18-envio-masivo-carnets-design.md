# Envío masivo de carnets y avisos (toasts) — diseño

Dos piezas, en este orden: **avisos de resultado (toasts) en toda la administración**, y el
**envío masivo de carnets virtuales**, que los usa.

## Por qué

- Con unos 2.700 practicantes, mandar el carnet uno por uno desde Editar usuario no es viable.
  Además, cada importación nueva deja otro grupo sin carnet. Y sin carnet no hay respaldo por
  QR cuando el rostro falla en el kiosko.
- Hoy cada pantalla muestra sus mensajes a su manera: dentro del formulario, en un diálogo o
  en ningún lado. La coordinadora no siempre sabe si lo que hizo quedó guardado.

## Metas

1. Toda acción de la administración confirma con un aviso si salió bien o mal.
2. Con un botón, enviar el carnet a **todos los pendientes**: usuarios activos, con correo y
   sin carnet enviado, de cualquier institución o sede. Esto aplica cada vez que haga falta,
   no solo la primera.
3. Respetar un tope de envíos por hora configurable, porque el proveedor de correo limita.
4. Mostrar el progreso, permitir pausar y reanudar, y que el envío siga aunque se cierre la
   pestaña.

## No metas

- No hay envío por institución o sede: siempre son todos los pendientes (decisión de la
  usuaria).
- No se reenvía a quien ya recibió su carnet. Para reponer uno sigue el «enviar uno nuevo»
  individual.
- No hay avisos en el kiosko: tiene su propia retroalimentación a pantalla completa y ningún
  control. Tampoco en el login, que ya muestra su error en el formulario (*decisión mía*).
- No se cambia el contenido del correo del carnet.

## Anti-metas

- Superar el límite del proveedor y que bloquee la cuenta de correo institucional.
- Que un reinicio del servidor deje el envío a medias sin forma de seguirlo, o que mande dos
  veces el mismo carnet.
- Avisos que repiten lo que ya dice el formulario, o que muestran texto técnico.

## Parte 1 — Avisos (toasts)

- **Componente:** `Sonner` de shadcn/ui (`pnpm dlx shadcn@latest add sonner`), con un único
  `<Toaster>` en `src/app/admin/layout.tsx`. Usa los tokens de `globals.css`: éxito con verde
  (`brand-green`), error con rojo y **siempre con texto explícito**, aviso o proceso en curso
  con ámbar. Nada de colores ni radios nuevos. Posición abajo a la derecha (*decisión mía*).
- **Duración** (*decisión mía*): éxito 4 s; error 8 s con botón para cerrarlo.
- **Texto:** en español llano y corto, diciendo qué pasó: «Usuario guardado», «Salida
  registrada», «No pudimos enviar el correo de prueba: el servidor rechazó la contraseña».
  El mensaje de error es el mismo `message` que las acciones ya devuelven.
- **Errores por campo:** se quedan junto al campo, como hoy. El aviso solo dice «Revisa los
  campos marcados» (*decisión mía*), para no repetir cada error.
- **Acciones que lo llevan** (inventario actual):
  - Correcciones (`src/app/admin/_correcciones/actions.ts`): registrar salida, registrar
    entrada, corregir hora, anular, restaurar y reasignar. La búsqueda de practicantes no
    lleva aviso.
  - Configuración (`configuracion/actions.ts`): guardar reglas, guardar SMTP y correo de
    prueba.
  - Instituciones y sedes: guardar institución y guardar sede.
  - Usuarios: guardar usuario (`usuarios/_form/actions.ts`) y enviar carnet
    (`carnet-actions.ts`).
  - Flujos con `fetch`: importar Excel (`importador.tsx`), enrolamiento
    (`enrolamiento.tsx`) y administradores (`admins-panel.tsx`).
  - Envío masivo (Parte 2): iniciar, pausar, reanudar y terminado.
- Un helper cliente común (p. ej. `notificar(result, { exito })`) decide el aviso a partir del
  resultado `{ ok, message?, errors? }` que ya usan las acciones, para que cada pantalla no
  invente el suyo.
- Si hoy una pantalla muestra un mensaje general de éxito o error dentro de la página, el
  aviso lo reemplaza. Los resúmenes con contenido propio se quedan: el resultado de la
  importación (tres cifras y tabla de errores) y la fecha de envío del carnet.

## Parte 2 — Envío masivo de carnets

### Quiénes son «pendientes»

Usuario `activo = true`, con `email` no vacío, cuyo `carnet_virtual` no existe o tiene
`enviado_en IS NULL`. El envío usa `sendCarnet(userId, { renovar: false })` de
`src/lib/server/carnet.ts`, que ya crea el token si falta, manda el correo y marca
`enviado_en` / `enviado_a`.

Activos sin correo: no se pueden enviar. Se cuentan y se listan antes de empezar, con enlace
a editar cada uno.

### Modelo de datos (nueva migración)

- `envio_carnets` (un envío masivo): id, iniciado_por_id (FK Admin), estado
  (`en-curso` | `pausado` | `terminado`), creado_en, terminado_en, total.
- `envio_carnet_item`: id, envio_id (FK), user_id (FK), estado (`pendiente` | `enviando` |
  `enviado` | `omitido` | `error`), motivo_error (NVARCHAR 300, en español llano), intentado_en.
  Único por `(envio_id, user_id)`.
- `configuracion` gana `carnets_por_hora` (entero, por defecto **100**, mínimo 1), editable en
  Configuración junto al SMTP.

**Instantánea** (*decisión mía*): al iniciar, se crea un item por cada pendiente de ese
momento. Quien quede pendiente después entra en el próximo envío masivo.

**Uno a la vez** (*decisión mía*): no se puede iniciar un envío si hay otro `en-curso` o
`pausado`. El botón lleva a ese envío.

### Cómo avanza (en el servidor)

- Un trabajador dentro del mismo proceso de Next.js lo arranca `src/instrumentation.ts`
  (`register()`, solo en runtime Node). No hay infraestructura extra: la app corre como **un
  único proceso `next start`** en el servidor de la fundación (AGENTS.md › Arquitectura). Si
  algún día hubiera dos procesos, el reclamo condicional de items evita duplicados.
- **Ritmo:** un envío cada `3600 / carnets_por_hora` segundos (100/h → uno cada 36 s). Antes
  de cada envío comprueba que en los últimos 60 min no se haya llegado al tope, contando
  **todos** los carnets enviados (`carnet_virtual.enviado_en`), incluidos los individuales.
  Si se llegó, espera. *Decisión mía:* tras Reanudar o un reinicio, el siguiente envío sale
  apenas se cumplan las dos condiciones (intervalo desde el último envío del lote y hueco en la
  ventana de 60 min). Un cambio de `carnets_por_hora` aplica desde el siguiente envío.
- **Seguro ante reinicios:** el estado vive en la base de datos. Al arrancar, el trabajador
  retoma el envío `en-curso`. Antes de enviar, cada item pasa de `pendiente` a `enviando`
  con un `UPDATE … WHERE estado = 'pendiente'` condicional, y se vuelve a comprobar que el
  usuario siga pendiente (pudo recibir su carnet de forma individual, cambiar de correo o
  inactivarse mientras tanto). Si ya no cumple, el item queda **`omitido`**, no cuenta como
  enviado por el lote y no se manda nada (*decisión mía*).
- **Caída a mitad de un envío** (*decisión mía*: se prefiere no duplicar): al arrancar, un item
  que lleve más de 10 min en `enviando` pasa a `error` con el motivo «No sabemos si el correo
  llegó: el servidor se reinició mientras se enviaba». No se reintenta solo. El usuario sigue
  pendiente, así que entra en el próximo envío masivo; en el peor caso recibe dos veces el
  mismo carnet, que sigue siendo válido.
- **Errores:** si falla un envío, el item queda `error` con el motivo traducido por
  `describeMailError`, y el usuario sigue pendiente para el próximo envío masivo.
- **Pausa automática** (*decisión mía*): `src/lib/server/mailer.ts` gana una función que
  clasifica el error de nodemailer como **global** (códigos `EAUTH`, `ECONNECTION`,
  `ETIMEDOUT`, `ESOCKET`, `EDNS`, o SMTP sin configurar) o **del destinatario** (`EENVELOPE`,
  respuestas 5xx a un destinatario y el resto). Al **primer** error global, el envío se pausa
  solo con el motivo guardado (campo `motivo_pausa` en `envio_carnets`), y ese item vuelve a
  `pendiente`. Un error del destinatario solo marca su item. Reanudar limpia el motivo.
- Al acabarse los items, el envío queda `terminado`.

### Pantalla

- **Usuarios** muestra el botón secundario **Enviar carnets pendientes (N)** en el
  encabezado, junto a Importar y Nuevo. N es el número de pendientes; sin pendientes, el botón
  se deshabilita con «Todos tienen su carnet».
- **Confirmación** (diálogo): «Se enviarán N carnets, a unos 100 por hora (unas H horas). M
  usuarios activos no tienen correo y no lo recibirán», más la lista de esos M con enlace a
  Editar. Botón primario **Empezar envío**.
- **Progreso** en `/admin/usuarios/carnets` (*decisión mía*): barra con `enviados / total`
  (verde) y cifras de enviados, pendientes, omitidos y con error, tiempo estimado restante, y botones
  **Pausar** / **Reanudar**. Tabla de errores con usuario, correo y motivo en español llano,
  con enlace a Editar. Se actualiza sola cada 10 s. Si hay un envío activo, Usuarios muestra
  un aviso con enlace a esta pantalla.
- Los avisos (Parte 1) confirman iniciar, pausar y reanudar. Si la pestaña está abierta, el
  fin del envío se ve en la propia pantalla.

## Restricciones

- Tokens de la marca de `AGENTS.md`, interfaz en español sin jerga, `tabular-nums` en las cifras.
- Toda server action verifica `auth()`. Cualquier administrador puede iniciar, pausar y
  reanudar: todavía no hay roles (AGENTS.md › Decisiones pendientes).
- Una pausa automática se ve en la pantalla de progreso (aviso ámbar con el motivo y qué
  revisar en Configuración) y en el aviso de Usuarios. No llega como toast, porque puede no
  haber nadie mirando.
- La contraseña SMTP sigue cifrada (`secretBox.ts`). El trabajador la lee igual que el envío
  individual.
- Pendiente de IT, no bloquea: confirmar el límite real del correo institucional y que la red
  deja salir a los puertos 587/465.

## Pruebas

- Vitest contra la BD de Docker:
  - cálculo de pendientes;
  - instantánea al iniciar;
  - «uno a la vez»;
  - que el reclamo condicional no duplique bajo dos trabajadores;
  - que el tope de 60 min cuente también los envíos individuales;
  - que un error de autenticación pause el envío.
  El envío de correo se simula inyectando la función de envío.
- El ritmo se prueba con relojes falsos (`vi.useFakeTimers`).
- E2e de Playwright: con SMTP simulado, iniciar un envío de 2 pendientes, ver el progreso y
  el aviso de inicio, y comprobar que ambos quedan con carnet enviado.
- Un e2e o prueba de componente comprueba que una acción existente (p. ej. guardar sede)
  muestra el aviso de éxito.

## Lo que queda al implementador

Nombres de archivos y componentes, cómo simular el SMTP en e2e, la forma exacta del helper de
avisos y la paginación de la tabla de errores. Al terminar, actualizar `AGENTS.md`: modelo de
datos, que ya no queda pendiente el envío masivo y la nueva regla de avisos en «Patrones de UI
establecidos».
