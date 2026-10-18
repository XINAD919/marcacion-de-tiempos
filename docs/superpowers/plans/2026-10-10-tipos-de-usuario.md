# Tipos de usuario (universidad, colegio, natural) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguir practicantes de universidad, de colegio y voluntarios naturales (sin meta de horas, sin universidad ni entidad, con reglas de llegada/salida propias).

**Architecture:** Un módulo puro `src/lib/usuarios/tipoUsuario.ts` concentra qué significa cada tipo. La columna `users.tipo` (texto validado en TS) decide qué valida `validateUsuarioInput`, qué bloque muestra el formulario y qué reglas aplica la marcación vía la función pura `reglasPara(config, tipo)`. Las horas siguen derivándose de `attendance_logs`.

**Tech Stack:** Next.js (App Router) + React 19, TypeScript, Prisma sobre SQL Server, Vitest, shadcn/ui + Tailwind (tokens de marca de `globals.css`).

**Spec:** `docs/superpowers/specs/2026-10-10-tipos-de-usuario-design.md`

## Ajustes respecto al spec (descubiertos al leer el código)

- El listado (`src/app/admin/usuarios/page.tsx`) **no tiene columna de horas**: no hay `126 h` que mostrar. En su lugar se agrega una columna **Tipo** y "—" donde universidad/entidad están vacías.
- La pantalla de SALIDA del kiosko **ya muestra solo "HORAS ACUMULADAS" sin meta**: no hay "/ 240" que quitar. Lo único que cambia en el kiosko es la línea "universidad · entidad", que pasa a ser `afiliacion` calculada en el servidor.
- `insertUsuarios` inserta de a 200 filas; con la columna `tipo` serían 11 × 200 = 2200 parámetros, **por encima del límite de 2100 de SQL Server**. El lote baja a 150.

## Antes de empezar

El árbol de trabajo tiene cambios sin confirmar del carnet virtual / SMTP (ver `git status`). Pedir al usuario que los confirme antes de la Tarea 1; cada tarea de este plan hace `git add` **solo de sus archivos**, nunca `git add -A`.

Comandos:
- Pruebas unitarias de un archivo: `pnpm test src/lib/usuarios/tipoUsuario.test.ts`
- Todas: `pnpm test` (las de `src/app/api/**` necesitan SQL Server arriba con `DATABASE_URL` de `.env`)
- Tipos: `pnpm exec tsc --noEmit`
- Lint: `pnpm lint`

## Global Constraints

- Toda la interfaz y los mensajes en **español llano**, sin jerga técnica ni códigos.
- Solo tokens de marca (`bg-navy`, `text-brand-red-ink`, `bg-bone-2`…); nada de hex sueltos nuevos.
- `tabular-nums` en horas, cédulas y cifras.
- Commits en español, Conventional Commits, imperativo y minúscula, **sin línea `Co-Authored-By`**.
- Valores de `tipo`: exactamente `universidad` | `colegio` | `natural`. Etiquetas: `Universidad`, `Colegio`, `Voluntario natural`.
- Los naturales guardan `universidad = NULL`, `entidad = NULL`, `horasRequeridas = 0`, `fechaInicio = NULL`; `horaInicio`/`horaFin` obligatorias.
- Defaults de las reglas de naturales: tolerancia 10 min, mínimo antes de salida 60 min.
- Las horas cumplidas y la llegada tarde se derivan, nunca se guardan.

## Review Focus

1. **Usuario existente con `universidad`/`entidad` en NULL llega al kiosko** → la respuesta de `/api/marcacion` debe seguir siendo válida para `interpretMarcacionResponse`; hoy exige `typeof universidad === "string"` y caería en "error". Cubierto en Tarea 6 (test de natural en `marcacionResult.test.ts`).
2. **Importación de un Excel solo de naturales (sin columnas Universidad/Entidad/Horas)** → no debe rechazarse por "columnas faltantes" si trae la columna Tipo. Cubierto en Tarea 7.
3. **Importación grande con la columna nueva** → no debe superar 2100 parámetros por consulta. Cubierto en Tarea 3 (lote de 150).
4. **Cambiar un usuario de universidad a natural al editar** → se deben borrar universidad, entidad, horas y fecha aunque el navegador mande valores viejos. Cubierto en Tarea 3 (test "descarta los datos de práctica").
5. **Fila `natural` en Excel con universidad escrita** → se acepta y se ignora la universidad, no es error. Cubierto en Tarea 7.

---

### Task 1: Módulo `tipoUsuario`

**Files:**
- Create: `src/lib/usuarios/tipoUsuario.ts`
- Test: `src/lib/usuarios/tipoUsuario.test.ts`

**Interfaces:**
- Produces:
  - `TIPOS_USUARIO: readonly ["universidad", "colegio", "natural"]`
  - `type TipoUsuario`
  - `TIPO_USUARIO_LABEL: Record<TipoUsuario, string>`
  - `isTipoUsuario(value: unknown): value is TipoUsuario`
  - `tieneMetaDeHoras(tipo: string): boolean`
  - `parseTipoUsuario(raw: string): TipoUsuario | null` (texto libre de Excel)
  - `describeAfiliacion(user: { tipo: string; universidad: string | null; entidad: string | null }): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/usuarios/tipoUsuario.test.ts
import { describe, expect, it } from "vitest";
import { describeAfiliacion, isTipoUsuario, parseTipoUsuario, tieneMetaDeHoras } from "./tipoUsuario";

describe("isTipoUsuario", () => {
  it("acepta solo los tres tipos", () => {
    expect(isTipoUsuario("universidad")).toBe(true);
    expect(isTipoUsuario("colegio")).toBe(true);
    expect(isTipoUsuario("natural")).toBe(true);
    expect(isTipoUsuario("Natural")).toBe(false);
    expect(isTipoUsuario("")).toBe(false);
    expect(isTipoUsuario(undefined)).toBe(false);
  });
});

describe("tieneMetaDeHoras", () => {
  it("solo los voluntarios naturales no tienen meta", () => {
    expect(tieneMetaDeHoras("universidad")).toBe(true);
    expect(tieneMetaDeHoras("colegio")).toBe(true);
    expect(tieneMetaDeHoras("natural")).toBe(false);
  });
});

describe("parseTipoUsuario", () => {
  it("entiende cómo lo escribe la coordinadora en Excel", () => {
    expect(parseTipoUsuario("Universidad")).toBe("universidad");
    expect(parseTipoUsuario(" UNIVERSITARIO ")).toBe("universidad");
    expect(parseTipoUsuario("colegio")).toBe("colegio");
    expect(parseTipoUsuario("Natural")).toBe("natural");
    expect(parseTipoUsuario("Voluntario")).toBe("natural");
    expect(parseTipoUsuario("voluntario natural")).toBe("natural");
  });

  it("devuelve null si no lo reconoce", () => {
    expect(parseTipoUsuario("empresa")).toBeNull();
    expect(parseTipoUsuario("")).toBeNull();
  });
});

describe("describeAfiliacion", () => {
  it("une universidad y entidad", () => {
    expect(describeAfiliacion({ tipo: "universidad", universidad: "Universidad Nacional", entidad: "Sede Centro" })).toBe(
      "Universidad Nacional · Sede Centro"
    );
  });

  it("para un voluntario natural dice el tipo", () => {
    expect(describeAfiliacion({ tipo: "natural", universidad: null, entidad: null })).toBe("Voluntario natural");
  });

  it("omite las partes vacías", () => {
    expect(describeAfiliacion({ tipo: "colegio", universidad: "Colegio San José", entidad: null })).toBe(
      "Colegio San José"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/usuarios/tipoUsuario.test.ts`
