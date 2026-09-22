<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Este archivo se debe mantener actualizado a medida
que se tomen nuevas decisiones técnicas o cambien los requisitos.

## Contexto del proyecto

Proyecto de práctica universitaria para una fundación (ONG). La fundación gestiona
aproximadamente **2.700 practicantes** (estudiantes de escuelas y universidades) y actualmente
lleva el control de sus horas de práctica en **papel + un Excel en Drive**, un proceso manual,
lento y sin trazabilidad confiable.

El proyecto reemplaza ese proceso por una **aplicación web interna** de control de tiempos con
**reconocimiento facial** como método principal de marcación (definido junto con la usuaria/cliente
tras reunión de descubrimiento), con **QR del carnet estudiantil** como método de respaldo si el
reconocimiento facial falla.

### Restricciones de contexto real (no negociables)

- Los estudiantes **no tienen ni tendrán acceso** a la red interna de la fundación desde sus
  propios dispositivos. Toda marcación se hace desde PCs que la fundación dispone físicamente
  ("kioskos"), cada uno con su propia cámara web.
- La aplicación se despliega en **un único PC/servidor dentro de la red interna** de la fundación;
  los demás PCs de marcación la consumen por red interna (no hay acceso público a internet).
- SQL Server puede alojarse en los servidores propios de la fundación.
- Se descartó el uso de un huellero USB existente (antiguo, requeriría SDK/servicio nativo por PC)
  a favor de reconocimiento facial vía navegador, que no requiere instalación nativa por equipo.
- La aplicación debe soportar **crecimiento indefinido de usuarios** — no debe requerir eliminar
  usuarios para poder registrar nuevos.
- Excel de Drive se **migra completamente** a la base de datos y se deprecia como fuente de verdad
  (acordado con la cliente, condición: sin doble digitación de datos).
- Existe un CRM en la fundación con algunos datos de estudiantes — no explorado en detalle aún,
  posible integración futura pendiente de definir.

## Stack técnico

- **Frontend/Backend:** Next.js (App Router), TypeScript
- **Componentes UI:** shadcn/ui + Tailwind CSS (estándar desde el módulo de login/administradores).
  Por ahora se usa el tema por defecto de shadcn (sin cablear los tokens de marca de la sección
  "Imagen de marca y sistema de diseño" de este archivo); eso queda para una sesión dedicada a
  brandear toda la app de una vez, incluidas las pantallas que ya existen.
- **Manejo de estado:** Zustand
- **Base de datos:** SQL Server
- **Reconocimiento facial:** por definir entre `face-api.js` (100% cliente, sin backend adicional,
  MVP recomendado para el alcance de la práctica) o InsightFace/ArcFace vía microservicio FastAPI
  (mayor precisión, camino de evolución a futuro)
