# Módulo de Reportes — diseño

Cubre el tercer módulo del planteamiento (reportes) y el objetivo específico 3:
*automatizar el cálculo y la verificación de horas cumplidas y restantes de cada
practicante*. Es la pantalla `/admin/reportes` del menú **Análisis › Reportes**.

## Qué muestra

- **Resumen** con cuatro tarjetas (practicantes, en curso, por finalizar,
  completados). Cada tarjeta es un enlace que filtra por ese estado.
- **Tabla** por practicante: nombre y cédula, universidad/colegio, entidad,
  avance de horas (`126 / 240 h` con barra), horas restantes, última marcación
  (fecha, hora y si fue entrada o salida) y estado.
- **Filtros** siempre visibles: búsqueda por nombre o cédula, universidad/colegio,
  entidad y estado. Paginación de 20 filas, igual que Usuarios.
- **Exportar a Excel** (`/api/reportes/export`): mismas filas y filtros de la
  pantalla, sin paginar. Horas como número para poder sumarlas en Excel.

## Reglas

- **Las horas no se guardan.** Se derivan de `attendance_logs` con `sumWorkedMs`,
  la misma función que usa el kiosko al marcar la salida, con el tope de
  "Jornada máxima por día" de Configuración. El número de la coordinadora es el
  que vio el practicante.
- **Estados** (mutuamente excluyentes, en este orden de prioridad):
  1. *Completado*: horas cumplidas ≥ horas requeridas (aunque lo hayan inactivado
     al cerrar la práctica).
  2. *Inactivo*: dejó la práctica sin cumplir sus horas.
  3. *Por finalizar*: ya cumplió el 90 % o más y aún le faltan horas.
  4. *En curso*: el resto.
- **Truncado, nunca redondeado:** 59 min son 0,9 h y 239,9 de 240 h son 99 %. No se
  muestra tiempo que no se ha cumplido.
- **Color de la barra** por tramo (AGENTS.md › Progreso de horas): verde ≥ 50 %,
  ámbar 25–49 %, rojo < 25 %; siempre acompañado del número.
- Una entrada sin salida no suma (jornada en curso o salida olvidada), igual que
  en el resto de la app.
- Un practicante sin horas requeridas (filas anteriores a que el formulario las
  exigiera) muestra "Sin horas definidas" y nunca queda Completado.

## Arquitectura

| Capa | Archivo |
|---|---|
| Reglas de avance y estados (puro) | `src/lib/reportes/progress.ts` |
| Fila del reporte y resumen (puro) | `src/lib/reportes/rows.ts` |
| Filtros y URLs (puro) | `src/lib/reportes/filters.ts` |
| Filas de Excel (puro) | `src/lib/reportes/exportRows.ts` |
| Consulta a SQL Server | `src/lib/server/reporteService.ts` |
| Pantalla | `src/app/admin/reportes/page.tsx`, `filters-bar.tsx` |
| Barra de avance | `src/components/admin/progress-bar.tsx` |
| Descarga | `src/app/api/reportes/export/route.ts` |

Reutiliza `whereFor` (filtro de usuarios), `getConfig`, `sumWorkedMs`,
`buildWorkbook`, `PageHeader`, `Table` y las píldoras de estado existentes. No
agrega colores, fuentes ni radios nuevos. La ruta queda protegida por
`proxy.ts` (solo es pública lo listado en `publicPaths.ts`) y la descarga vuelve
a comprobar la sesión.

## Fuera de alcance / pendiente

- Filtro por **periodo** (el planteamiento menciona estadísticas por periodo).
- **Rendimiento:** cada consulta lee las marcaciones de todos los practicantes del
  filtro y calcula en memoria. Medir en el piloto con el volumen real (~2.700);
  si hace falta, cachear el resultado o guardar un resumen por día.
- Confirmar con la fundación el umbral de "por finalizar" (hoy 90 %,
  `NEAR_COMPLETION_RATIO`) y cómo mostrar a quien está inactivo sin completar.
- Vista de detalle del practicante con su historial (maqueta 4d).