Expected: FAIL, no se encuentra `./tipoUsuario`.

- [ ] **Step 3: Write implementation**

```ts
// src/lib/usuarios/tipoUsuario.ts
/**
 * Tipos de usuario: practicantes de universidad o colegio (con meta de horas
 * del convenio) y voluntarios naturales (sin meta, sin universidad ni
 * entidad). Módulo puro: lo usan el formulario, la importación, la marcación
 * y el kiosko.
 */

export const TIPOS_USUARIO = ["universidad", "colegio", "natural"] as const;
export type TipoUsuario = (typeof TIPOS_USUARIO)[number];

export const TIPO_USUARIO_LABEL: Record<TipoUsuario, string> = {
  universidad: "Universidad",
  colegio: "Colegio",
  natural: "Voluntario natural",
};

export function isTipoUsuario(value: unknown): value is TipoUsuario {
  return typeof value === "string" && (TIPOS_USUARIO as readonly string[]).includes(value);
}

/** Los naturales acumulan horas, pero sin horas requeridas ni progreso. */
export function tieneMetaDeHoras(tipo: string): boolean {
  return tipo !== "natural";
}

const TIPO_ALIASES: Record<string, TipoUsuario> = {
  universidad: "universidad",
  universitario: "universidad",
  colegio: "colegio",
  natural: "natural",
  voluntario: "natural",
  "voluntario natural": "natural",
};

/** Celda "Tipo" de Excel → tipo; null si no se reconoce. */
export function parseTipoUsuario(raw: string): TipoUsuario | null {
  const key = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return TIPO_ALIASES[key] ?? null;
}

/** Línea bajo el nombre (kiosko, carnet, enrolamiento). */
export function describeAfiliacion(user: { tipo: string; universidad: string | null; entidad: string | null }): string {
  if (user.tipo === "natural") return TIPO_USUARIO_LABEL.natural;
  return [user.universidad, user.entidad].filter((part) => part && part.trim()).join(" · ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/usuarios/tipoUsuario.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/usuarios/tipoUsuario.ts src/lib/usuarios/tipoUsuario.test.ts
git commit -m "feat(usuarios): agrega los tipos universidad, colegio y voluntario natural"
```

---

### Task 2: Esquema y migración

**Files:**
- Modify: `prisma/schema.prisma` (modelos `User` y `Configuracion`)
- Create: `prisma/migrations/<timestamp>_tipos_de_usuario/migration.sql` (generada y luego editada)

**Interfaces:**
- Produces: `User.tipo: string`, `User.universidad: string | null`, `User.entidad: string | null`, `Configuracion.toleranciaLlegadaNaturalMin: number`, `Configuracion.minMinutosAntesSalidaNatural: number`.

- [ ] **Step 1: Editar `User` en `prisma/schema.prisma`**

Reemplazar las líneas de `universidad` y `entidad` y agregar `tipo` y el índice:

```prisma
model User {
  id              String          @id @default(uuid())
  cedula          String          @unique
  nombre          String
  email           String?
  // universidad | colegio | natural (src/lib/usuarios/tipoUsuario.ts).
  tipo            String          @default("universidad") @db.VarChar(20)
  // Vacías para los voluntarios naturales; obligatorias para los demás
  // (lo exige validateUsuarioInput, no la base).
  universidad     String?
  entidad         String?
  // Las define el convenio con la institución (maqueta 4c). 0 en naturales.
  horasRequeridas Int             @default(0)
  fechaInicio     DateTime?       @db.Date
  // Horario asignado "HH:mm"; sirve para marcar llegadas tarde.
  horaInicio      String?         @db.VarChar(5)
  horaFin         String?         @db.VarChar(5)
  activo          Boolean         @default(true)
  fechaRegistro   DateTime        @default(now())
  embeddings      FaceEmbedding[]
  attendance      AttendanceLog[]
  carnet          CarnetVirtual?

  @@index([nombre])
  @@index([tipo])
}
```

- [ ] **Step 2: Editar `Configuracion`**

Agregar después de `minMinutosAntesSalida`:

```prisma
  // Las mismas dos reglas, pero para los voluntarios naturales.
  toleranciaLlegadaNaturalMin  Int @default(10)
  minMinutosAntesSalidaNatural Int @default(60)
```

- [ ] **Step 3: Generar la migración sin aplicarla**

Run: `pnpm exec prisma migrate dev --create-only --name tipos_de_usuario`
Expected: crea `prisma/migrations/<timestamp>_tipos_de_usuario/migration.sql` con `ALTER TABLE [dbo].[User] ADD [tipo] ...`, `ALTER COLUMN [universidad] NVARCHAR(1000) NULL`, `ALTER COLUMN [entidad] ...`, el índice y las columnas de `Configuracion`.

- [ ] **Step 4: Agregar la clasificación de colegios a la migración**

En `migration.sql`, justo antes de `COMMIT TRAN;`, agregar:

```sql
-- Usuarios existentes: todos quedan como universidad (default de la columna),
-- salvo los que ya decían colegio o institución educativa. La coordinadora
-- corrige a mano lo que esto no cubra.
EXEC('UPDATE [dbo].[User] SET [tipo] = ''colegio''
      WHERE [universidad] LIKE ''%colegio%''
         OR [universidad] LIKE ''%institución educativa%''
         OR [universidad] LIKE ''%institucion educativa%''');
```

(`EXEC` porque SQL Server compila el lote completo antes de crear la columna `tipo`; sin `EXEC` falla con "Invalid column name". La intercalación por defecto no distingue mayúsculas.)

- [ ] **Step 5: Aplicar y regenerar el cliente**

Run: `pnpm exec prisma migrate dev`
Expected: "All migrations have been successfully applied" y el cliente regenerado.

- [ ] **Step 6: Verificar que el resto compila (fallará; anotar los errores)**