- **Autenticación (admin):** NextAuth.js
- **Importación de datos:** SheetJS (`xlsx`) para migración e importación desde Excel
- **Despliegue:** reverse proxy con HTTPS interno (certificado propio vía CA local, ej. `mkcert`)
  dentro de la red de la fundación — requisito crítico, ver sección de arquitectura

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│              Servidor (PC de la fundación)                │
│                                                             │
│  Reverse proxy (HTTPS con CA interna)                      │
│         │                                                  │
│         ▼                                                  │
│  Next.js (App Router)                                      │
│    ├── /marcacion   (kiosko: cámara + matching facial)     │
│    ├── /admin       (CRUD usuarios, importar Excel)        │
│    ├── /reportes    (tabla + export Excel)                 │
│    └── /api/*       (route handlers)                        │
│         │                                                  │
│         ▼                                                  │
│  SQL Server (servidores de la fundación)                   │
└─────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ HTTPS              │ HTTPS              │ HTTPS
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │  PC #2  │          │  PC #3  │          │  PC #N  │
   │ + webcam│          │ + webcam│          │ + webcam│
   │ kiosko  │          │ kiosko  │          │ kiosko  │
   └─────────┘          └─────────┘          └─────────┘
```

### Por qué HTTPS interno es un requisito crítico (no un detalle opcional)

El acceso a cámara (`getUserMedia`) en el navegador solo funciona en contexto seguro (HTTPS o
`localhost`). Sin HTTPS interno, la cámara solo funcionaría en el PC que aloja la app, rompiendo
el modelo de varios kioskos consumiendo un servidor central. Está pendiente de validar factibilidad
con el equipo de IT de la fundación (permisos de administrador en PCs cliente, DNS/hosts interno,
IP fija del servidor).

## Estructura de carpetas sugerida

```
src/
├── app/
│   ├── marcacion/
│   │   └── page.tsx                    # kiosko: captura + matching + feedback
│   ├── admin/
│   │   ├── usuarios/
│   │   │   ├── page.tsx                # listado + CRUD
│   │   │   └── importar/page.tsx       # importar Excel
│   │   └── enrolar/[userId]/page.tsx   # captura de rostro (3-5 fotos)
│   ├── reportes/
│   │   └── page.tsx                    # tabla con filtros + export
│   └── api/
│       ├── marcacion/route.ts
│       ├── usuarios/route.ts
│       ├── usuarios/importar/route.ts
│       └── reportes/export/route.ts
├── lib/
│   ├── faceMatcher.ts
│   ├── db.ts                           # cliente SQL Server
│   └── excel.ts                        # parseo/export con SheetJS
└── store/
    └── kioskoStore.ts                  # Zustand: estado de captura/feedback
```

## Módulos funcionales

1. **Marcación (kiosko):** vista fullscreen con cámara activa, detección y matching facial
   automático contra los usuarios enrolados, feedback inmediato de éxito/fallo, fallback a QR
   del carnet si el reconocimiento falla repetidamente.
2. **Administración:** CRUD de practicantes (crear, listar, editar, inactivar), importación
   masiva desde Excel con reporte de insertados/duplicados/errores, pantalla de enrolamiento
   facial (captura de 3-5 fotos por usuario para mejorar precisión del matching).
3. **Reportes:** tabla filtrable por universidad/entidad/estado con horas cumplidas, horas
   restantes y última marcación por practicante; identificación de próximos a finalizar;
   exportación a Excel.

## Modelo de datos (borrador, SQL Server)

- `users`: id, cedula, nombre, email, universidad, entidad, horas_requeridas, activo, fecha_registro
- `face_embeddings`: id, user_id (FK), embedding (VARBINARY), modelo, fecha_captura
- `attendance_logs`: id, user_id (FK), tipo (IN/OUT), metodo (face/qr), confianza, device_id, marcado_en

Las horas cumplidas se calculan a partir de `attendance_logs` (pares IN/OUT), no se guardan como
campo persistente, para evitar inconsistencias.

## Imagen de marca y sistema de diseño

Las maquetas aprobadas son la fuente de verdad visual. Mantener estos valores al construir la UI
real; si algo no está definido aquí, derivarlo de estos tokens antes de inventar valores nuevos.

**Referencia:** `Control de Tiempos.dc.html` (maquetas) y `Control de Tiempos Deck.dc.html`
(presentación) en este proyecto.

### Principio

Institucional, confiable y cálido — es una ONG, no una corporación. Funcional y limpio:
**la legibilidad manda sobre la decoración**. Sin gradientes decorativos, sin emoji, sin sombras
llamativas, sin iconografía inventada. Dos superficies de fondo como máximo por pantalla.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `navy` | `#131e3d` | Color base de marca: barra lateral, encabezados, fondo del kiosko, texto principal |
| `navy-2` | `#1b2a52` / `#0f1831` | Variantes de superficie sobre navy (paneles, pies de tarjeta) |
| `red` | `#cf1f2e` | Acento de marca: acción primaria, enlaces, estado *no reconocido* |
| `red-ink` | `#a5141f` | Texto rojo sobre fondo claro (contraste AA) y hover de enlaces |
| `green` | `#1f7a4d` | **Solo éxito**: marcación registrada, exportar a Excel, progreso saludable |
| `green-ink` | `#14603a` | Texto verde sobre fondo claro |
| `amber` | `#d98c1f` | **Solo proceso en curso / advertencia**: detectando, llegada tarde, progreso bajo |
| `amber-ink` | `#8a5510` | Texto ámbar sobre fondo claro |
| `bone` | `#f6f4ef` | Fondo de aplicación (módulos de admin y reportes) |
| `bone-2` | `#f1eee8` | Encabezados de tabla, fondo de sección |
| `row-alt` | `#fbfaf7` | Filas alternas de tabla |
| `white` | `#ffffff` | Tarjetas, superficie de tabla |
| `border` | `rgba(19,30,61,.12)` | Bordes de tarjetas y tablas |

Jerarquía de texto sobre fondo claro: `#131e3d` → `rgba(19,30,61,.7)` → `rgba(19,30,61,.55)`.
Sobre navy: `#fff` → `rgba(255,255,255,.72)` → `rgba(255,255,255,.5)`.

**Regla de semántica de color:** verde nunca decora, solo confirma. Ámbar nunca es error, solo
proceso o advertencia. Rojo es a la vez acento de marca y error — en contexto de error va siempre
acompañado de texto explícito, nunca solo color.

### Tipografía

- **Familia única:** `Archivo` (Google Fonts), pesos 400/500/600/700/800.
- **Cifras:** `font-variant-numeric: tabular-nums` obligatorio en horas, cédulas, contadores y
  cualquier columna numérica — evita que los números "salten" al actualizarse.
- **Monoespaciada:** `IBM Plex Mono` solo para etiquetas técnicas menores (encabezados de sección
  en la barra lateral, marcas de placeholder). Nunca para contenido.
- Títulos con `letter-spacing: -.02em` a `-.035em`; etiquetas en versalitas con `letter-spacing`
  positivo (`.08em`–`.26em`).

Escala por contexto:

| Contexto | Tamaños |
|---|---|
| Kiosko — mensaje principal | 46–76 px, peso 700/800 |
| Kiosko — hora / dato clave | 54–92 px, peso 800, tabular |
| Kiosko — texto de apoyo | 20–26 px, **nunca menos de 20 px** |
| Admin — título de página | 27 px / 700 |
| Admin — texto de tabla | 14–14,5 px |
| Admin — encabezado de tabla | 11,5 px / 600 / versalitas |
| Admin — cifras de resumen | 38–40 px / 800 tabular |

### Formas y espaciado

- Radios: `6 px` controles e inputs · `8–12 px` tarjetas y modales · `999px` chips y píldoras de estado.
- Bordes de `1px` (`1.5px` en botones secundarios e inputs) antes que sombras. Sombra solo para
  elevación real (modales, tarjeta flotante sobre la cámara).
- Sin sombras de color ni glow.
- Barra lateral de admin: `236 px` fija, fondo navy, sección activa en rojo.
- Densidad de tabla **cómoda**: `15–17 px` de padding vertical por fila, filas alternas en `row-alt`.
- Layouts con flex/grid y `gap`; nunca márgenes sueltos entre hermanos.

### Patrones de UI establecidos

- **Botones:** primario = fondo `red`, texto blanco · exportar = fondo `green` · secundario =
  borde `1.5px rgba(19,30,61,.25)`, texto navy, fondo blanco · deshabilitado = fondo
  `rgba(19,30,61,.15)`, texto `rgba(19,30,61,.45)`.
- **Píldoras de estado:** Activo = `#e3f1e9` / `#14603a` · Inactivo = `#f0ece5` /
  `rgba(19,30,61,.6)` · Sin rostro = `#fbeedd` / `#8a5510`.
- **Filtros:** siempre visibles bajo el título, nunca detrás de un menú. El filtro aplicado se
  muestra como chip con `✕` y borde navy; los no aplicados con borde tenue y `▾`.
- **Progreso de horas:** barra de `8 px` (`radius 4px`, pista `#eceae4`) dentro de tablas; anillo
  con `conic-gradient` para tarjetas destacadas. Color por tramo: `green` ≥50 %, `amber` 25–49 %,
  `red` <25 %. Siempre acompañado del número (`126 / 240`), nunca solo la barra.
- **Acciones de tabla:** una sola acción textual en rojo por fila, alineada a la derecha; cambia
  según el estado (`Editar` / `Enrolar`).
- **Errores de importación:** resumen en tres cifras (insertados / duplicados / con error) y luego
  tabla de detalle con **fila, dato y motivo en español llano** ("La cédula tiene letras"), más
  descarga de las filas fallidas. Nunca códigos de error ni mensajes de excepción crudos.

### Reglas específicas del kiosko

- Pantalla completa sobre navy, **sin ningún control de administración visible**.
- Guía de rostro: óvalo `border-radius: 50%/46%`, ~`340×440 px`. Punteado blanco pulsando en
  espera; sólido ámbar con halo al detectar.
- El feedback ocupa la pantalla y **el color comunica antes que el texto**: verde = registrado,
  rojo = no reconocido. Se debe entender en 1–2 segundos a distancia.
- Éxito muestra siempre: nombre, hora y tipo (ENTRADA/SALIDA) explícito. La salida añade jornada
  del día y horas acumuladas.
- El tipo de marcación se deduce de la última marcación del día; el practicante nunca lo elige.
- El fallo ofrece el QR del carnet **en la misma pantalla**, con reintento automático y cuenta
  regresiva visible. Nadie queda atrapado ni debe pedir ayuda para volver al estado inicial.
- Vuelve solo al estado de espera (~3 s). Cero interacción táctil o de teclado requerida.

### Accesibilidad y resoluciones

- Contraste mínimo 4.5:1 en texto (3:1 solo a escala de titular). Usar las variantes `*-ink` para
  texto de color sobre fondo claro; nunca texto con opacidad reducida sobre acento o foto.
- Objetivos táctiles/clicables del kiosko ≥ 44 px.
- Verificar en **1366×768 y 1920×1080**. Responsive móvil no es prioridad, pero la app no debe
  romperse ni recortar contenido entre esas resoluciones: usar `max-width` y tracks de grid
  flexibles (`minmax(0,1fr)`), evitar alturas fijas en contenedores con texto.
- Toda la interfaz y todos los mensajes van **en español**, sin jerga técnica: la coordinadora no
  tiene perfil técnico.

## Decisiones pendientes / por confirmar

- [ ] Factibilidad de IT sobre HTTPS interno (certificado CA, permisos admin en PCs cliente, DNS/hosts)
- [ ] `face-api.js` (MVP simple) vs. InsightFace/ArcFace vía FastAPI (mayor precisión) para el
      reconocimiento facial
- [ ] Qué datos existen en el CRM mencionado por la fundación y si vale la pena integrarlo en vez
      de duplicar información
- [ ] Política de eliminación vs. inactivación de usuarios en el módulo de administración
- [ ] Duración/fecha límite formal de la práctica, para el objetivo SMART del proyecto
- [ ] Logo oficial en vectorial (SVG) — las maquetas usan una marca de posición
- [ ] Diseño de la corrección manual de marcaciones (olvidadas o erradas) por parte de la coordinadora
- [ ] Formulario de crear/editar usuario y vista de detalle con historial del practicante
- [ ] Brandear la app con el tema de shadcn/ui (cablear los tokens de "Imagen de marca y sistema
      de diseño" al theme de Tailwind/shadcn) — sesión dedicada aparte, cubre también pantallas ya
      existentes

## Preferencias de desarrollo

- Código en TypeScript, ejemplos completos y funcionales
- Priorizar buenas prácticas modernas de React/Next.js, manejo de estado y performance
- Evitar soluciones obsoletas o poco mantenibles; si hay algo mejor que lo planteado, sugerirlo
- Incluir estructura de archivos/arquitectura cuando aplique
- Para debugging: pasos claros de reproducción y solución
- Respetar la sección **Imagen de marca y sistema de diseño**: no introducir colores, fuentes ni
  radios fuera de los tokens definidos sin acordarlo primero