Run: `pnpm exec tsc --noEmit`
Expected: errores por `universidad: string | null` en `usuarioService.ts`, `carnet.ts`, `marcacionService.ts`, páginas de editar/enrolar. Se arreglan en las tareas 3, 6 y 8; no arreglarlos aquí.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/*_tipos_de_usuario
git commit -m "feat(db): agrega el tipo de usuario y las reglas de marcación de naturales"
```

---

### Task 3: Validación por tipo y servicio de usuarios

**Files:**
- Modify: `src/lib/usuarios/userInput.ts`
- Modify: `src/lib/usuarios/userInput.test.ts`
- Modify: `src/lib/server/usuarioService.ts`
- Modify: `src/lib/usuarios/filters.ts`
- Modify: `src/lib/usuarios/filters.test.ts`
- Modify: `src/app/admin/usuarios/_form/actions.ts`

**Interfaces:**
- Consumes: `TipoUsuario`, `isTipoUsuario` (Tarea 1).
- Produces:
  - `UsuarioInput` gana `tipo: TipoUsuario`; `universidad` y `entidad` pasan a `string | null`.
  - `UsuarioField` gana `"tipo"`.
  - `Filters` gana `tipo?: TipoUsuario`; `TIPO_OPCIONES` exportado desde `filters.ts`.
  - `UsuarioRow` gana `tipo: string`; `universidad`/`entidad` pasan a `string | null`.
  - `listFilterOptions()` sigue devolviendo `{ universidades: string[]; entidades: string[] }` (sin nulos).

- [ ] **Step 1: Actualizar las pruebas existentes y agregar las nuevas**

En `src/lib/usuarios/userInput.test.ts`:

1. Agregar `tipo: "universidad",` al objeto `valid` (después de `email`).
2. En "normaliza un usuario válido", agregar `tipo: "universidad",` al `value` esperado.
3. Reemplazar el test "marca cada campo obligatorio vacío" por:

```ts
  it("marca cada campo obligatorio vacío", () => {
    const result = validateUsuarioInput({});
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(
      ["cedula", "entidad", "fechaInicio", "horasRequeridas", "nombre", "tipo", "universidad"].sort()
    );
  });
```

4. Agregar al final del `describe("validateUsuarioInput")`:

```ts
  it("pide colegio en vez de universidad para practicantes de colegio", () => {
    const result = validateUsuarioInput({ ...valid, tipo: "colegio", universidad: "" });
    expect(!result.ok && result.errors.universidad).toBe("Falta el colegio");
  });

  describe("voluntario natural", () => {
    const natural = {
      tipo: "natural",
      nombre: "Marta Lucía Gómez",
      cedula: "52.123.456",
      email: "",
      horaInicio: "09:00",
      horaFin: "13:00",
      activo: "true",
    };

    it("solo exige datos personales y horario", () => {
      expect(validateUsuarioInput(natural)).toEqual({
        ok: true,
        value: {
          tipo: "natural",
          nombre: "Marta Lucía Gómez",
          cedula: "52123456",
          email: null,
          universidad: null,
          entidad: null,
          horasRequeridas: 0,
          fechaInicio: null,
          horaInicio: "09:00",
          horaFin: "13:00",
          activo: true,
        },
      });
    });

    it("exige hora de llegada y de salida", () => {
      const result = validateUsuarioInput({ ...natural, horaInicio: "", horaFin: "" });
      expect(!result.ok && result.errors).toEqual({
        horaInicio: "Falta la hora de llegada",
        horaFin: "Falta la hora de salida",
      });
    });

    it("descarta los datos de práctica aunque lleguen (p. ej. al cambiar el tipo)", () => {
      const result = validateUsuarioInput({
        ...natural,
        universidad: "Universidad Nacional",
        entidad: "Sede Centro",
        horasRequeridas: "240",
        fechaInicio: "2026-08-01",
      });
      expect(result.ok && result.value).toMatchObject({
        universidad: null,
        entidad: null,
        horasRequeridas: 0,
        fechaInicio: null,
      });
    });
  });
```

En `src/lib/usuarios/filters.test.ts`, agregar dentro del primer `describe` existente (o en uno nuevo):

```ts
import { hrefWith, parseUsuarioFilters } from "./filters";

describe("filtro por tipo", () => {
  it("lee el tipo de la URL e ignora valores desconocidos", () => {
    expect(parseUsuarioFilters({ tipo: "natural" }).tipo).toBe("natural");
    expect(parseUsuarioFilters({ tipo: "empresa" }).tipo).toBeUndefined();
  });

  it("lo escribe en la URL", () => {
    expect(hrefWith({}, { tipo: "colegio" })).toBe("/admin/usuarios?tipo=colegio");
  });
});
```

(Si el archivo ya importa `hrefWith`/`parseUsuarioFilters`, no duplicar el import.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/usuarios/userInput.test.ts src/lib/usuarios/filters.test.ts`
Expected: FAIL (falta `tipo` en el valor, no existe el error "Falta la hora de llegada", `tipo` no se parsea).

- [ ] **Step 3: Implementar la validación por tipo en `userInput.ts`**

Cambios:

```ts
import { type TipoUsuario, isTipoUsuario } from "./tipoUsuario";

export interface UsuarioInput {
  tipo: TipoUsuario;
  nombre: string;
  cedula: string;
  email: string | null;
  /** null para voluntarios naturales. */
  universidad: string | null;
  entidad: string | null;
  /** 0 para voluntarios naturales: no tienen meta. */
  horasRequeridas: number;
  fechaInicio: Date | null;
  horaInicio: string | null;
  horaFin: string | null;
  activo: boolean;
}

export type UsuarioField =
  | "tipo"
  | "nombre"
  | "cedula"
  | "email"
  | "universidad"
  | "entidad"
  | "horasRequeridas"
  | "fechaInicio"
  | "horaInicio"
  | "horaFin";
```

Reemplazar el cuerpo de `validateUsuarioInput` por:

```ts
export function validateUsuarioInput(
  raw: Partial<Record<UsuarioField | "activo", unknown>>,
  { requireFechaInicio = true }: { requireFechaInicio?: boolean } = {}
): ValidationResult {
  const errors: UsuarioErrors = {};

  const tipoRaw = clean(raw.tipo);
  if (!isTipoUsuario(tipoRaw)) errors.tipo = "Elige el tipo de usuario.";
  // Sin tipo válido se valida como practicante: es lo más exigente.
  const tipo: TipoUsuario = isTipoUsuario(tipoRaw) ? tipoRaw : "universidad";
  const esNatural = tipo === "natural";

  const nombre = clean(raw.nombre);
  if (!nombre) errors.nombre = "Falta el nombre";

  const cedula = normalizeCedula(raw.cedula);
  if (!cedula.ok) errors.cedula = cedula.error;

  const email = clean(raw.email);
  if (email && !EMAIL.test(email)) errors.email = "El correo no parece válido";

  // Los naturales no tienen práctica: lo que llegue en estos campos se descarta.
  let universidad: string | null = null;
  let entidad: string | null = null;
  let horas = 0;
  let fechaInicio: Date | null = null;

  if (!esNatural) {
    universidad = clean(raw.universidad);
    if (!universidad) errors.universidad = tipo === "colegio" ? "Falta el colegio" : "Falta la universidad";

    entidad = clean(raw.entidad);
    if (!entidad) errors.entidad = "Falta la entidad donde practica";

    const horasRaw = clean(raw.horasRequeridas);
    horas = Number(horasRaw.replace(",", "."));
    if (!horasRaw) errors.horasRequeridas = "Faltan las horas requeridas";
    else if (!Number.isFinite(horas)) errors.horasRequeridas = "Horas exigidas sin número";
    else if (!Number.isInteger(horas) || horas <= 0 || horas > 5000) {
      errors.horasRequeridas = "Las horas deben ser un número entero entre 1 y 5000";
    }

    const fechaRaw = clean(raw.fechaInicio);
    if (fechaRaw) {
      fechaInicio = parseIsoDate(fechaRaw);
      if (!fechaInicio) errors.fechaInicio = "La fecha de inicio no es válida";
    } else if (requireFechaInicio) {
      errors.fechaInicio = "Falta la fecha de inicio";
    }
  }

  const horaInicio = clean(raw.horaInicio) || null;
  const horaFin = clean(raw.horaFin) || null;
  if (horaInicio && !HHMM.test(horaInicio)) errors.horaInicio = "Escribe la hora como 08:00";
  if (horaFin && !HHMM.test(horaFin)) errors.horaFin = "Escribe la hora como 12:00";
  if (!errors.horaInicio && !errors.horaFin) {
    if (esNatural && !horaInicio) errors.horaInicio = "Falta la hora de llegada";
    if (esNatural && !horaFin) errors.horaFin = "Falta la hora de salida";
    if (!esNatural && horaInicio && !horaFin) errors.horaFin = "Falta la hora de fin del horario";
    else if (!esNatural && !horaInicio && horaFin) errors.horaInicio = "Falta la hora de inicio del horario";
    else if (horaInicio && horaFin && minutesOf(horaFin) <= minutesOf(horaInicio)) {
      errors.horaFin = esNatural
        ? "La hora de salida debe ser después de la llegada"
        : "La hora de fin debe ser después del inicio";
    }
  }

  if (Object.keys(errors).length > 0 || !cedula.ok) return { ok: false, errors };

  return {
    ok: true,
    value: {
      tipo,
      nombre,
      cedula: cedula.value,
      email: email || null,
      universidad,
      entidad,
      horasRequeridas: horas,
      fechaInicio,
      horaInicio,
      horaFin,
      activo: raw.activo !== "false" && raw.activo !== false,
    },
  };
}
```

- [ ] **Step 4: Filtro por tipo en `filters.ts`**

```ts
import { TIPOS_USUARIO, TIPO_USUARIO_LABEL, type TipoUsuario, isTipoUsuario } from "./tipoUsuario";

export const TIPO_OPCIONES = TIPOS_USUARIO.map((value) => ({ value, label: TIPO_USUARIO_LABEL[value] }));

export interface Filters {
  q?: string;
  tipo?: TipoUsuario;
  universidad?: string;
  entidad?: string;
  estado?: Estado;
  page?: number;
}
```

En `parseUsuarioFilters`, agregar:

```ts
  const tipo = first(params.tipo);
  // ...
    tipo: isTipoUsuario(tipo) ? tipo : undefined,
```

y cambiar `ORDER` a `["q", "tipo", "universidad", "entidad", "estado", "page"]`.

- [ ] **Step 5: Servicio (`usuarioService.ts`)**

1. `UsuarioRow`: `tipo: string; universidad: string | null; entidad: string | null;`
2. `whereFor({ q, tipo, universidad, entidad, estado })` y agregar `if (tipo) and.push({ tipo });`
3. En `listUsuarios`, agregar `tipo: true,` al `select`.
4. `listFilterOptions` excluye nulos:

```ts
export async function listFilterOptions() {
  const [universidades, entidades] = await Promise.all([
    prisma.user.findMany({
      where: { universidad: { not: null } },
      distinct: ["universidad"],
      select: { universidad: true },
      orderBy: { universidad: "asc" },
    }),
    prisma.user.findMany({
      where: { entidad: { not: null } },
      distinct: ["entidad"],
      select: { entidad: true },
      orderBy: { entidad: "asc" },
    }),
  ]);
  return {
    universidades: universidades.flatMap((row) => (row.universidad ? [row.universidad] : [])),
    entidades: entidades.flatMap((row) => (row.entidad ? [row.entidad] : [])),
  };
}
```

5. `insertUsuarios`: cambiar el lote a 150 y el comentario:

```ts
/** Inserta en lotes; 11 columnas × 150 filas queda bajo el límite de 2100 parámetros. */
export async function insertUsuarios(inputs: UsuarioInput[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < inputs.length; i += 150) {
    const result = await prisma.user.createMany({ data: inputs.slice(i, i + 150).map(toDbInput) });
    inserted += result.count;
  }
  return inserted;
}
```

- [ ] **Step 6: Acción del formulario (`_form/actions.ts`)**

Agregar `"tipo",` al inicio del arreglo `FIELDS`.

- [ ] **Step 7: Run tests**

Run: `pnpm test src/lib/usuarios`
Expected: PASS (incluye `importRows.test.ts`: las filas de Excel aún no mandan `tipo`, así que **fallarán** con "Elige el tipo de usuario." — arreglo provisional: en `importRows.ts`, dentro de la llamada a `validateUsuarioInput`, agregar `tipo: "universidad",`. La Tarea 7 lo reemplaza por la columna Tipo).

- [ ] **Step 8: Commit**

```bash
git add src/lib/usuarios/userInput.ts src/lib/usuarios/userInput.test.ts src/lib/usuarios/filters.ts src/lib/usuarios/filters.test.ts src/lib/usuarios/importRows.ts src/lib/server/usuarioService.ts src/app/admin/usuarios/_form/actions.ts
git commit -m "feat(usuarios): valida y filtra según el tipo de usuario"
```

---

### Task 4: Formulario con selector de tipo

**Files:**
- Modify: `src/app/admin/usuarios/_form/usuario-form.tsx`
- Modify: `src/app/admin/usuarios/nuevo/page.tsx`
- Modify: `src/app/admin/usuarios/[userId]/editar/page.tsx`

**Interfaces:**
- Consumes: `TIPOS_USUARIO`, `TIPO_USUARIO_LABEL`, `isTipoUsuario`, `type TipoUsuario` (Tarea 1); `UsuarioField` con `"tipo"` (Tarea 3).
- Produces: `UsuarioFormDefaults.tipo: TipoUsuario`.

- [ ] **Step 1: Defaults y estado del tipo en `usuario-form.tsx`**

1. Import: `import { TIPOS_USUARIO, TIPO_USUARIO_LABEL, type TipoUsuario, isTipoUsuario } from "@/lib/usuarios/tipoUsuario";`
2. `UsuarioFormDefaults` gana `tipo: TipoUsuario;` como primer campo.
3. Dentro del componente, después de `const [plan, setPlan] = useState(...)`:

```tsx
  const [tipo, setTipo] = useState<TipoUsuario>(isTipoUsuario(values.tipo) ? values.tipo : "universidad");
  const esNatural = tipo === "natural";
```

4. En el `onChange` del `<form>`, antes de `setPlan`, agregar:

```tsx
        const nextTipo = data.get("tipo");
        if (isTipoUsuario(nextTipo)) setTipo(nextTipo);
```

- [ ] **Step 2: Tarjeta "Tipo de usuario"**

Insertar como primera tarjeta, antes de `<Card title="Datos personales">`:

```tsx
          <Card title="Tipo de usuario">
            <SegmentedControl
              name="tipo"
              label="Tipo de usuario"
              defaultValue={tipo}
              options={TIPOS_USUARIO.map((value) => ({ value, label: TIPO_USUARIO_LABEL[value] }))}
            />
            {errors.tipo ? (
              <p id="tipo-error" className="mt-3 text-[12.5px] leading-[1.45] text-brand-red-ink">
                {errors.tipo}
              </p>
            ) : (
              <p className="mt-3 text-[13px] leading-normal text-muted-foreground">
                {esNatural
                  ? "Voluntario sin práctica formal: suma horas, pero sin meta ni institución."
                  : "Practicante con convenio: tiene horas requeridas y fecha estimada de fin."}
              </p>
            )}
          </Card>
```

- [ ] **Step 3: Bloque condicional**

Envolver la tarjeta `<Card title="Práctica">…</Card>` completa en `{!esNatural && ( … )}` y dentro de ella:

- Cambiar la etiqueta del campo `universidad` a `label={tipo === "colegio" ? "Colegio" : "Universidad"}`.
- Cambiar los `defaultValue` de `horaInicio` y `horaFin` a `plan.horaInicio` y `plan.horaFin` (así el horario se conserva al alternar el tipo).

Después de esa tarjeta, agregar el bloque de naturales:

```tsx
          {esNatural && (
            <Card title="Horario">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4.5">
                <Field id="horaInicio" label="Hora de llegada" required error={errors.horaInicio}>
                  <Input
                    id="horaInicio"
                    name="horaInicio"
                    type="time"
                    defaultValue={plan.horaInicio}
                    className="tabular-nums"
                    {...invalid("horaInicio")}
                  />
                </Field>
                <Field
                  id="horaFin"
                  label="Hora de salida"
                  required
                  hint="Sirve para marcar llegadas tarde con la tolerancia de voluntarios."
                  error={errors.horaFin}
                >
                  <Input
                    id="horaFin"
                    name="horaFin"
                    type="time"
                    defaultValue={plan.horaFin}
                    className="tabular-nums"
                    {...invalid("horaFin")}
                  />
                </Field>
              </div>
            </Card>
          )}
```

- [ ] **Step 4: Páginas que pasan los defaults**

`nuevo/page.tsx`: agregar `tipo: "universidad",` como primer campo de `defaults`.

`[userId]/editar/page.tsx`:

```tsx
import { isTipoUsuario } from "@/lib/usuarios/tipoUsuario";
// ...
      defaults={{
        tipo: isTipoUsuario(user.tipo) ? user.tipo : "universidad",
        nombre: user.nombre,
        cedula: user.cedula,
        email: user.email ?? "",
        universidad: user.universidad ?? "",
        entidad: user.entidad ?? "",
        // ...resto igual
```

- [ ] **Step 5: Verificar tipos y lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: sin errores en estos tres archivos (pueden quedar errores de `carnet.ts`, `marcacionService.ts`, `enrolar/page.tsx`, `usuarios/page.tsx`: son de las tareas 6 y 8).

- [ ] **Step 6: Prueba manual**

Run: `pnpm dev`, abrir `/admin/usuarios/nuevo`:
- Elegir "Voluntario natural": desaparece "Práctica", aparece "Horario". Guardar sin horas → "Falta la hora de llegada" / "Falta la hora de salida".
- Llenar horario y guardar → vuelve al listado.
- Elegir "Colegio": la etiqueta dice "Colegio"; vacío → "Falta el colegio".
- Editar un usuario existente de universidad, cambiar a natural, guardar, volver a abrir: el tipo quedó en natural.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/usuarios/_form/usuario-form.tsx src/app/admin/usuarios/nuevo/page.tsx "src/app/admin/usuarios/[userId]/editar/page.tsx"
git commit -m "feat(usuarios): elige el tipo de usuario en el formulario y muestra su bloque"
```

---

### Task 5: Reglas de naturales en Configuración

**Files:**
- Modify: `src/lib/configRules.ts`
- Modify: `src/lib/configRules.test.ts`
- Modify: `src/lib/server/config.ts`
- Modify: `src/app/admin/configuracion/actions.ts`
- Modify: `src/app/admin/configuracion/config-form.tsx`

**Interfaces:**
- Produces:
  - `ConfigValues` gana `toleranciaLlegadaNaturalMin: number` y `minMinutosAntesSalidaNatural: number`.
  - `ConfigField` gana `"toleranciaLlegadaNaturalMin" | "minHorasAntesSalidaNatural"`.
  - `reglasPara(config: ConfigValues, tipo: string): { toleranciaLlegadaMin: number; minMinutosAntesSalida: number }`

- [ ] **Step 1: Tests**

En `src/lib/configRules.test.ts`:

1. Agregar a `valid`: `toleranciaLlegadaNaturalMin: "20", minHorasAntesSalidaNatural: "0,5",`
2. En el test "convierte el formulario a reglas…", agregar al `value` esperado: `toleranciaLlegadaNaturalMin: 20, minMinutosAntesSalidaNatural: 30,`
3. Cambiar el import a `import { DEFAULT_CONFIG, matchThresholdFor, parseConfigForm, reglasPara } from "./configRules";`
4. Agregar:

```ts
describe("parseConfigForm · voluntarios naturales", () => {
  it("valida sus reglas con los mismos rangos", () => {
    const result = parseConfigForm({ ...valid, toleranciaLlegadaNaturalMin: "200", minHorasAntesSalidaNatural: "x" });
    expect(!result.ok && result.errors).toEqual({
      toleranciaLlegadaNaturalMin: "Escribe un número de minutos entre 0 y 120.",
      minHorasAntesSalidaNatural: "Escribe un número de horas entre 0 y 12.",
    });
  });
});

describe("reglasPara", () => {
  const config = {
    ...DEFAULT_CONFIG,
    toleranciaLlegadaMin: 10,
    minMinutosAntesSalida: 60,
    toleranciaLlegadaNaturalMin: 25,
    minMinutosAntesSalidaNatural: 30,
  };

  it("los practicantes usan las reglas generales", () => {
    expect(reglasPara(config, "universidad")).toEqual({ toleranciaLlegadaMin: 10, minMinutosAntesSalida: 60 });
    expect(reglasPara(config, "colegio")).toEqual({ toleranciaLlegadaMin: 10, minMinutosAntesSalida: 60 });
  });

  it("los voluntarios naturales usan las suyas", () => {
    expect(reglasPara(config, "natural")).toEqual({ toleranciaLlegadaMin: 25, minMinutosAntesSalida: 30 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/configRules.test.ts`
Expected: FAIL (`reglasPara` no existe; faltan campos).

- [ ] **Step 3: Implementar en `configRules.ts`**

```ts
export interface ConfigValues {
  toleranciaLlegadaMin: number;
  minMinutosAntesSalida: number;
  toleranciaLlegadaNaturalMin: number;
  minMinutosAntesSalidaNatural: number;
  exigenciaReconocimiento: Exigencia;
  intentosAntesQr: number;
  jornadaMaximaHoras: number;
}

export const DEFAULT_CONFIG: ConfigValues = {
  toleranciaLlegadaMin: 10,
  minMinutosAntesSalida: 60,
  toleranciaLlegadaNaturalMin: 10,
  minMinutosAntesSalidaNatural: 60,
  exigenciaReconocimiento: "equilibrado",
  intentosAntesQr: 3,
  jornadaMaximaHoras: 9,
};

export type ConfigField =
  | "toleranciaLlegadaMin"
  | "minHorasAntesSalida"
  | "toleranciaLlegadaNaturalMin"
  | "minHorasAntesSalidaNatural"
  | "exigenciaReconocimiento"
  | "intentosAntesQr"
  | "jornadaMaximaHoras";
```

Agregar debajo de `intInRange`:

```ts
/** Horas con coma o punto decimal (0–12) → minutos; null si no sirve. */
function hoursToMinutes(raw: unknown): number | null {
  const horas = parseNumber(raw);
  return horas === null || horas < 0 || horas > 12 ? null : Math.round(horas * 60);
}

const MSG_TOLERANCIA = "Escribe un número de minutos entre 0 y 120.";
const MSG_HORAS_SALIDA = "Escribe un número de horas entre 0 y 12.";
```

En `parseConfigForm` reemplazar el bloque de tolerancia y horas por:

```ts
  const tolerancia = intInRange(input.toleranciaLlegadaMin, 0, 120);
  if (tolerancia === null) errors.toleranciaLlegadaMin = MSG_TOLERANCIA;

  const minSalida = hoursToMinutes(input.minHorasAntesSalida);
  if (minSalida === null) errors.minHorasAntesSalida = MSG_HORAS_SALIDA;

  const toleranciaNatural = intInRange(input.toleranciaLlegadaNaturalMin, 0, 120);
  if (toleranciaNatural === null) errors.toleranciaLlegadaNaturalMin = MSG_TOLERANCIA;

  const minSalidaNatural = hoursToMinutes(input.minHorasAntesSalidaNatural);
  if (minSalidaNatural === null) errors.minHorasAntesSalidaNatural = MSG_HORAS_SALIDA;
```

y el `value` devuelto:

```ts
    value: {
      toleranciaLlegadaMin: tolerancia!,
      minMinutosAntesSalida: minSalida!,
      toleranciaLlegadaNaturalMin: toleranciaNatural!,
      minMinutosAntesSalidaNatural: minSalidaNatural!,
      exigenciaReconocimiento: exigencia as Exigencia,
      intentosAntesQr: intentos!,
      jornadaMaximaHoras: jornada!,
    },
```

Al final del archivo:

```ts
/**
 * Tolerancia de llegada y mínimo antes de la salida que aplican a un usuario.
 * Los voluntarios naturales tienen las suyas; el resto de reglas es global.
 */
export function reglasPara(
  config: ConfigValues,
  tipo: string
): { toleranciaLlegadaMin: number; minMinutosAntesSalida: number } {
  return tipo === "natural"
    ? {
        toleranciaLlegadaMin: config.toleranciaLlegadaNaturalMin,
        minMinutosAntesSalida: config.minMinutosAntesSalidaNatural,
      }
    : { toleranciaLlegadaMin: config.toleranciaLlegadaMin, minMinutosAntesSalida: config.minMinutosAntesSalida };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/lib/configRules.test.ts`
Expected: PASS.

- [ ] **Step 5: `src/lib/server/config.ts`**

En `getConfig`, agregar al objeto devuelto:

```ts
    toleranciaLlegadaNaturalMin: row.toleranciaLlegadaNaturalMin,
    minMinutosAntesSalidaNatural: row.minMinutosAntesSalidaNatural,
```

(`saveConfig` ya hace `...values`; los nombres coinciden con las columnas.)

- [ ] **Step 6: `configuracion/actions.ts`**

Agregar a `FIELDS`: `"toleranciaLlegadaNaturalMin",` y `"minHorasAntesSalidaNatural",` después de `"minHorasAntesSalida"`.

- [ ] **Step 7: `config-form.tsx`**

1. En la tarjeta "Marcación", cambiar las descripciones de las dos primeras filas para que digan a quién aplican:
   - Tolerancia: `"Practicantes de universidad y colegio: minutos después de la hora de inicio antes de contar como llegada tarde."`
   - Tiempo mínimo: `"Practicantes de universidad y colegio. Si alguien intenta marcar salida antes de este tiempo desde su entrada, el kiosko no la registra y le pide hablar con coordinación."`
2. Entre `</SettingsCard>` de "Marcación" y `<SettingsCard title="Jornada">`, agregar:

```tsx
            <SettingsCard title="Voluntarios naturales">
              <SettingRow
                htmlFor="toleranciaLlegadaNaturalMin"
                title="Tolerancia de llegada"
                description="Minutos después de su hora de llegada antes de contar como llegada tarde."
                error={errors.toleranciaLlegadaNaturalMin}
              >
                <UnitInput
                  id="toleranciaLlegadaNaturalMin"
                  name="toleranciaLlegadaNaturalMin"
                  unit="minutos"
                  inputMode="numeric"
                  defaultValue={value("toleranciaLlegadaNaturalMin", String(config.toleranciaLlegadaNaturalMin))}
                  aria-invalid={Boolean(errors.toleranciaLlegadaNaturalMin) || undefined}
                  aria-describedby={describedBy("toleranciaLlegadaNaturalMin")}
                />
              </SettingRow>

              <SettingRow
                htmlFor="minHorasAntesSalidaNatural"
                title="Tiempo mínimo antes de la salida"
                description="Si un voluntario intenta marcar salida antes de este tiempo desde su entrada, el kiosko no la registra y le pide hablar con coordinación."
                error={errors.minHorasAntesSalidaNatural}
              >
                <UnitInput
                  id="minHorasAntesSalidaNatural"
                  name="minHorasAntesSalidaNatural"
                  unit="horas"
                  defaultValue={value("minHorasAntesSalidaNatural", formatHours(config.minMinutosAntesSalidaNatural))}
                  aria-invalid={Boolean(errors.minHorasAntesSalidaNatural) || undefined}
                  aria-describedby={describedBy("minHorasAntesSalidaNatural")}
                />
              </SettingRow>
            </SettingsCard>
```

- [ ] **Step 8: Verificar**

Run: `pnpm test src/lib/configRules.test.ts && pnpm exec tsc --noEmit`
Expected: PASS; sin errores de tipos en los archivos de esta tarea. Manual: `/admin/configuracion` muestra la tarjeta nueva, guarda `0,5` horas y lo vuelve a mostrar como `0,5`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/configRules.ts src/lib/configRules.test.ts src/lib/server/config.ts src/app/admin/configuracion/actions.ts src/app/admin/configuracion/config-form.tsx
git commit -m "feat(configuracion): agrega tolerancia y salida mínima para voluntarios naturales"
```

---

### Task 6: Marcación y kiosko según el tipo

**Files:**
- Modify: `src/lib/server/marcacionService.ts`
- Modify: `src/lib/client/marcacionResult.ts`
- Modify: `src/lib/client/marcacionResult.test.ts`
- Modify: `src/app/marcacion/_components/result-screens.tsx`
- Modify: `src/app/api/marcacion/route.test.ts`

**Interfaces:**
- Consumes: `reglasPara` (Tarea 5), `describeAfiliacion` (Tarea 1).
- Produces: la respuesta de `/api/marcacion` y `/api/marcacion/qr` gana `afiliacion: string`; `universidad`/`entidad` pueden ser `null`. `Recognized` del kiosko pasa a `{ nombre: string; afiliacion: string; hora: Date }`.

- [ ] **Step 1: Tests del intérprete**

En `src/lib/client/marcacionResult.test.ts`:

1. Agregar `afiliacion: "Universidad Nacional · Trabajo Social",` al objeto `entrada`.
2. En los `toEqual` que listan `universidad` y `entidad` del resultado, reemplazar esas dos claves por `afiliacion: "Universidad Nacional · Trabajo Social",` (buscar con `grep -n "universidad" src/lib/client/marcacionResult.test.ts`).
3. Agregar:

```ts
  it("acepta a un voluntario natural sin universidad ni entidad", () => {
    const result = interpretMarcacionResponse(200, {
      ...entrada,
      universidad: null,
      entidad: null,
      afiliacion: "Voluntario natural",
    });
    expect(result).toMatchObject({ kind: "entrada", afiliacion: "Voluntario natural" });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/client/marcacionResult.test.ts`
Expected: FAIL (el resultado aún trae `universidad`/`entidad` y el natural cae en `fallo`).

- [ ] **Step 3: `marcacionResult.ts`**

```ts
interface Recognized {
  nombre: string;
  /** "Universidad · Entidad" o "Voluntario natural"; la arma el servidor. */
  afiliacion: string;
  hora: Date;
}
```

Reemplazar el bloque desde `const { nombre, universidad, entidad, hora, tipo } = data;` hasta `const recognized…` por:

```ts
  const { nombre, afiliacion, hora, tipo } = data;
  if (data.matched !== true || typeof nombre !== "string" || typeof afiliacion !== "string" || typeof hora !== "string") {
    return fail("error");
  }

  const recognized: Recognized = { nombre, afiliacion, hora: new Date(hora) };
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/lib/client/marcacionResult.test.ts`
Expected: PASS.

- [ ] **Step 5: `marcacionService.ts`**

1. Imports: `import { type ConfigValues, reglasPara } from "@/lib/configRules";` y `import { describeAfiliacion } from "@/lib/usuarios/tipoUsuario";`
2. Al inicio de `registrarMarcacion`: `const reglas = reglasPara(config, user.tipo);`
3. Reemplazar `config.minMinutosAntesSalida` por `reglas.minMinutosAntesSalida` y `config.toleranciaLlegadaMin` por `reglas.toleranciaLlegadaMin`.
4. En `base`, agregar `afiliacion: describeAfiliacion(user),` después de `entidad`.

- [ ] **Step 6: `result-screens.tsx`**

Reemplazar las dos ocurrencias de `{result.universidad} · {result.entidad}` por `{result.afiliacion}`.

- [ ] **Step 7: Test de la ruta**

En `src/app/api/marcacion/route.test.ts`, en el test "incluye universidad y entidad para la pantalla de éxito del kiosko", agregar:

```ts
      expect(body.afiliacion).toBe("Universidad de Prueba · Entidad de Prueba");
```

- [ ] **Step 8: Verificar**

Run: `pnpm exec tsc --noEmit && pnpm test src/lib/client src/app/api/marcacion`
Expected: PASS (las de `src/app/api` requieren SQL Server arriba).

- [ ] **Step 9: Commit**

```bash
git add src/lib/server/marcacionService.ts src/lib/client/marcacionResult.ts src/lib/client/marcacionResult.test.ts src/app/marcacion/_components/result-screens.tsx src/app/api/marcacion/route.test.ts
git commit -m "feat(kiosko): aplica las reglas de naturales y muestra su afiliación"
```

---

### Task 7: Columna "Tipo" en la importación

**Files:**
- Modify: `src/lib/usuarios/importRows.ts`
- Modify: `src/lib/usuarios/importRows.test.ts`

**Interfaces:**
- Consumes: `parseTipoUsuario` (Tarea 1), `validateUsuarioInput` con `tipo` (Tarea 3).

- [ ] **Step 1: Tests**

Agregar al `describe("classifyImportRows")`:

```ts
  it("sin columna Tipo asume universidad", () => {
    const result = classifyImportRows([header], new Set());
    expect(result.validos[0]?.input.tipo).toBe("universidad");
  });

  it("lee la columna Tipo", () => {
    const result = classifyImportRows([{ ...header, Tipo: "Colegio" }], new Set());
    expect(result.validos[0]?.input.tipo).toBe("colegio");
  });

  it("explica un tipo que no reconoce", () => {
    const result = classifyImportRows([{ ...header, Tipo: "Empresa" }], new Set());
    expect(result.errores[0]?.motivo).toBe("El tipo debe ser Universidad, Colegio o Natural");
  });

  it("un archivo solo de naturales no necesita columnas de práctica", () => {
    const result = classifyImportRows(
      [{ Nombre: "Marta Gómez", "Cédula": "52123456", Tipo: "Natural", "Hora de inicio": "09:00", "Hora de fin": "13:00" }],
      new Set()
    );
    expect(result.columnasFaltantes).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ tipo: "natural", universidad: null, horasRequeridas: 0 });
  });

  it("en una fila natural ignora la universidad escrita", () => {
    const result = classifyImportRows(
      [{ ...header, Tipo: "Voluntario", "Hora de inicio": "09:00", "Hora de fin": "13:00" }],
      new Set()
    );
    expect(result.errores).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ tipo: "natural", universidad: null, entidad: null });
  });

  it("una fila natural sin horario es error", () => {
    const result = classifyImportRows([{ ...header, Tipo: "Natural" }], new Set());
    expect(result.errores[0]?.motivo).toContain("Falta la hora de llegada");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/usuarios/importRows.test.ts`
Expected: FAIL (Tipo se ignora; el archivo de naturales reporta columnas faltantes).

- [ ] **Step 3: Implementar**

En `importRows.ts`:

1. Import: `import { parseTipoUsuario } from "./tipoUsuario";`
2. Agregar alias: `tipo: ["tipo", "tipo de usuario", "tipo de practicante"],` en `HEADER_ALIASES` (el tipo `Column` ya incluye `"tipo"` porque `UsuarioField` lo tiene).
3. Reemplazar el cálculo de `columnasFaltantes` por:

```ts
  const hasNombre = columnKey.has("nombre") || columnKey.has("nombres");
  // Con columna Tipo puede haber naturales, que no llevan datos de práctica;
  // entonces cada fila se valida por su cuenta en vez de exigir la columna.
  const required = columnKey.has("tipo") ? REQUIRED.filter(({ column }) => column === "cedula") : REQUIRED;
  const columnasFaltantes = [
    ...(hasNombre ? [] : ["Nombre"]),
    ...required.filter(({ column }) => !columnKey.has(column as Column)).map(({ label }) => label),
  ];
```

4. Dentro de `rows.forEach`, antes de `validateUsuarioInput`:

```ts
    const tipoRaw = toText(cell(row, "tipo")).trim();
    const tipo = tipoRaw ? parseTipoUsuario(tipoRaw) : "universidad";
```

y justo después de calcular `nombre` y `cedulaRaw` (antes de validar), si el tipo no se reconoce:

```ts
    if (tipo === null) {
      result.errores.push({
        fila,
        nombre: nombre.trim().replace(/\s+/g, " "),
        cedula: cedulaRaw,
        motivo: "El tipo debe ser Universidad, Colegio o Natural",
      });
      return;
    }
```

5. En la llamada a `validateUsuarioInput`, reemplazar el `tipo: "universidad",` provisional de la Tarea 3 por `tipo,`.

- [ ] **Step 4: Run tests**

Run: `pnpm test src/lib/usuarios/importRows.test.ts`
Expected: PASS (los tests anteriores siguen pasando).

- [ ] **Step 5: Commit**

```bash
git add src/lib/usuarios/importRows.ts src/lib/usuarios/importRows.test.ts
git commit -m "feat(importacion): lee la columna Tipo y acepta voluntarios naturales"
```

---

### Task 8: Listado, carnet y enrolamiento

**Files:**
- Modify: `src/app/admin/usuarios/page.tsx`
- Modify: `src/app/admin/usuarios/filters-bar.tsx`
- Modify: `src/lib/server/carnet.ts`
- Modify: `src/app/admin/enrolar/[userId]/page.tsx`

**Interfaces:**
- Consumes: `TIPO_OPCIONES` (Tarea 3), `TIPO_USUARIO_LABEL`, `isTipoUsuario`, `describeAfiliacion` (Tarea 1), `UsuarioRow` con `tipo` (Tarea 3).

- [ ] **Step 1: `filters-bar.tsx`**

Cambiar `key: "universidad" | "entidad" | "estado";` por `key: "tipo" | "universidad" | "entidad" | "estado";`.

- [ ] **Step 2: `usuarios/page.tsx`**

1. Imports: agregar `TIPO_OPCIONES` al import de `@/lib/usuarios/filters` y `import { TIPO_USUARIO_LABEL, isTipoUsuario } from "@/lib/usuarios/tipoUsuario";`
2. `hasFilters`: agregar `filters.tipo ||`.
3. En `defs`, como primer elemento: `{ key: "tipo", label: "Tipo", options: TIPO_OPCIONES },`
4. Encabezados: insertar `<TableHead>Tipo</TableHead>` antes de "Universidad / Colegio".
5. Celdas: antes de la celda de universidad:

```tsx
                    <TableCell>{isTipoUsuario(user.tipo) ? TIPO_USUARIO_LABEL[user.tipo] : user.tipo}</TableCell>
```

y cambiar las celdas de universidad y entidad a `{user.universidad ?? "—"}` y `{user.entidad ?? "—"}`.

- [ ] **Step 3: `carnet.ts`**

1. Import: `import { describeAfiliacion } from "@/lib/usuarios/tipoUsuario";`
2. `CarnetData`:

```ts
export interface CarnetData {
  nombre: string;
  cedula: string;
  tipo: string;
  universidad: string | null;
  entidad: string | null;
}
```

3. En `renderCarnetHtml`: `const detalle = escapeHtml(describeAfiliacion(data));`

(Los llamadores pasan el `User` completo de Prisma, que ya trae `tipo`.)

- [ ] **Step 4: `enrolar/[userId]/page.tsx`**

```tsx
import { describeAfiliacion } from "@/lib/usuarios/tipoUsuario";
// ...
      detalle={`C.C. ${formatCedula(user.cedula)} · ${describeAfiliacion(user)}`}
```

- [ ] **Step 5: Verificar todo**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: sin errores de tipos ni lint; todas las pruebas PASS.

Manual (`pnpm dev`, a 1366×768):
- `/admin/usuarios`: columna Tipo; el natural muestra "—" en universidad y entidad; el chip "Tipo ▾" filtra.
- Vista previa del carnet de un natural (`/admin/usuarios/<id>/carnet`): dice "Voluntario natural", sin " · " colgando.
- Enrolar a un natural: el detalle dice "C.C. … · Voluntario natural".

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/usuarios/page.tsx src/app/admin/usuarios/filters-bar.tsx src/lib/server/carnet.ts "src/app/admin/enrolar/[userId]/page.tsx"
git commit -m "feat(usuarios): muestra el tipo en el listado, el carnet y el enrolamiento"
```

---

### Task 9: Documentación

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Actualizar `AGENTS.md`**

1. En "Modelo de datos", reemplazar la línea de `users` por:

```markdown
- `users`: id, cedula, nombre, email (opcional), tipo (`universidad` | `colegio` | `natural`,
  ver `src/lib/usuarios/tipoUsuario.ts`), universidad y entidad (NULL en naturales),
  horas_requeridas (0 en naturales), fecha_inicio (DATE), hora_inicio / hora_fin ("HH:mm",
  horario asignado; obligatorio en naturales), activo, fecha_registro
```

2. En la línea de `configuracion`, agregar al final: "Tolerancia de llegada y tiempo mínimo antes de la salida tienen además una versión para voluntarios naturales (`reglasPara` en `src/lib/configRules.ts`)."
3. En "Reglas de marcación (configurables en 4g)", agregar un punto:

```markdown
- **Voluntarios naturales:** acumulan horas igual que los practicantes, pero sin meta (sin
  horas requeridas, progreso ni fecha estimada de fin). Usan su propia tolerancia de llegada
  y su propio tiempo mínimo antes de la salida; el resto de reglas es común.
```

4. En "Importación de datos" o en el módulo de Administración, mencionar: "Columna opcional **Tipo** (Universidad / Colegio / Natural); sin ella se asume universidad."

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): documenta los tipos de usuario y las reglas de naturales"
```

(Si `AGENTS.md` tiene cambios previos sin confirmar de otra tarea, usar `git add -p AGENTS.md` y agregar solo estos fragmentos.)
