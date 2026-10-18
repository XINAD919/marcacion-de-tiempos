# Instituciones y sedes (maqueta 4f) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el texto libre de `User.universidad` / `User.entidad` por dos catálogos administrables (Institución y Sede), que alimentan desplegables en el formulario de usuario, los filtros del listado y la importación, y reducir `User.tipo` a `practicante | natural`.

**Architecture:** Migración en dos tiempos (expandir → contraer). Primero se crean `Institucion` y `Sede`, se agregan `institucionId` / `sedeId` a `User` y se llenan a partir del texto existente, sin borrar nada. Luego cada consumidor (afiliación, listado, validación, importación, formulario) pasa a leer las relaciones. Al final una segunda migración pasa `tipo` a `practicante` y elimina las columnas de texto. La lógica vive en módulos puros (`src/lib/catalogo/*`, `src/lib/usuarios/*`) probados con Vitest. La base solo se toca en servicios de `src/lib/server/*`.

**Tech Stack:** Next.js 16 (App Router) + React 19, TypeScript, Prisma 6 sobre SQL Server, Vitest, Playwright, shadcn/ui (`base-nova`, sobre `@base-ui/react` 1.8) + Tailwind 4 con los tokens de `globals.css`.

**Spec:** `docs/superpowers/specs/2026-10-10-instituciones-y-sedes-design.md`

## Ajustes respecto al spec (descubiertos al leer el código)

- **Sede con `<select>` nativo**, no con el `Select` de shadcn: ese componente no está instalado, y el listado ya usa `<select>` nativos con estilo de marca (`filters-bar.tsx`). La institución sí usa un combobox con búsqueda, el `Combobox` de `@base-ui/react`, que ya viene instalado.
- El mensaje cuando falta la institución o la sede es **"Falta la institución"** / **"Falta la sede"**, igual que los demás campos ("Falta el nombre"). Lo usan tanto el formulario como la importación.
- Los filtros Institución y Sede muestran **todo el catálogo**, con las inactivas rotuladas "(inactiva)". No se calcula "inactivas con usuarios".
- Las **horas exigidas** de una institución son obligatorias (1 a 5000), con el mismo rango que las horas requeridas del usuario. Así lo que se precarga siempre es válido. Las instituciones creadas por la migración sin horas quedan en `0` hasta que alguien las edite. Mientras tanto no precargan nada.
- Las tarjetas de sede inactivas se atenúan con el fondo `bg-row-alt` y la píldora "Inactiva", **no con opacidad**, porque bajaría el contraste del texto (AGENTS.md › Accesibilidad).
- "¿No está en la lista? Agrégala en Instituciones y sedes" abre la pantalla **en otra pestaña**, para no perder lo que ya se escribió en el formulario.

## Antes de empezar

- Hay archivos sin trackear de otra sesión (`e2e/tmp-tipos.spec.ts`, `opencode.json`). No tocarlos. Cada tarea hace `git add` **solo de sus archivos**, nunca `git add -A`.
- SQL Server tiene que estar arriba: `docker compose up -d`.

Comandos:
- Pruebas unitarias de un archivo: `pnpm test src/lib/catalogo/nombres.test.ts`
- Todas: `pnpm test` (las de `src/app/api/**` y `src/lib/server/*Service.test.ts` usan la base de `DATABASE_URL`)
- Tipos: `pnpm exec tsc --noEmit`
- Lint: `pnpm lint`
- Migraciones: `pnpm exec prisma migrate dev --create-only --name <nombre>` y luego `pnpm exec prisma migrate dev`

**Ventana sin compilar:** al terminar la Tarea 6, `tsc` falla **solo** en `src/app/admin/usuarios/_form/usuario-form.tsx`, `src/app/admin/usuarios/nuevo/page.tsx` y `src/app/admin/usuarios/[userId]/editar/page.tsx`, porque el formulario se rehace en la Tarea 7. Quien revise la Tarea 6 verifica que no haya errores de `tsc` **fuera** de esos tres archivos.

## Global Constraints

- Toda la interfaz y los mensajes en **español llano**, sin códigos ni jerga técnica.
- Vocabulario único: **Institución** y **Sede**. La palabra "Entidad" solo sobrevive como alias de columna en la importación.
- Solo tokens de marca (`bg-navy`, `text-brand-red-ink`, `bg-bone-2`, `bg-row-alt`, `text-navy/62`…). Nada de hex sueltos nuevos.
- `tabular-nums` en horas, cifras y conteos.
- Etiquetas en versalitas sobre blanco: `text-navy/62` como mínimo (contraste ≈4,8:1). **Nunca** `/55` en texto de 11,5 px.
- Área clicable de "Editar" ≥ 24 px de alto.
- Valores de `Institucion.tipo`: exactamente `universidad` | `tecnica` | `colegio`. Etiquetas: `Universidad`, `Técnica`, `Colegio`.
- Valores de `User.tipo` al terminar: exactamente `practicante` | `natural`. Etiquetas: `Practicante`, `Voluntario natural`.
- Los naturales guardan `institucionId = NULL` y `sedeId = NULL`.
- No se borran instituciones ni sedes: solo se inactivan.
- La importación **nunca crea** instituciones ni sedes.
- Commits en español, Conventional Commits, imperativo y minúscula, **sin línea `Co-Authored-By`**.

## Review Focus

1. **Variantes de mayúsculas o espacios al migrar** ("Universidad Nacional", "universidad nacional ") → deben quedar como **una** institución y todos sus practicantes enlazados. Lo cubre la verificación de la Tarea 2 (paso 4).
2. **Editar a un usuario cuya institución se inactivó después** → se guarda sin error y la conserva. Lo cubre la Tarea 6 (test "conserva una institución inactiva que ya tenía").
3. **Formulario manipulado con el id de una sede inactiva o inexistente** → se rechaza con "Esa sede ya no está disponible; elige otra". Lo cubre la Tarea 6.
4. **Excel con el nombre de la institución en otras mayúsculas o sin tildes** → se reconoce. Lo cubre la Tarea 6 (test de `classifyImportRows`).
5. **Cambiar de institución después de escribir las horas a mano** → la precarga no pisa lo escrito. Lo cubre la Tarea 7 (`precargar`).

---

### Task 1: Módulos puros del catálogo

**Files:**
- Create: `src/lib/catalogo/nombres.ts`, `src/lib/catalogo/institucion.ts`, `src/lib/catalogo/sede.ts`
- Modify: `src/lib/usuarios/userInput.ts` (exportar `HHMM` y `minutesOf`)
- Test: `src/lib/catalogo/nombres.test.ts`, `src/lib/catalogo/institucion.test.ts`, `src/lib/catalogo/sede.test.ts`

**Interfaces:**
- Produces (`nombres.ts`):
  - `MAX_NOMBRE = 150`
  - `cleanText(raw: unknown): string`
  - `normalizeNombre(raw: string): string`
  - `interface CatalogEntry { id: number; nombre: string; activa: boolean }`
  - `buildCatalogIndex<T extends CatalogEntry>(items: readonly T[]): Map<string, T>`
  - `opcionesVisibles<T extends CatalogEntry>(items: readonly T[], actualId: number | null): T[]`
  - `etiquetaOpcion(item: CatalogEntry): string`
- Produces (`institucion.ts`):
  - `TIPOS_INSTITUCION`, `type TipoInstitucion`, `TIPO_INSTITUCION_LABEL`, `TIPO_INSTITUCION_GRUPO`, `isTipoInstitucion(value: unknown)`
  - `interface InstitucionOpcion { id: number; nombre: string; tipo: TipoInstitucion; horasExigidas: number; activa: boolean }`
  - `interface InstitucionInput { nombre: string; tipo: TipoInstitucion; horasExigidas: number; activa: boolean }`
  - `type InstitucionField = "nombre" | "tipo" | "horasExigidas"`
  - `validateInstitucionInput(raw): { ok: true; value: InstitucionInput } | { ok: false; errors: Partial<Record<InstitucionField, string>> }`
  - `agruparInstituciones(items: readonly InstitucionOpcion[], actualId: number | null): { value: string; items: InstitucionOpcion[] }[]`
- Produces (`sede.ts`):
  - `interface SedeOpcion { id: number; nombre: string; direccion: string | null; horaApertura: string | null; horaCierre: string | null; activa: boolean }`
  - `interface SedeInput { nombre: string; direccion: string | null; horaApertura: string | null; horaCierre: string | null; activa: boolean }`
  - `type SedeField = "nombre" | "direccion" | "horaApertura" | "horaCierre"`
  - `validateSedeInput(raw): { ok: true; value: SedeInput } | { ok: false; errors: Partial<Record<SedeField, string>> }`
  - `formatHorario(apertura: string | null, cierre: string | null): string`
- Produces (`userInput.ts`): `export const HHMM: RegExp`, `export function minutesOf(hhmm: string): number`

- [ ] **Step 1: Exportar `HHMM` y `minutesOf` en `src/lib/usuarios/userInput.ts`**

Cambiar `const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;` por `export const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;` y `function minutesOf(hhmm: string): number {` por `export function minutesOf(hhmm: string): number {`. Nada más cambia en ese archivo.

- [ ] **Step 2: Escribir las pruebas que fallan**

`src/lib/catalogo/nombres.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCatalogIndex, cleanText, etiquetaOpcion, normalizeNombre, opcionesVisibles } from "./nombres";

describe("cleanText", () => {
  it("recorta y junta espacios repetidos; lo que no es texto queda vacío", () => {
    expect(cleanText("  Sede   Centro ")).toBe("Sede Centro");
    expect(cleanText(null)).toBe("");
    expect(cleanText(42)).toBe("");
  });
});

describe("normalizeNombre", () => {
  it("ignora tildes, mayúsculas y espacios sobrantes", () => {
    expect(normalizeNombre("  Bodega   Fontibón ")).toBe("bodega fontibon");
    expect(normalizeNombre("UNIVERSIDAD NACIONAL")).toBe(normalizeNombre("universidad nacional"));
  });
});

describe("buildCatalogIndex", () => {
  it("encuentra una entrada escrita de otra forma", () => {
    const index = buildCatalogIndex([{ id: 3, nombre: "Bodega Fontibón", activa: true }]);
    expect(index.get(normalizeNombre("bodega fontibon"))?.id).toBe(3);
    expect(index.get(normalizeNombre("Bodega Kennedy"))).toBeUndefined();
  });
});

describe("opcionesVisibles", () => {
  const items = [
    { id: 1, nombre: "Sede Centro", activa: true },
    { id: 2, nombre: "Bodega Vieja", activa: false },
  ];

  it("muestra solo las activas", () => {
    expect(opcionesVisibles(items, null).map((item) => item.id)).toEqual([1]);
  });

  it("incluye la inactiva si es la que ya tiene el usuario", () => {
    expect(opcionesVisibles(items, 2).map((item) => item.id)).toEqual([1, 2]);
  });
});

describe("etiquetaOpcion", () => {
  it("rotula las inactivas", () => {
    expect(etiquetaOpcion({ id: 1, nombre: "Sede Centro", activa: true })).toBe("Sede Centro");
    expect(etiquetaOpcion({ id: 2, nombre: "Bodega Vieja", activa: false })).toBe("Bodega Vieja (inactiva)");
  });
});
```

`src/lib/catalogo/institucion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { type InstitucionOpcion, agruparInstituciones, isTipoInstitucion, validateInstitucionInput } from "./institucion";

describe("isTipoInstitucion", () => {
  it("acepta solo universidad, técnica y colegio", () => {
    expect(isTipoInstitucion("universidad")).toBe(true);
    expect(isTipoInstitucion("tecnica")).toBe(true);
    expect(isTipoInstitucion("colegio")).toBe(true);
    expect(isTipoInstitucion("Técnica")).toBe(false);
    expect(isTipoInstitucion(undefined)).toBe(false);
  });
});

describe("validateInstitucionInput", () => {
  const valid = { nombre: "  Universidad   Nacional ", tipo: "universidad", horasExigidas: "240" };

  it("normaliza una institución válida; activa por defecto", () => {
    expect(validateInstitucionInput(valid)).toEqual({
      ok: true,
      value: { nombre: "Universidad Nacional", tipo: "universidad", horasExigidas: 240, activa: true },
    });
  });

  it("lee el estado del formulario", () => {
    const result = validateInstitucionInput({ ...valid, activa: "false" });
    expect(result.ok && result.value.activa).toBe(false);
  });

  it("explica cada error en español llano", () => {
    expect(validateInstitucionInput({ nombre: "", tipo: "empresa", horasExigidas: "" })).toEqual({
      ok: false,
      errors: {
        nombre: "Falta el nombre",
        tipo: "Elige si es universidad, técnica o colegio",
        horasExigidas: "Faltan las horas exigidas",
      },
    });
  });

  it("las horas son un entero entre 1 y 5000", () => {
    for (const horas of ["0", "12.5", "doscientas", "5001"]) {
      const result = validateInstitucionInput({ ...valid, horasExigidas: horas });
      expect(!result.ok && result.errors.horasExigidas).toBe("Las horas deben ser un número entero entre 1 y 5000");
    }
  });

  it("limita el nombre a 150 letras", () => {
    const result = validateInstitucionInput({ ...valid, nombre: "a".repeat(151) });
    expect(!result.ok && result.errors.nombre).toBe("El nombre puede tener hasta 150 letras");
  });
});

describe("agruparInstituciones", () => {
  const items: InstitucionOpcion[] = [
    { id: 1, nombre: "Universidad Nacional", tipo: "universidad", horasExigidas: 240, activa: true },
    { id: 2, nombre: "Colegio San José", tipo: "colegio", horasExigidas: 80, activa: true },
    { id: 3, nombre: "Universidad Cerrada", tipo: "universidad", horasExigidas: 240, activa: false },
  ];

  it("agrupa por tipo en orden universidad, técnica, colegio y omite grupos vacíos", () => {
    expect(agruparInstituciones(items, null)).toEqual([
      { value: "Universidades", items: [items[0]] },
      { value: "Colegios", items: [items[1]] },
    ]);
  });

  it("incluye la inactiva que ya tiene el usuario", () => {
    expect(agruparInstituciones(items, 3)[0]?.items.map((item) => item.id)).toEqual([1, 3]);
  });
});
```

`src/lib/catalogo/sede.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatHorario, validateSedeInput } from "./sede";

describe("validateSedeInput", () => {
  it("normaliza una sede válida; dirección y horario son opcionales", () => {
    expect(validateSedeInput({ nombre: " Sede  Centro ", direccion: " ", horaApertura: "", horaCierre: "" })).toEqual({
      ok: true,
      value: { nombre: "Sede Centro", direccion: null, horaApertura: null, horaCierre: null, activa: true },
    });
  });

  it("guarda dirección y horario", () => {
    const result = validateSedeInput({
      nombre: "Bodega Fontibón",
      direccion: "Av. Centenario # 98-12",
      horaApertura: "06:00",
      horaCierre: "15:00",
      activa: "false",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        nombre: "Bodega Fontibón",
        direccion: "Av. Centenario # 98-12",
        horaApertura: "06:00",
        horaCierre: "15:00",
        activa: false,
      },
    });
  });

  it("exige apertura y cierre juntos, y cierre después de apertura", () => {
    const soloApertura = validateSedeInput({ nombre: "Sede", horaApertura: "07:00" });
    expect(!soloApertura.ok && soloApertura.errors).toEqual({ horaCierre: "Falta la hora de cierre" });

    const soloCierre = validateSedeInput({ nombre: "Sede", horaCierre: "17:00" });
    expect(!soloCierre.ok && soloCierre.errors).toEqual({ horaApertura: "Falta la hora de apertura" });

    const alReves = validateSedeInput({ nombre: "Sede", horaApertura: "17:00", horaCierre: "07:00" });
    expect(!alReves.ok && alReves.errors).toEqual({ horaCierre: "La hora de cierre debe ser después de la apertura" });
  });

  it("explica formato y largo en español llano", () => {
    const result = validateSedeInput({ nombre: "", direccion: "x".repeat(201), horaApertura: "7am", horaCierre: "17:00" });
    expect(!result.ok && result.errors).toEqual({
      nombre: "Falta el nombre",
      direccion: "La dirección puede tener hasta 200 letras",
      horaApertura: "Escribe la hora como 07:00",
    });
  });
});

describe("formatHorario", () => {
  it("une apertura y cierre, o dice que no hay horario", () => {
    expect(formatHorario("07:00", "17:00")).toBe("07:00 – 17:00");
    expect(formatHorario(null, null)).toBe("Sin horario");
  });
});
```

- [ ] **Step 3: Correr las pruebas y verificar que fallan**

Run: `pnpm test src/lib/catalogo`
Expected: FAIL con "Failed to resolve import" de `./nombres`, `./institucion` y `./sede`.

- [ ] **Step 4: Implementar los módulos**

`src/lib/catalogo/nombres.ts`:

```ts
/**
 * Nombres de instituciones y sedes (maqueta 4f). Se comparan sin tildes,
 * mayúsculas ni espacios sobrantes, como los escribe la coordinadora en Excel.
 * Módulo puro: lo usan la validación, la importación y el formulario.
 */

export const MAX_NOMBRE = 150;

/** Recorta y junta espacios repetidos; lo que no es texto queda vacío. */
export function cleanText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

export function normalizeNombre(raw: string): string {
  return cleanText(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface CatalogEntry {
  id: number;
  nombre: string;
  activa: boolean;
}

/** Nombre normalizado → entrada, para resolver las celdas del Excel. */
export function buildCatalogIndex<T extends CatalogEntry>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [normalizeNombre(item.nombre), item]));
}

/**
 * Lo que ofrece un desplegable: las activas, más la que el usuario ya tiene
 * aunque se haya inactivado, para que no se pierda en silencio al editar.
 */
export function opcionesVisibles<T extends CatalogEntry>(items: readonly T[], actualId: number | null): T[] {
  return items.filter((item) => item.activa || item.id === actualId);
}

export function etiquetaOpcion(item: CatalogEntry): string {
  return item.activa ? item.nombre : `${item.nombre} (inactiva)`;
}
```

`src/lib/catalogo/institucion.ts`:

```ts
/**
 * Instituciones educativas de las que vienen los practicantes (maqueta 4f).
 * El tipo (universidad / técnica / colegio) vive aquí y no en el usuario.
 */

import { MAX_NOMBRE, cleanText, opcionesVisibles } from "./nombres";

export const TIPOS_INSTITUCION = ["universidad", "tecnica", "colegio"] as const;
export type TipoInstitucion = (typeof TIPOS_INSTITUCION)[number];

export const TIPO_INSTITUCION_LABEL: Record<TipoInstitucion, string> = {
  universidad: "Universidad",
  tecnica: "Técnica",
  colegio: "Colegio",
};

/** Encabezado de cada grupo en el desplegable del formulario. */
export const TIPO_INSTITUCION_GRUPO: Record<TipoInstitucion, string> = {
  universidad: "Universidades",
  tecnica: "Técnicas",
  colegio: "Colegios",
};

export function isTipoInstitucion(value: unknown): value is TipoInstitucion {
  return typeof value === "string" && (TIPOS_INSTITUCION as readonly string[]).includes(value);
}

export interface InstitucionOpcion {
  id: number;
  nombre: string;
  tipo: TipoInstitucion;
  /** Se propone como horas requeridas al asignarla; 0 = aún sin definir. */
  horasExigidas: number;
  activa: boolean;
}

export interface InstitucionInput {
  nombre: string;
  tipo: TipoInstitucion;
  horasExigidas: number;
  activa: boolean;
}

export type InstitucionField = "nombre" | "tipo" | "horasExigidas";
export type InstitucionErrors = Partial<Record<InstitucionField, string>>;

export function validateInstitucionInput(
  raw: Partial<Record<InstitucionField | "activa", unknown>>
): { ok: true; value: InstitucionInput } | { ok: false; errors: InstitucionErrors } {
  const errors: InstitucionErrors = {};

  const nombre = cleanText(raw.nombre);
  if (!nombre) errors.nombre = "Falta el nombre";
  else if (nombre.length > MAX_NOMBRE) errors.nombre = `El nombre puede tener hasta ${MAX_NOMBRE} letras`;

  const tipo = cleanText(raw.tipo);
  if (!isTipoInstitucion(tipo)) errors.tipo = "Elige si es universidad, técnica o colegio";

  const horasRaw = cleanText(raw.horasExigidas);
  const horas = Number(horasRaw.replace(",", "."));
  if (!horasRaw) errors.horasExigidas = "Faltan las horas exigidas";
  else if (!Number.isInteger(horas) || horas <= 0 || horas > 5000) {
    errors.horasExigidas = "Las horas deben ser un número entero entre 1 y 5000";
  }

  if (Object.keys(errors).length > 0 || !isTipoInstitucion(tipo)) return { ok: false, errors };
  return {
    ok: true,
    value: { nombre, tipo, horasExigidas: horas, activa: raw.activa !== "false" && raw.activa !== false },
  };
}

/** Grupos del combobox del formulario: Universidades, Técnicas, Colegios. */
export function agruparInstituciones(
  items: readonly InstitucionOpcion[],
  actualId: number | null
): { value: string; items: InstitucionOpcion[] }[] {
  const visibles = opcionesVisibles(items, actualId);
  return TIPOS_INSTITUCION.map((tipo) => ({
    value: TIPO_INSTITUCION_GRUPO[tipo],
    items: visibles.filter((item) => item.tipo === tipo),
  })).filter((grupo) => grupo.items.length > 0);
}
```

`src/lib/catalogo/sede.ts`:

```ts
/** Sedes: lugares físicos donde se practica (maqueta 4f). */

import { HHMM, minutesOf } from "@/lib/usuarios/userInput";
import { MAX_NOMBRE, cleanText } from "./nombres";

const MAX_DIRECCION = 200;

export interface SedeOpcion {
  id: number;
  nombre: string;
  direccion: string | null;
  /** Horario por defecto de sus practicantes, "HH:mm". */
  horaApertura: string | null;
  horaCierre: string | null;
  activa: boolean;
}

export interface SedeInput {
  nombre: string;
  direccion: string | null;
  horaApertura: string | null;
  horaCierre: string | null;
  activa: boolean;
}

export type SedeField = "nombre" | "direccion" | "horaApertura" | "horaCierre";
export type SedeErrors = Partial<Record<SedeField, string>>;

export function validateSedeInput(
  raw: Partial<Record<SedeField | "activa", unknown>>
): { ok: true; value: SedeInput } | { ok: false; errors: SedeErrors } {
  const errors: SedeErrors = {};

  const nombre = cleanText(raw.nombre);
  if (!nombre) errors.nombre = "Falta el nombre";
  else if (nombre.length > MAX_NOMBRE) errors.nombre = `El nombre puede tener hasta ${MAX_NOMBRE} letras`;

  const direccion = cleanText(raw.direccion);
  if (direccion.length > MAX_DIRECCION) errors.direccion = `La dirección puede tener hasta ${MAX_DIRECCION} letras`;

  const horaApertura = cleanText(raw.horaApertura) || null;
  const horaCierre = cleanText(raw.horaCierre) || null;
  if (horaApertura && !HHMM.test(horaApertura)) errors.horaApertura = "Escribe la hora como 07:00";
  if (horaCierre && !HHMM.test(horaCierre)) errors.horaCierre = "Escribe la hora como 17:00";
  if (!errors.horaApertura && !errors.horaCierre) {
    if (horaApertura && !horaCierre) errors.horaCierre = "Falta la hora de cierre";
    else if (!horaApertura && horaCierre) errors.horaApertura = "Falta la hora de apertura";
    else if (horaApertura && horaCierre && minutesOf(horaCierre) <= minutesOf(horaApertura)) {
      errors.horaCierre = "La hora de cierre debe ser después de la apertura";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      nombre,
      direccion: direccion || null,
      horaApertura,
      horaCierre,
      activa: raw.activa !== "false" && raw.activa !== false,
    },
  };
}

/** "07:00 – 17:00" o "Sin horario" (tarjeta de sede). */
export function formatHorario(apertura: string | null, cierre: string | null): string {
  return apertura && cierre ? `${apertura} – ${cierre}` : "Sin horario";
}
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

Run: `pnpm test src/lib/catalogo src/lib/usuarios/userInput.test.ts`
Expected: PASS en todas.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalogo src/lib/usuarios/userInput.ts
git commit -m "feat(catalogo): agrega la validación pura de instituciones y sedes"
```

---

### Task 2: Esquema, migración de expansión y servicio del catálogo

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_instituciones_y_sedes/migration.sql` (generado y editado)
- Create: `src/lib/server/catalogoService.ts`
- Test: `src/lib/server/catalogoService.test.ts`

**Interfaces:**
- Consumes: `InstitucionInput`, `InstitucionOpcion`, `isTipoInstitucion` (Task 1); `SedeInput`, `SedeOpcion` (Task 1).
- Produces:
  - Modelos Prisma `Institucion`, `Sede`; `User.institucionId Int?`, `User.institucion`, `User.sedeId Int?`, `User.sede`. Las columnas `User.universidad` y `User.entidad` **siguen existiendo** hasta la Task 8.
  - `listCatalogo(): Promise<{ instituciones: InstitucionOpcion[]; sedes: SedeOpcion[] }>` (activas primero, luego por nombre)
  - `interface InstitucionConConteo extends InstitucionOpcion { activos: number }`
  - `interface SedeConConteo extends SedeOpcion { practicantes: number }`
  - `listCatalogoConConteos(): Promise<{ instituciones: InstitucionConConteo[]; sedes: SedeConConteo[] }>`
  - `type GuardarCatalogoResult = { ok: true; id: number } | { ok: false; reason: "duplicado" | "no-encontrado" }`
  - `guardarInstitucion(id: number | null, input: InstitucionInput): Promise<GuardarCatalogoResult>`
  - `guardarSede(id: number | null, input: SedeInput): Promise<GuardarCatalogoResult>`

- [ ] **Step 1: Agregar los modelos a `prisma/schema.prisma`**

En `model User`, debajo de `entidad String?` (que se queda por ahora), agregar:

```prisma
  // Catálogo de la maqueta 4f. NULL para voluntarios naturales.
  institucionId   Int?
  institucion     Institucion?    @relation(fields: [institucionId], references: [id])
  sedeId          Int?
  sede            Sede?           @relation(fields: [sedeId], references: [id])
```

Y junto a `@@index([tipo])`:

```prisma
  @@index([institucionId])
  @@index([sedeId])
```

Al final del archivo:

```prisma
// Instituciones educativas (maqueta 4f). El tipo universidad | tecnica | colegio
// vive aquí, no en el usuario (src/lib/catalogo/institucion.ts). No se borran:
// se inactivan.
model Institucion {
  id            Int     @id @default(autoincrement())
  // La intercalación por defecto de SQL Server no distingue mayúsculas: el
  // UNIQUE impide "universidad nacional" si ya existe "Universidad Nacional".
  nombre        String  @unique @db.NVarChar(150)
  tipo          String  @db.VarChar(20)
  // Se propone como horasRequeridas al asignarla; cada usuario conserva el suyo.
  horasExigidas Int     @default(0)
  activa        Boolean @default(true)
  usuarios      User[]
}

// Sedes: lugares físicos donde se practica (maqueta 4f). No se borran: se inactivan.
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

- [ ] **Step 2: Sembrar variantes para probar la migración**

Antes de migrar, crear en la base de desarrollo tres practicantes con la misma institución escrita de tres formas. Así el paso 4 puede verificar que se unen:

```bash
pnpm exec tsx -e '
process.loadEnvFile(".env");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
await prisma.user.createMany({ data: [
  { cedula: "990066001", nombre: "Variante Uno", tipo: "universidad", universidad: "Universidad Variante", entidad: "Sede Variante", horasRequeridas: 240 },
  { cedula: "990066002", nombre: "Variante Dos", tipo: "universidad", universidad: "universidad variante ", entidad: " SEDE VARIANTE", horasRequeridas: 240 },
  { cedula: "990066003", nombre: "Variante Tres", tipo: "colegio", universidad: "UNIVERSIDAD VARIANTE", entidad: "Sede Variante", horasRequeridas: 120 },
]});
await prisma.$disconnect();
'
```

- [ ] **Step 3: Generar la migración y agregarle el llenado de datos**

Run: `pnpm exec prisma migrate dev --create-only --name instituciones_y_sedes`

Abrir el `migration.sql` generado. Justo **antes** de `COMMIT TRAN;`, pegar:

```sql
-- Catálogo a partir del texto libre que ya existe (maqueta 4f): nadie vuelve a
-- digitar nada. La intercalación por defecto no distingue mayúsculas, así que
-- "Universidad Nacional" y "universidad nacional " quedan como una sola.
-- Tipo y horas exigidas: el valor más frecuente entre sus usuarios.
-- EXEC porque SQL Server compila el lote antes de que existan las columnas nuevas.
EXEC('
INSERT INTO [dbo].[Institucion] ([nombre], [tipo], [horasExigidas], [activa])
SELECT n.[nombre],
       ISNULL((SELECT TOP 1 u.[tipo] FROM [dbo].[User] u
               WHERE LEFT(LTRIM(RTRIM(u.[universidad])), 150) = n.[nombre]
                 AND u.[tipo] IN (''universidad'', ''colegio'')
               GROUP BY u.[tipo]
               ORDER BY COUNT(*) DESC, u.[tipo] DESC), ''universidad''),
       ISNULL((SELECT TOP 1 u.[horasRequeridas] FROM [dbo].[User] u
               WHERE LEFT(LTRIM(RTRIM(u.[universidad])), 150) = n.[nombre]
                 AND u.[horasRequeridas] > 0
               GROUP BY u.[horasRequeridas]
               ORDER BY COUNT(*) DESC, u.[horasRequeridas] DESC), 0),
       1
FROM (SELECT DISTINCT LEFT(LTRIM(RTRIM([universidad])), 150) AS [nombre]
      FROM [dbo].[User]
      WHERE [tipo] <> ''natural'' AND LTRIM(RTRIM(ISNULL([universidad], N''''))) <> N'''') AS n;

INSERT INTO [dbo].[Sede] ([nombre], [activa])
SELECT DISTINCT LEFT(LTRIM(RTRIM([entidad])), 150), 1
FROM [dbo].[User]
WHERE [tipo] <> ''natural'' AND LTRIM(RTRIM(ISNULL([entidad], N''''))) <> N'''';

UPDATE u SET u.[institucionId] = i.[id]
FROM [dbo].[User] u
JOIN [dbo].[Institucion] i ON i.[nombre] = LEFT(LTRIM(RTRIM(u.[universidad])), 150)
WHERE u.[tipo] <> ''natural'';

UPDATE u SET u.[sedeId] = s.[id]
FROM [dbo].[User] u
JOIN [dbo].[Sede] s ON s.[nombre] = LEFT(LTRIM(RTRIM(u.[entidad])), 150)
WHERE u.[tipo] <> ''natural'';
');
```

Run: `pnpm exec prisma migrate dev`
Expected: "Your database is now in sync with your schema" y el cliente regenerado.

- [ ] **Step 4: Verificar el llenado**

```bash
pnpm exec tsx -e '
process.loadEnvFile(".env");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
console.log("variantes →", await prisma.institucion.findMany({ where: { nombre: "Universidad Variante" } }));
console.log("sedes variante →", await prisma.sede.count({ where: { nombre: "Sede Variante" } }));
console.log("practicantes sin institución o sede →", await prisma.user.count({
  where: { tipo: { not: "natural" }, OR: [{ institucionId: null }, { sedeId: null }] },
}));
await prisma.user.deleteMany({ where: { cedula: { startsWith: "990066" } } });
await prisma.institucion.deleteMany({ where: { nombre: "Universidad Variante" } });
await prisma.sede.deleteMany({ where: { nombre: "Sede Variante" } });
await prisma.$disconnect();
'
```

Expected: una sola institución "Universidad Variante" (en cualquier mezcla de mayúsculas) con `tipo: "universidad"` (2 contra 1) y `horasExigidas: 240`, `sedes variante → 1` y `practicantes sin institución o sede → 0`. Si el último número no es 0, listar esos usuarios y revisar si su `universidad`/`entidad` venía vacía antes de seguir.

- [ ] **Step 5: Escribir las pruebas que fallan del servicio**

`src/lib/server/catalogoService.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardarInstitucion, guardarSede, listCatalogo, listCatalogoConConteos } from "./catalogoService";
import { prisma } from "./prisma";

// Prefijos propios para no chocar con datos reales del entorno de desarrollo.
const NOMBRE = "Zz Prueba Catálogo";
const CEDULA = "990055";

async function cleanup() {
  await prisma.user.deleteMany({ where: { cedula: { startsWith: CEDULA } } });
  await prisma.institucion.deleteMany({ where: { nombre: { startsWith: NOMBRE } } });
  await prisma.sede.deleteMany({ where: { nombre: { startsWith: NOMBRE } } });
}

beforeAll(cleanup);
afterAll(cleanup);

describe("guardarInstitucion", () => {
  it("crea, edita y rechaza un nombre repetido aunque cambien las mayúsculas", async () => {
    const creada = await guardarInstitucion(null, {
      nombre: `${NOMBRE} Universidad`,
      tipo: "universidad",
      horasExigidas: 240,
      activa: true,
    });
    expect(creada.ok).toBe(true);
    if (!creada.ok) return;

    const editada = await guardarInstitucion(creada.id, {
      nombre: `${NOMBRE} Universidad`,
      tipo: "tecnica",
      horasExigidas: 320,
      activa: false,
    });
    expect(editada).toEqual({ ok: true, id: creada.id });

    const repetida = await guardarInstitucion(null, {
      nombre: `${NOMBRE} UNIVERSIDAD`.toLowerCase(),
      tipo: "colegio",
      horasExigidas: 80,
      activa: true,
    });
    expect(repetida).toEqual({ ok: false, reason: "duplicado" });
  });

  it("avisa si la que se edita ya no existe", async () => {
    expect(
      await guardarInstitucion(999_999_999, { nombre: `${NOMBRE} Fantasma`, tipo: "colegio", horasExigidas: 80, activa: true })
    ).toEqual({ ok: false, reason: "no-encontrado" });
  });
});

describe("listCatalogo / listCatalogoConConteos", () => {
  it("activas primero y cuenta solo usuarios activos", async () => {
    const sede = await guardarSede(null, {
      nombre: `${NOMBRE} Sede`,
      direccion: "Cra. 13 # 24-50",
      horaApertura: "07:00",
      horaCierre: "17:00",
      activa: true,
    });
    const inactiva = await guardarSede(null, {
      nombre: `${NOMBRE} Aaa Sede Cerrada`,
      direccion: null,
      horaApertura: null,
      horaCierre: null,
      activa: false,
    });
    expect(sede.ok && inactiva.ok).toBe(true);
    if (!sede.ok || !inactiva.ok) return;

    await prisma.user.createMany({
      data: [
        { cedula: `${CEDULA}001`, nombre: "Activa Catálogo", sedeId: sede.id },
        { cedula: `${CEDULA}002`, nombre: "Inactiva Catálogo", sedeId: sede.id, activo: false },
      ],
    });

    const { sedes } = await listCatalogo();
    const nuestras = sedes.filter((item) => item.nombre.startsWith(NOMBRE)).map((item) => item.nombre);
    // "Aaa…" va antes por nombre, pero está inactiva: va al final.
    expect(nuestras).toEqual([`${NOMBRE} Sede`, `${NOMBRE} Aaa Sede Cerrada`]);

    const conConteos = await listCatalogoConConteos();
    expect(conConteos.sedes.find((item) => item.id === sede.id)).toMatchObject({
      practicantes: 1,
      direccion: "Cra. 13 # 24-50",
      horaApertura: "07:00",
    });
    expect(conConteos.sedes.find((item) => item.id === inactiva.id)?.practicantes).toBe(0);
  });
});
```

- [ ] **Step 6: Correr y verificar que fallan**

Run: `pnpm test src/lib/server/catalogoService.test.ts`
Expected: FAIL con "Failed to resolve import ./catalogoService".

- [ ] **Step 7: Implementar `src/lib/server/catalogoService.ts`**

```ts
import { Prisma } from "@prisma/client";
import { type InstitucionInput, type InstitucionOpcion, isTipoInstitucion } from "@/lib/catalogo/institucion";
import type { SedeInput, SedeOpcion } from "@/lib/catalogo/sede";
import { prisma } from "./prisma";

// Activas primero: las inactivas van al final de cada lista (maqueta 4f).
// Sirve para los dos modelos: ambos tienen `activa` y `nombre`.
const ORDEN = [{ activa: "desc" as const }, { nombre: "asc" as const }];

function toInstitucionOpcion(row: Omit<InstitucionOpcion, "tipo"> & { tipo: string }): InstitucionOpcion {
  return { ...row, tipo: isTipoInstitucion(row.tipo) ? row.tipo : "universidad" };
}

/** Catálogo completo para desplegables, filtros e importación. */
export async function listCatalogo(): Promise<{ instituciones: InstitucionOpcion[]; sedes: SedeOpcion[] }> {
  const [instituciones, sedes] = await Promise.all([
    prisma.institucion.findMany({
      orderBy: ORDEN,
      select: { id: true, nombre: true, tipo: true, horasExigidas: true, activa: true },
    }),
    prisma.sede.findMany({
      orderBy: ORDEN,
      select: { id: true, nombre: true, direccion: true, horaApertura: true, horaCierre: true, activa: true },
    }),
  ]);
  return { instituciones: instituciones.map(toInstitucionOpcion), sedes };
}

export interface InstitucionConConteo extends InstitucionOpcion {
  activos: number;
}

export interface SedeConConteo extends SedeOpcion {
  practicantes: number;
}

/**
 * Pantalla 4f: cada entrada con sus usuarios activos. Dos consultas agrupadas
 * para toda la pantalla, nunca una por tarjeta.
 */
export async function listCatalogoConConteos(): Promise<{
  instituciones: InstitucionConConteo[];
  sedes: SedeConConteo[];
}> {
  const [{ instituciones, sedes }, porInstitucion, porSede] = await Promise.all([
    listCatalogo(),
    prisma.user.groupBy({
      by: ["institucionId"],
      where: { activo: true, institucionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["sedeId"],
      where: { activo: true, sedeId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const activos = new Map(porInstitucion.map((row) => [row.institucionId, row._count._all]));
  const practicantes = new Map(porSede.map((row) => [row.sedeId, row._count._all]));
  return {
    instituciones: instituciones.map((item) => ({ ...item, activos: activos.get(item.id) ?? 0 })),
    sedes: sedes.map((item) => ({ ...item, practicantes: practicantes.get(item.id) ?? 0 })),
  };
}

export type GuardarCatalogoResult = { ok: true; id: number } | { ok: false; reason: "duplicado" | "no-encontrado" };

function prismaCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

async function guardar(run: () => Promise<{ id: number }>): Promise<GuardarCatalogoResult> {
  try {
    return { ok: true, id: (await run()).id };
  } catch (error) {
    // P2002: nombre repetido (UNIQUE). P2025: se editó una que ya no existe.
    if (prismaCode(error) === "P2002") return { ok: false, reason: "duplicado" };
    if (prismaCode(error) === "P2025") return { ok: false, reason: "no-encontrado" };
    throw error;
  }
}

export function guardarInstitucion(id: number | null, input: InstitucionInput): Promise<GuardarCatalogoResult> {
  return guardar(() =>
    id === null
      ? prisma.institucion.create({ data: input, select: { id: true } })
      : prisma.institucion.update({ where: { id }, data: input, select: { id: true } })
  );
}

export function guardarSede(id: number | null, input: SedeInput): Promise<GuardarCatalogoResult> {
  return guardar(() =>
    id === null
      ? prisma.sede.create({ data: input, select: { id: true } })
      : prisma.sede.update({ where: { id }, data: input, select: { id: true } })
  );
}
```

- [ ] **Step 8: Correr las pruebas y verificar que pasan**

Run: `pnpm test src/lib/server/catalogoService.test.ts && pnpm exec tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/server/catalogoService.ts src/lib/server/catalogoService.test.ts
git commit -m "feat(db): crea el catálogo de instituciones y sedes a partir del texto existente"
```

---

### Task 3: Pantalla "Instituciones y sedes"

**Files:**
- Modify: `src/components/admin/nav-config.ts:46`
- Create: `src/app/admin/instituciones-y-sedes/page.tsx`
- Create: `src/app/admin/instituciones-y-sedes/actions.ts`
- Create: `src/app/admin/instituciones-y-sedes/catalogo-ui.tsx`
- Create: `src/app/admin/instituciones-y-sedes/institucion-dialog.tsx`
- Create: `src/app/admin/instituciones-y-sedes/sede-dialog.tsx`

**Interfaces:**
- Consumes: `listCatalogoConConteos`, `guardarInstitucion`, `guardarSede`, `InstitucionConConteo`, `SedeConConteo` (Task 2); `validateInstitucionInput`, `validateSedeInput`, `formatHorario`, `TIPOS_INSTITUCION`, `TIPO_INSTITUCION_LABEL`, `InstitucionOpcion`, `SedeOpcion` (Task 1).
- Produces: ruta `/admin/instituciones-y-sedes`; `type CatalogoActionResult = { ok: true } | { ok: false; errors?: Partial<Record<string, string>>; message?: string }`.

- [ ] **Step 1: Habilitar el ítem del menú**

En `src/components/admin/nav-config.ts`, reemplazar
`{ id: "entidades-sedes", label: "Entidades y sedes", href: null },` por:

```ts
      { id: "instituciones-sedes", label: "Instituciones y sedes", href: "/admin/instituciones-y-sedes" },
```

- [ ] **Step 2: Server actions — `actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { validateInstitucionInput } from "@/lib/catalogo/institucion";
import { validateSedeInput } from "@/lib/catalogo/sede";
import { auth } from "@/lib/server/auth";
import { guardarInstitucion, guardarSede } from "@/lib/server/catalogoService";

export type CatalogoActionResult =
  | { ok: true }
  | { ok: false; errors?: Partial<Record<string, string>>; message?: string };

const SESION_TERMINADA = "Tu sesión terminó. Vuelve a iniciar sesión para guardar.";

function parseId(formData: FormData): number | null {
  const id = Number(formData.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function revalidar() {
  revalidatePath("/admin/instituciones-y-sedes");
  revalidatePath("/admin/usuarios");
}

// Las server actions son endpoints públicos: se verifica la sesión en cada una.
export async function guardarInstitucionAction(formData: FormData): Promise<CatalogoActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: SESION_TERMINADA };

  const parsed = validateInstitucionInput({
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo"),
    horasExigidas: formData.get("horasExigidas"),
    activa: formData.get("activa") ?? "true",
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const result = await guardarInstitucion(parseId(formData), parsed.value);
  if (!result.ok) {
    return result.reason === "duplicado"
      ? { ok: false, errors: { nombre: "Ya existe una institución con ese nombre" } }
      : { ok: false, message: "Esa institución ya no existe. Recarga la página." };
  }
  revalidar();
  return { ok: true };
}

export async function guardarSedeAction(formData: FormData): Promise<CatalogoActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: SESION_TERMINADA };

  const parsed = validateSedeInput({
    nombre: formData.get("nombre"),
    direccion: formData.get("direccion"),
    horaApertura: formData.get("horaApertura"),
    horaCierre: formData.get("horaCierre"),
    activa: formData.get("activa") ?? "true",
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const result = await guardarSede(parseId(formData), parsed.value);
  if (!result.ok) {
    return result.reason === "duplicado"
      ? { ok: false, errors: { nombre: "Ya existe una sede con ese nombre" } }
      : { ok: false, message: "Esa sede ya no existe. Recarga la página." };
  }
  revalidar();
  return { ok: true };
}
```

- [ ] **Step 3: Piezas compartidas de los modales — `catalogo-ui.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { Button } from "@/components/ui/button";
import type { CatalogoActionResult } from "./actions";

export type TriggerStyle = "primario" | "secundario" | "enlace";

/** Elemento que `DialogTrigger` usa como botón (prop `render` de Base UI). */
export function triggerRender(style: TriggerStyle) {
  if (style === "enlace") {
    // ≥ 24 px de alto: la maqueta lo dibuja como texto suelto.
    return (
      <button
        type="button"
        className="inline-flex min-h-6 items-center text-[13.5px] font-semibold text-brand-red-ink hover:underline"
      />
    );
  }
  return <Button variant={style === "primario" ? "default" : "outline"} />;
}

export function DialogField({
  id,
  label,
  hint,
  error,
  children,
}: {
  /** Si viene, la etiqueta apunta a ese campo; si no (radios), es solo texto. */
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const Label = id ? "label" : "span";
  return (
    <div className="flex min-w-0 flex-col gap-1.75">
      <Label {...(id ? { htmlFor: id } : {})} className="text-[13px] font-semibold text-navy">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} className="text-[12.5px] leading-[1.45] text-brand-red-ink">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12.5px] leading-[1.45] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function EstadoField({ activa }: { activa: boolean }) {
  return (
    <DialogField label="Estado" hint="Las inactivas no se ofrecen al crear usuarios; quienes ya la tienen la conservan.">
      <SegmentedControl
        name="activa"
        label="Estado"
        defaultValue={activa ? "true" : "false"}
        options={[
          { value: "true", label: "Activa" },
          { value: "false", label: "Inactiva" },
        ]}
      />
    </DialogField>
  );
}

/**
 * Envía el formulario del modal a la server action sin que React lo reinicie
 * (por eso `onSubmit` y no `action`): si hay errores, lo escrito se queda.
 */
export function useCatalogoForm(
  action: (formData: FormData) => Promise<CatalogoActionResult>,
  onSaved: () => void
) {
  const [result, setResult] = useState<CatalogoActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await action(formData);
      setResult(next.ok ? null : next);
      if (next.ok) onSaved();
    });
  }

  const errors = result && !result.ok ? (result.errors ?? {}) : {};
  const message = result && !result.ok ? result.message : undefined;
  return { onSubmit, pending, errors, message, reset: () => setResult(null) };
}
```

- [ ] **Step 4: Modal de institución — `institucion-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type InstitucionOpcion, TIPOS_INSTITUCION, TIPO_INSTITUCION_LABEL } from "@/lib/catalogo/institucion";
import { guardarInstitucionAction } from "./actions";
import { DialogField, EstadoField, type TriggerStyle, triggerRender, useCatalogoForm } from "./catalogo-ui";

export function InstitucionDialog({
  institucion,
  triggerStyle,
}: {
  /** Si viene, se edita; si no, se crea. */
  institucion?: InstitucionOpcion;
  triggerStyle: TriggerStyle;
}) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, errors, message, reset } = useCatalogoForm(guardarInstitucionAction, () => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={triggerRender(triggerStyle)}>
        {institucion ? (
          <>
            Editar<span className="sr-only"> {institucion.nombre}</span>
          </>
        ) : (
          "+ Agregar institución"
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{institucion ? "Editar institución" : "Agregar institución"}</DialogTitle>
          <DialogDescription>
            Las horas exigidas se proponen al asignarla a un practicante; cada uno conserva las suyas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {institucion && <input type="hidden" name="id" value={institucion.id} />}
          <DialogField id="institucion-nombre" label="Nombre" error={errors.nombre}>
            <Input
              id="institucion-nombre"
              name="nombre"
              defaultValue={institucion?.nombre}
              autoComplete="off"
              aria-invalid={errors.nombre ? true : undefined}
              aria-describedby={errors.nombre ? "institucion-nombre-error" : undefined}
            />
          </DialogField>
          <DialogField label="Tipo" error={errors.tipo}>
            <SegmentedControl
              name="tipo"
              label="Tipo de institución"
              defaultValue={institucion?.tipo ?? "universidad"}
              options={TIPOS_INSTITUCION.map((value) => ({ value, label: TIPO_INSTITUCION_LABEL[value] }))}
            />
          </DialogField>
          <DialogField id="institucion-horas" label="Horas exigidas" error={errors.horasExigidas}>
            <Input
              id="institucion-horas"
              name="horasExigidas"
              inputMode="numeric"
              defaultValue={institucion && institucion.horasExigidas > 0 ? String(institucion.horasExigidas) : ""}
              className="tabular-nums"
              aria-invalid={errors.horasExigidas ? true : undefined}
              aria-describedby={errors.horasExigidas ? "institucion-horas-error" : undefined}
            />
          </DialogField>
          {institucion && <EstadoField activa={institucion.activa} />}
          {message && (
            <p role="alert" className="text-sm font-semibold text-brand-red-ink">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Modal de sede — `sede-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { guardarSedeAction } from "./actions";
import { DialogField, EstadoField, type TriggerStyle, triggerRender, useCatalogoForm } from "./catalogo-ui";

export function SedeDialog({ sede, triggerStyle }: { sede?: SedeOpcion; triggerStyle: TriggerStyle }) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, errors, message, reset } = useCatalogoForm(guardarSedeAction, () => setOpen(false));
  const invalid = (field: string, id: string) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={triggerRender(triggerStyle)}>
        {sede ? (
          <>
            Editar<span className="sr-only"> {sede.nombre}</span>
          </>
        ) : (
          "+ Agregar sede"
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sede ? "Editar sede" : "Agregar sede"}</DialogTitle>
          <DialogDescription>
            El horario se propone a sus practicantes; cada uno conserva el suyo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {sede && <input type="hidden" name="id" value={sede.id} />}
          <DialogField id="sede-nombre" label="Nombre" error={errors.nombre}>
            <Input id="sede-nombre" name="nombre" defaultValue={sede?.nombre} autoComplete="off" {...invalid("nombre", "sede-nombre")} />
          </DialogField>
          <DialogField id="sede-direccion" label="Dirección" hint="Opcional." error={errors.direccion}>
            <Input
              id="sede-direccion"
              name="direccion"
              defaultValue={sede?.direccion ?? ""}
              autoComplete="off"
              {...invalid("direccion", "sede-direccion")}
            />
          </DialogField>
          <DialogField
            id="sede-apertura"
            label="Horario"
            hint="Opcional. Apertura y cierre."
            error={errors.horaApertura ?? errors.horaCierre}
          >
            <div className="flex items-center gap-2">
              <Input
                id="sede-apertura"
                name="horaApertura"
                type="time"
                aria-label="Hora de apertura"
                defaultValue={sede?.horaApertura ?? ""}
                className="tabular-nums"
                {...invalid("horaApertura", "sede-apertura")}
              />
              <span aria-hidden className="text-navy/60">
                –
              </span>
              <Input
                name="horaCierre"
                type="time"
                aria-label="Hora de cierre"
                defaultValue={sede?.horaCierre ?? ""}
                className="tabular-nums"
                {...invalid("horaCierre", "sede-apertura")}
              />
            </div>
          </DialogField>
          {sede && <EstadoField activa={sede.activa} />}
          {message && (
            <p role="alert" className="text-sm font-semibold text-brand-red-ink">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: La página — `page.tsx`**

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIPO_INSTITUCION_LABEL } from "@/lib/catalogo/institucion";
import { formatHorario } from "@/lib/catalogo/sede";
import { type SedeConConteo, listCatalogoConConteos } from "@/lib/server/catalogoService";
import { cn } from "@/lib/utils";
import { InstitucionDialog } from "./institucion-dialog";
import { SedeDialog } from "./sede-dialog";

export const metadata: Metadata = { title: "Instituciones y sedes" };

const numberFormat = new Intl.NumberFormat("es-CO");

// .62 y no .55: a 11,5 px el .55 de la maqueta no llega a 4,5:1 sobre blanco.
const LABEL = "text-[11.5px] font-semibold tracking-[.08em] text-navy/62 uppercase";

function SedeCard({ sede }: { sede: SedeConConteo }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3.5 rounded-[10px] border border-border p-5.5",
        sede.activa ? "bg-white" : "bg-row-alt"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-navy">{sede.nombre}</h3>
          <p className="mt-1 text-[13px] text-navy/70">{sede.direccion ?? "Sin dirección"}</p>
        </div>
        <SedeDialog sede={sede} triggerStyle="enlace" />
      </div>
      {!sede.activa && (
        <Badge variant="inactivo" className="self-start">
          Inactiva
        </Badge>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className={LABEL}>Practicantes</dt>
          <dd className="mt-1 text-[30px] leading-[1.1] font-extrabold text-navy tabular-nums">
            {numberFormat.format(sede.practicantes)}
          </dd>
        </div>
        <div>
          <dt className={LABEL}>Horario</dt>
          <dd className="mt-2 text-[15px] leading-[1.3] font-semibold text-navy tabular-nums">
            {formatHorario(sede.horaApertura, sede.horaCierre)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="px-5.5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export default async function InstitucionesYSedesPage() {
  const { instituciones, sedes } = await listCatalogoConConteos();

  return (
    <>
      <PageHeader
        title="Instituciones y sedes"
        description="Dónde practican y desde qué instituciones vienen"
        actions={
          <>
            <InstitucionDialog triggerStyle="secundario" />
            <SedeDialog triggerStyle="primario" />
          </>
        }
      />

      <div className="flex flex-col gap-5.5 px-8 py-6">
        <section aria-labelledby="sedes-titulo">
          <h2 id="sedes-titulo" className="sr-only">
            Sedes
          </h2>
          {sedes.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-white">
              <Vacio>Aún no hay sedes. Agrega la primera con «+ Agregar sede».</Vacio>
            </div>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4.5">
              {sedes.map((sede) => (
                <li key={sede.id}>
                  <SedeCard sede={sede} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="instituciones-titulo" className="overflow-hidden rounded-[10px] border border-border bg-white">
          <h2 id="instituciones-titulo" className="border-b border-navy/10 px-5.5 py-4 text-[17px] font-bold text-navy">
            Instituciones educativas
          </h2>
          {instituciones.length === 0 ? (
            <Vacio>Aún no hay instituciones. Agrega la primera con «+ Agregar institución».</Vacio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Activos</TableHead>
                  <TableHead className="text-right">Horas exigidas</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instituciones.map((institucion) => (
                  <TableRow key={institucion.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium">{institucion.nombre}</span>
                        {!institucion.activa && <Badge variant="inactivo">Inactiva</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-navy/75">{TIPO_INSTITUCION_LABEL[institucion.tipo]}</TableCell>
                    <TableCell className="text-right tabular-nums">{numberFormat.format(institucion.activos)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {institucion.horasExigidas > 0 ? numberFormat.format(institucion.horasExigidas) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <InstitucionDialog institucion={institucion} triggerStyle="enlace" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 7: Verificar tipos, lint y pruebas**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test src/components/admin`
Expected: sin errores; `nav-config.test.ts` sigue pasando.

- [ ] **Step 8: Verificar en el navegador**

Con `pnpm dev` y sesión de administrador, en `https://localhost:3000/admin/instituciones-y-sedes` a **1366×768 y 1920×1080**:
- El menú "Instituciones y sedes" queda activo (rojo).
- Se ven las tarjetas de las sedes migradas y la tabla de instituciones con sus conteos.
- "+ Agregar sede" crea una sede con horario 07:00–17:00 y aparece "07:00 – 17:00" en su tarjeta.
- Crear otra con el mismo nombre en minúsculas muestra "Ya existe una sede con ese nombre" **sin borrar lo escrito**.
- "Editar" de una institución → "Inactiva" → Guardar: la fila muestra la píldora "Inactiva" y baja al final.
- Las etiquetas PRACTICANTES / HORARIO se leen en navy al 62 %, no más claras.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/nav-config.ts src/app/admin/instituciones-y-sedes
git commit -m "feat(catalogo): agrega la pantalla de instituciones y sedes según maqueta 4f"
```

---

### Task 4: Afiliación desde las relaciones (kiosko, carnet, enrolamiento)

**Files:**
- Modify: `src/lib/usuarios/tipoUsuario.ts` (`describeAfiliacion`)
- Modify: `src/lib/server/usuarioService.ts` (`AFILIACION_INCLUDE`, `getUsuario`)
- Modify: `src/lib/server/marcacionService.ts`
- Modify: `src/app/api/marcacion/route.ts:64`
- Modify: `src/lib/server/carnet.ts` (`findUserByCarnetToken`, `CarnetData`, `carnetData`, `sendCarnet`)
- Test: `src/lib/usuarios/tipoUsuario.test.ts`, `src/lib/server/carnet.test.ts`, `src/app/api/marcacion/route.test.ts`

**Interfaces:**
- Produces:
  - `describeAfiliacion(user: { tipo: string; institucion: { nombre: string } | null; sede: { nombre: string } | null }): string`
  - `AFILIACION_INCLUDE` (en `usuarioService.ts`): `{ institucion: { select: { nombre: true } }, sede: { select: { nombre: true } } }`
  - `type UsuarioMarcacion = Prisma.UserGetPayload<{ include: typeof AFILIACION_INCLUDE }>` (en `marcacionService.ts`)
  - `getUsuario(id)` ahora incluye `institucion` y `sede` con su `nombre`.
  - La respuesta de `registrarMarcacion` **ya no** trae `universidad` ni `entidad` (el kiosko solo usa `afiliacion`).

- [ ] **Step 1: Actualizar las pruebas**

En `src/lib/usuarios/tipoUsuario.test.ts`, reemplazar el `describe("describeAfiliacion", …)` completo por:

```ts
describe("describeAfiliacion", () => {
  it("une institución y sede", () => {
    expect(
      describeAfiliacion({
        tipo: "universidad",
        institucion: { nombre: "Universidad Nacional" },
        sede: { nombre: "Sede Centro" },
      })
    ).toBe("Universidad Nacional · Sede Centro");
  });

  it("para un voluntario natural dice el tipo", () => {
    expect(describeAfiliacion({ tipo: "natural", institucion: null, sede: null })).toBe("Voluntario natural");
  });

  it("omite las partes vacías", () => {
    expect(describeAfiliacion({ tipo: "colegio", institucion: { nombre: "Colegio San José" }, sede: null })).toBe(
      "Colegio San José"
    );
  });
});
```

En `src/lib/server/carnet.test.ts`, cambiar los datos de las dos pruebas:

```ts
      { nombre: "Laura Rodríguez", cedula: "1019442881", tipo: "universidad", institucion: { nombre: "Universidad Nacional" }, sede: { nombre: "Sede Centro" } },
```

y

```ts
      { nombre: "Marta Gómez", cedula: "52123456", tipo: "natural", institucion: null, sede: null },
```

y renombrar la primera prueba a `"muestra institución y sede de un practicante"`.

En `src/app/api/marcacion/route.test.ts`:
- Arriba, junto a `let userId`, agregar `let institucionId: number; let sedeId: number;` y la constante `const SUFIJO = "Prueba Marcación";`.
- En `beforeAll`, antes de `prisma.user.create`, crear las dos entradas del catálogo:

```ts
  // upsert: si una corrida anterior se cortó, el nombre ya existe (UNIQUE).
  institucionId = (
    await prisma.institucion.upsert({
      where: { nombre: `Universidad de ${SUFIJO}` },
      create: { nombre: `Universidad de ${SUFIJO}`, tipo: "universidad", horasExigidas: 240 },
      update: {},
    })
  ).id;
  sedeId = (
    await prisma.sede.upsert({ where: { nombre: `Sede de ${SUFIJO}` }, create: { nombre: `Sede de ${SUFIJO}` }, update: {} })
  ).id;
```

- En el `data` de `prisma.user.create`, reemplazar las líneas `universidad: "Universidad de Prueba",` y `entidad: "Entidad de Prueba",` por `institucionId, sedeId,`.
- Al final del `afterAll`, después de borrar el usuario:

```ts
  await prisma.institucion.deleteMany({ where: { nombre: `Universidad de ${SUFIJO}` } });
  await prisma.sede.deleteMany({ where: { nombre: `Sede de ${SUFIJO}` } });
```

- Reemplazar la prueba `"incluye universidad y entidad para la pantalla de éxito del kiosko"` por:

```ts
  it(
    "incluye la afiliación (institución · sede) para la pantalla de éxito del kiosko",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.afiliacion).toBe(`Universidad de ${SUFIJO} · Sede de ${SUFIJO}`);
      expect(body).not.toHaveProperty("universidad");
      expect(body).not.toHaveProperty("entidad");
    },
    20000
  );
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm test src/lib/usuarios/tipoUsuario.test.ts src/lib/server/carnet.test.ts src/app/api/marcacion/route.test.ts`
Expected: FAIL. `describeAfiliacion` devuelve `""` para el practicante y la afiliación del kiosko no coincide.

- [ ] **Step 3: `describeAfiliacion` en `src/lib/usuarios/tipoUsuario.ts`**

Reemplazar la función por:

```ts
interface ConNombre {
  nombre: string;
}

/** Línea bajo el nombre (kiosko, carnet, enrolamiento): "Institución · Sede". */
export function describeAfiliacion(user: { tipo: string; institucion: ConNombre | null; sede: ConNombre | null }): string {
  if (user.tipo === "natural") return TIPO_USUARIO_LABEL.natural;
  return [user.institucion?.nombre, user.sede?.nombre].filter((part) => part && part.trim()).join(" · ");
}
```

Y en el comentario de cabecera del archivo, cambiar "sin universidad ni entidad" por "sin institución ni sede".

- [ ] **Step 4: `AFILIACION_INCLUDE` y `getUsuario` en `src/lib/server/usuarioService.ts`**

Debajo de `export const PAGE_SIZE = 20;`:

```ts
/** Lo necesario para describir la afiliación (kiosko, carnet, enrolamiento). */
export const AFILIACION_INCLUDE = {
  institucion: { select: { nombre: true } },
  sede: { select: { nombre: true } },
} as const satisfies Prisma.UserInclude;
```

En `getUsuario`, cambiar el `include` a:

```ts
    include: {
      ...AFILIACION_INCLUDE,
      _count: { select: { embeddings: true } },
      carnet: { select: { enviadoEn: true, enviadoA: true } },
    },
```

- [ ] **Step 5: Kiosko — `marcacionService.ts` y `api/marcacion/route.ts`**

En `src/lib/server/marcacionService.ts`:
- Cambiar `import type { User } from "@prisma/client";` por `import type { Prisma } from "@prisma/client";` y agregar `import { AFILIACION_INCLUDE } from "./usuarioService";`.
- Agregar debajo de los imports:

```ts
export type UsuarioMarcacion = Prisma.UserGetPayload<{ include: typeof AFILIACION_INCLUDE }>;
```

- Cambiar la firma a `export async function registrarMarcacion(user: UsuarioMarcacion, config: ConfigValues, { metodo, confianza, deviceId }: MarkInput) {`.
- En `const base = { … }`, borrar las líneas `universidad: user.universidad,` y `entidad: user.entidad,`.

En `src/app/api/marcacion/route.ts:64`, cambiar a:

```ts
  const user = await prisma.user.findUniqueOrThrow({ where: { id: match.userId }, include: AFILIACION_INCLUDE });
```

y agregar `import { AFILIACION_INCLUDE } from "@/lib/server/usuarioService";`.

- [ ] **Step 6: Carnet — `src/lib/server/carnet.ts`**

Agregar `import { AFILIACION_INCLUDE } from "./usuarioService";`.

```ts
export async function findUserByCarnetToken(token: string) {
  const carnet = await prisma.carnetVirtual.findUnique({
    where: { token },
    include: { user: { include: AFILIACION_INCLUDE } },
  });
  return carnet?.user.activo ? carnet.user : null;
}
```

```ts
export interface CarnetData {
  nombre: string;
  cedula: string;
  tipo: string;
  institucion: { nombre: string } | null;
  sede: { nombre: string } | null;
}
```

En `carnetData` y en `sendCarnet`, cambiar `prisma.user.findUnique({ where: { id: userId } })` por `prisma.user.findUnique({ where: { id: userId }, include: AFILIACION_INCLUDE })`.

(`src/app/admin/enrolar/[userId]/page.tsx` ya pasa `user` de `getUsuario` a `describeAfiliacion`. Con el paso 4 compila sin cambios.)

- [ ] **Step 7: Correr y verificar que pasan**

Run: `pnpm test src/lib/usuarios/tipoUsuario.test.ts src/lib/server/carnet.test.ts src/app/api/marcacion src/lib/client/marcacionResult.test.ts && pnpm exec tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/usuarios/tipoUsuario.ts src/lib/usuarios/tipoUsuario.test.ts src/lib/server/usuarioService.ts src/lib/server/marcacionService.ts src/app/api/marcacion/route.ts src/app/api/marcacion/route.test.ts src/lib/server/carnet.ts src/lib/server/carnet.test.ts
git commit -m "refactor(usuarios): describe la afiliación con la institución y la sede del catálogo"
```

---

### Task 5: Listado y filtros por catálogo

**Files:**
- Modify: `src/lib/usuarios/filters.ts`
- Modify: `src/lib/usuarios/tipoUsuario.ts` (agregar `etiquetaTipo`)
- Modify: `src/lib/server/usuarioService.ts` (`UsuarioRow`, `whereFor`, `listUsuarios`)
- Modify: `src/app/admin/usuarios/filters-bar.tsx`
- Modify: `src/app/admin/usuarios/page.tsx`
- Test: `src/lib/usuarios/filters.test.ts`, `src/lib/usuarios/tipoUsuario.test.ts`, `src/lib/server/usuarioService.test.ts`

**Interfaces:**
- Consumes: `listCatalogo` (Task 2); `TIPOS_INSTITUCION`, `TIPO_INSTITUCION_LABEL`, `isTipoInstitucion`, `etiquetaOpcion` (Task 1).
- Produces:
  - `type TipoFiltro = TipoInstitucion | "natural"`; `TIPO_OPCIONES: { value: TipoFiltro; label: string }[]`
  - `interface Filters { q?: string; tipo?: TipoFiltro; institucion?: number; sede?: number; estado?: Estado; page?: number }`
  - `UsuarioRow`: `{ id; nombre; cedula; tipo; institucion: string | null; institucionTipo: string | null; sede: string | null; activo; fotos }`
  - `etiquetaTipo(user: { tipo: string; institucionTipo: string | null }): string`

- [ ] **Step 1: Pruebas que fallan**

`src/lib/usuarios/filters.test.ts`: reemplazar el primer `describe("parseUsuarioFilters", …)` y el `describe("filtro por tipo", …)` por:

```ts
describe("parseUsuarioFilters", () => {
  it("lee los filtros de la URL e ignora valores desconocidos", () => {
    expect(
      parseUsuarioFilters({ q: " laura ", estado: "sin-rostro", tipo: "colegio", institucion: "3", sede: "12", page: "3" })
    ).toEqual({ q: "laura", estado: "sin-rostro", tipo: "colegio", institucion: 3, sede: 12, page: 3 });

    expect(parseUsuarioFilters({ estado: "borrado", tipo: "empresa", institucion: "abc", sede: "-1", page: "-2" })).toEqual({
      q: undefined,
      estado: undefined,
      tipo: undefined,
      institucion: undefined,
      sede: undefined,
      page: 1,
    });
  });

  it("si un parámetro viene repetido toma el primero", () => {
    expect(parseUsuarioFilters({ q: ["ana", "beto"] }).q).toBe("ana");
  });
});

describe("filtro por tipo, institución y sede", () => {
  it("acepta los tres tipos de institución y voluntario natural", () => {
    for (const tipo of ["universidad", "tecnica", "colegio", "natural"]) {
      expect(parseUsuarioFilters({ tipo }).tipo).toBe(tipo);
    }
  });

  it("los escribe en la URL", () => {
    expect(hrefWith({}, { tipo: "tecnica", institucion: 3, sede: 12 })).toBe(
      "/admin/usuarios?tipo=tecnica&institucion=3&sede=12"
    );
  });
});
```

`src/lib/usuarios/tipoUsuario.test.ts`, agregar:

```ts
describe("etiquetaTipo", () => {
  it("el tipo de un practicante sale de su institución", () => {
    expect(etiquetaTipo({ tipo: "universidad", institucionTipo: "tecnica" })).toBe("Técnica");
    expect(etiquetaTipo({ tipo: "universidad", institucionTipo: null })).toBe("—");
    expect(etiquetaTipo({ tipo: "natural", institucionTipo: null })).toBe("Voluntario natural");
  });
});
```

(agregar `etiquetaTipo` al import de `./tipoUsuario`).

`src/lib/server/usuarioService.test.ts`:
- Agregar el import `import { guardarInstitucion, guardarSede } from "./catalogoService";`.
- Reemplazar `const UNIVERSIDAD = "Universidad de Prueba Servicio";` por:

```ts
const INSTITUCION = "Zz Universidad de Prueba Servicio";
const SEDE = "Zz Sede de Prueba Servicio";
let institucionId: number;
let sedeId: number;
```

- En `cleanup()`, al final, agregar:

```ts
  await prisma.institucion.deleteMany({ where: { nombre: INSTITUCION } });
  await prisma.sede.deleteMany({ where: { nombre: SEDE } });
```

- En `input()`, cambiar `universidad: UNIVERSIDAD,` por `universidad: INSTITUCION,`.
- En `beforeAll`, justo después de `await cleanup();`, crear el catálogo:

```ts
  const institucion = await guardarInstitucion(null, { nombre: INSTITUCION, tipo: "colegio", horasExigidas: 80, activa: true });
  const sede = await guardarSede(null, { nombre: SEDE, direccion: null, horaApertura: null, horaCierre: null, activa: true });
  if (!institucion.ok || !sede.ok) throw new Error("No se pudo crear el catálogo de prueba");
  institucionId = institucion.id;
  sedeId = sede.id;
```

- En `beforeAll`, después de `insertUsuarios([...])`, enlazar a los practicantes (en esta tarea `UsuarioInput` todavía no trae IDs):

```ts
  await prisma.user.updateMany({
    where: { cedula: { startsWith: PREFIX }, tipo: { not: "natural" } },
    data: { institucionId, sedeId },
  });
```

- En el `describe("listUsuarios")`, cambiar el helper `names` a `(await listUsuarios({ institucion: institucionId, ...filters })).rows.map((row) => row.nombre);`.
- Reemplazar la prueba `"filtra por tipo de usuario"` por:

```ts
  it("filtra por tipo: natural por el usuario, el resto por su institución", async () => {
    const naturales = await listUsuarios({ q: "Dora Prueba Natural", tipo: "natural" });
    expect(naturales.rows.map((row) => [row.nombre, row.institucion, row.sede])).toEqual([["Dora Prueba Natural", null, null]]);
    expect((await listUsuarios({ q: "Dora Prueba Natural", tipo: "colegio" })).rows).toEqual([]);
    expect(await names({ tipo: "colegio", estado: "activo" })).toEqual(["Ana Prueba Activa", "Carla Prueba Con Rostro"]);
    expect(await names({ tipo: "universidad" })).toEqual([]);
  });

  it("filtra por sede y trae los nombres del catálogo", async () => {
    const { rows } = await listUsuarios({ sede: sedeId, q: "Ana Prueba" });
    expect(rows.map((row) => [row.institucion, row.institucionTipo, row.sede])).toEqual([[INSTITUCION, "colegio", SEDE]]);
  });
```

- En `"cuenta las fotos de cada usuario"`, cambiar `listUsuarios({ universidad: UNIVERSIDAD, q: "carla" })` por `listUsuarios({ institucion: institucionId, q: "carla" })`.

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm test src/lib/usuarios/filters.test.ts src/lib/usuarios/tipoUsuario.test.ts src/lib/server/usuarioService.test.ts`
Expected: FAIL (`etiquetaTipo` no existe, `institucion`/`sede` no se leen de la URL, `listUsuarios` no filtra por `institucion`).

- [ ] **Step 3: `src/lib/usuarios/filters.ts`**

Reemplazar el archivo por:

```ts
import { TIPOS_INSTITUCION, TIPO_INSTITUCION_LABEL, type TipoInstitucion } from "@/lib/catalogo/institucion";

export const ESTADO_OPCIONES = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "sin-rostro", label: "Sin rostro" },
] as const;

export type Estado = (typeof ESTADO_OPCIONES)[number]["value"];

/** Universidad / Técnica / Colegio salen de la institución; natural, del usuario. */
export type TipoFiltro = TipoInstitucion | "natural";

export const TIPO_OPCIONES: { value: TipoFiltro; label: string }[] = [
  ...TIPOS_INSTITUCION.map((value) => ({ value, label: TIPO_INSTITUCION_LABEL[value] })),
  { value: "natural", label: "Voluntario natural" },
];

export interface Filters {
  q?: string;
  tipo?: TipoFiltro;
  /** IDs del catálogo (maqueta 4f). */
  institucion?: number;
  sede?: number;
  estado?: Estado;
  page?: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text ? text : undefined;
}

function isEstado(value: string | undefined): value is Estado {
  return ESTADO_OPCIONES.some((option) => option.value === value);
}

function isTipoFiltro(value: string | undefined): value is TipoFiltro {
  return TIPO_OPCIONES.some((option) => option.value === value);
}

function positiveInt(value: string | undefined): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export function parseUsuarioFilters(params: SearchParams): Filters {
  const tipo = first(params.tipo);
  const estado = first(params.estado);
  return {
    q: first(params.q),
    tipo: isTipoFiltro(tipo) ? tipo : undefined,
    institucion: positiveInt(first(params.institucion)),
    sede: positiveInt(first(params.sede)),
    estado: isEstado(estado) ? estado : undefined,
    page: positiveInt(first(params.page)) ?? 1,
  };
}

const ORDER: (keyof Filters)[] = ["q", "tipo", "institucion", "sede", "estado", "page"];

/**
 * URL del listado con `changes` aplicados. Cualquier cambio que no sea de
 * página vuelve a la página 1, para no quedar en una página que ya no existe.
 */
export function hrefWith(current: Filters, changes: Partial<Filters>): string {
  const next: Filters = { ...current, ...changes };
  if (!("page" in changes)) next.page = undefined;

  const params = new URLSearchParams();
  for (const key of ORDER) {
    const value = next[key];
    if (value === undefined || value === "" || (key === "page" && value === 1)) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/admin/usuarios?${query}` : "/admin/usuarios";
}
```

- [ ] **Step 4: `etiquetaTipo` en `src/lib/usuarios/tipoUsuario.ts`**

Agregar `import { TIPO_INSTITUCION_LABEL, isTipoInstitucion } from "@/lib/catalogo/institucion";` y al final:

```ts
/** Columna Tipo del listado: la del practicante la pone su institución. */
export function etiquetaTipo(user: { tipo: string; institucionTipo: string | null }): string {
  if (user.tipo === "natural") return TIPO_USUARIO_LABEL.natural;
  return isTipoInstitucion(user.institucionTipo) ? TIPO_INSTITUCION_LABEL[user.institucionTipo] : "—";
}
```

- [ ] **Step 5: `src/lib/server/usuarioService.ts`**

Reemplazar `UsuarioRow`, `whereFor` y `listUsuarios` por:

```ts
export interface UsuarioRow {
  id: string;
  nombre: string;
  cedula: string;
  tipo: string;
  institucion: string | null;
  institucionTipo: string | null;
  sede: string | null;
  activo: boolean;
  fotos: number;
}

export const PAGE_SIZE = 20;

function whereFor({ q, tipo, institucion, sede, estado }: UsuarioFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  const text = q?.trim();
  if (text) {
    const digits = text.replace(/[.\s-]/g, "");
    and.push({
      OR: [
        // SQL Server compara sin distinguir mayúsculas con la intercalación por defecto.
        { nombre: { contains: text } },
        ...(/^\d+$/.test(digits) ? [{ cedula: { contains: digits } }] : []),
      ],
    });
  }
  // Natural es un tipo de usuario; universidad / técnica / colegio, de su institución.
  if (tipo === "natural") and.push({ tipo: "natural" });
  else if (tipo) and.push({ tipo: { not: "natural" }, institucion: { tipo } });
  if (institucion) and.push({ institucionId: institucion });
  if (sede) and.push({ sedeId: sede });
  if (estado === "activo") and.push({ activo: true });
  if (estado === "inactivo") and.push({ activo: false });
  if (estado === "sin-rostro") and.push({ activo: true, embeddings: { none: {} } });

  return { AND: and };
}

export async function listUsuarios(filters: UsuarioFilters) {
  const where = whereFor(filters);
  const page = Math.max(1, filters.page ?? 1);

  const [users, total, registrados, activos] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { nombre: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nombre: true,
        cedula: true,
        tipo: true,
        activo: true,
        institucion: { select: { nombre: true, tipo: true } },
        sede: { select: { nombre: true } },
        _count: { select: { embeddings: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { activo: true } }),
  ]);

  const rows: UsuarioRow[] = users.map(({ _count, institucion, sede, ...user }) => ({
    ...user,
    institucion: institucion?.nombre ?? null,
    institucionTipo: institucion?.tipo ?? null,
    sede: sede?.nombre ?? null,
    fotos: _count.embeddings,
  }));
  return { rows, total, page, counts: { registrados, activos, inactivos: registrados - activos } };
}
```

`listFilterOptions` se queda por ahora (la usan las páginas del formulario hasta la Task 7).

- [ ] **Step 6: `src/app/admin/usuarios/filters-bar.tsx`**

- En `interface FilterDef`, cambiar `key: "tipo" | "universidad" | "entidad" | "estado";` por `key: "tipo" | "institucion" | "sede" | "estado";`.
- En el render, el valor aplicado puede ser número. Cambiar
  `const label = def.options.find((option) => option.value === applied)?.label ?? applied;`
  por
  `const label = def.options.find((option) => option.value === String(applied))?.label ?? String(applied);`

- [ ] **Step 7: `src/app/admin/usuarios/page.tsx`**

- Imports: quitar `listFilterOptions` del import de `usuarioService` y agregar `import { listCatalogo } from "@/lib/server/catalogoService";`, `import { etiquetaOpcion } from "@/lib/catalogo/nombres";`. Cambiar el import de `tipoUsuario` a `import { etiquetaTipo } from "@/lib/usuarios/tipoUsuario";`.
- `const [{ rows, total, page, counts }, catalogo] = await Promise.all([listUsuarios(filters), listCatalogo()]);`
- `const hasFilters = Boolean(filters.q || filters.tipo || filters.institucion || filters.sede || filters.estado);`
- `defs` del `FiltersBar`:

```tsx
          defs={[
            { key: "tipo", label: "Tipo", options: TIPO_OPCIONES },
            {
              key: "institucion",
              label: "Institución",
              options: catalogo.instituciones.map((item) => ({ value: String(item.id), label: etiquetaOpcion(item) })),
            },
            {
              key: "sede",
              label: "Sede",
              options: catalogo.sedes.map((item) => ({ value: String(item.id), label: etiquetaOpcion(item) })),
            },
            { key: "estado", label: "Estado", options: [...ESTADO_OPCIONES] },
          ]}
```

- Encabezados: `<TableHead>Universidad / Colegio</TableHead>` → `<TableHead>Institución</TableHead>` y `<TableHead>Entidad</TableHead>` → `<TableHead>Sede</TableHead>`.
- Celdas:

```tsx
                    <TableCell>{etiquetaTipo(user)}</TableCell>
                    <TableCell>{user.institucion ?? "—"}</TableCell>
                    <TableCell>{user.sede ?? "—"}</TableCell>
```

- [ ] **Step 8: Correr pruebas, tipos y lint**

Run: `pnpm test src/lib/usuarios src/lib/server/usuarioService.test.ts && pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS y sin errores.

- [ ] **Step 9: Verificar en el navegador**

`/admin/usuarios`: los desplegables Institución y Sede listan el catálogo, y elegir una sede deja el chip "Sede: Sede Centro ✕". `?tipo=colegio` muestra solo practicantes de colegios. Las columnas dicen Institución y Sede.

- [ ] **Step 10: Commit**

```bash
git add src/lib/usuarios/filters.ts src/lib/usuarios/filters.test.ts src/lib/usuarios/tipoUsuario.ts src/lib/usuarios/tipoUsuario.test.ts src/lib/server/usuarioService.ts src/lib/server/usuarioService.test.ts src/app/admin/usuarios/filters-bar.tsx src/app/admin/usuarios/page.tsx
git commit -m "feat(usuarios): filtra el listado por tipo, institución y sede del catálogo"
```

---

### Task 6: Practicante o natural, con institución y sede por ID (validación, guardado e importación)

**Files:**
- Modify: `src/lib/usuarios/tipoUsuario.ts`
- Modify: `src/lib/usuarios/userInput.ts`
- Modify: `src/lib/server/usuarioService.ts` (`SaveResult`, `createUsuario`, `updateUsuario`)
- Modify: `src/app/admin/usuarios/_form/actions.ts`
- Modify: `src/lib/usuarios/importRows.ts`
- Modify: `src/app/api/usuarios/importar/route.ts`
- Modify: `src/lib/server/excel.ts` (`TEMPLATE_HEADERS`)
- Modify: `src/app/api/usuarios/importar/plantilla/route.ts`
- Test: `src/lib/usuarios/tipoUsuario.test.ts`, `src/lib/usuarios/userInput.test.ts`, `src/lib/usuarios/importRows.test.ts`, `src/lib/server/usuarioService.test.ts`, `src/app/api/usuarios/importar/route.test.ts`

**Interfaces:**
- Consumes: `buildCatalogIndex`, `normalizeNombre` (Task 1); `InstitucionOpcion`, `SedeOpcion` (Task 1); `listCatalogo` (Task 2).
- Produces:
  - `TIPOS_USUARIO = ["practicante", "natural"]`, `type TipoUsuario`, `TIPO_USUARIO_LABEL = { practicante: "Practicante", natural: "Voluntario natural" }`
  - `UsuarioInput`: `{ tipo; nombre; cedula; email; institucionId: number | null; sedeId: number | null; horasRequeridas; fechaInicio; horaInicio; horaFin; activo }`
  - `type UsuarioField = "tipo" | "nombre" | "cedula" | "email" | "institucionId" | "sedeId" | "horasRequeridas" | "fechaInicio" | "horaInicio" | "horaFin"`
  - `type SaveResult = { ok: true; id: string } | { ok: false; duplicate: { id: string; nombre: string } } | { ok: false; noDisponible: "institucionId" | "sedeId" }`
  - `interface ImportCatalog { instituciones: Map<string, InstitucionOpcion>; sedes: Map<string, SedeOpcion> }`
  - `classifyImportRows(rows: RawRow[], cedulasExistentes: Set<string>, catalogo: ImportCatalog): ImportClassification`

**Nota:** al terminar esta tarea, `tsc` falla solo en `usuario-form.tsx`, `nuevo/page.tsx` y `[userId]/editar/page.tsx`. La Task 7 los rehace.

- [ ] **Step 1: Pruebas de `tipoUsuario`**

En `src/lib/usuarios/tipoUsuario.test.ts`, reemplazar los `describe` de `isTipoUsuario`, `tieneMetaDeHoras` y `parseTipoUsuario` por:

```ts
describe("isTipoUsuario", () => {
  it("acepta solo practicante y natural", () => {
    expect(isTipoUsuario("practicante")).toBe(true);
    expect(isTipoUsuario("natural")).toBe(true);
    expect(isTipoUsuario("universidad")).toBe(false);
    expect(isTipoUsuario("")).toBe(false);
    expect(isTipoUsuario(undefined)).toBe(false);
  });
});

describe("tieneMetaDeHoras", () => {
  it("solo los voluntarios naturales no tienen meta", () => {
    expect(tieneMetaDeHoras("practicante")).toBe(true);
    expect(tieneMetaDeHoras("natural")).toBe(false);
  });
});

describe("parseTipoUsuario", () => {
  it("universidad, técnica o colegio son practicantes: el tipo concreto lo pone la institución", () => {
    for (const raw of ["Practicante", "Universidad", " UNIVERSITARIO ", "Técnica", "tecnico", "colegio"]) {
      expect(parseTipoUsuario(raw)).toBe("practicante");
    }
  });

  it("natural o voluntario", () => {
    expect(parseTipoUsuario("Natural")).toBe("natural");
    expect(parseTipoUsuario("Voluntario")).toBe("natural");
    expect(parseTipoUsuario("voluntario natural")).toBe("natural");
  });

  it("devuelve null si no lo reconoce", () => {
    expect(parseTipoUsuario("empresa")).toBeNull();
    expect(parseTipoUsuario("")).toBeNull();
  });
});
```

- [ ] **Step 2: Pruebas de `userInput`**

En `src/lib/usuarios/userInput.test.ts`:
- En `const valid`, cambiar `tipo: "universidad",` por `tipo: "practicante",`, y `universidad: "Universidad Nacional", entidad: "Sede Centro",` por `institucionId: "3", sedeId: "12",`.
- En `"normaliza un usuario válido"`, en `value`: `tipo: "practicante"` e `institucionId: 3, sedeId: 12,` en lugar de `universidad`/`entidad`.
- En `"marca cada campo obligatorio vacío"`, la lista esperada pasa a `["cedula", "sedeId", "fechaInicio", "horasRequeridas", "nombre", "tipo", "institucionId"].sort()`.
- Reemplazar la prueba `"pide colegio en vez de universidad para practicantes de colegio"` por:

```ts
  it("explica la institución o sede que falta o no es un ID", () => {
    const result = validateUsuarioInput({ ...valid, institucionId: "", sedeId: "abc" });
    expect(!result.ok && result.errors).toEqual({ institucionId: "Falta la institución", sedeId: "Falta la sede" });
  });

  it("acepta los IDs como número (importación)", () => {
    const result = validateUsuarioInput({ ...valid, institucionId: 3, sedeId: 12 });
    expect(result.ok && [result.value.institucionId, result.value.sedeId]).toEqual([3, 12]);
  });
```

- En el `describe("voluntario natural", …)`, cada `universidad: null, entidad: null` esperado pasa a `institucionId: null, sedeId: null`, y cada `universidad: "…"` / `entidad: "…"` de entrada pasa a `institucionId: "3"` / `sedeId: "12"`. Correr `grep -n "universidad\|entidad" src/lib/usuarios/userInput.test.ts` al final: no debe quedar ninguna.

- [ ] **Step 3: Pruebas de `importRows`**

Reemplazar el comienzo de `src/lib/usuarios/importRows.test.ts` (imports, `header` y `without`) por:

```ts
import { describe, expect, it } from "vitest";
import type { InstitucionOpcion } from "@/lib/catalogo/institucion";
import { buildCatalogIndex } from "@/lib/catalogo/nombres";
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { type ImportCatalog, classifyImportRows } from "./importRows";

const instituciones: InstitucionOpcion[] = [
  { id: 1, nombre: "Universidad Nacional", tipo: "universidad", horasExigidas: 240, activa: true },
  { id: 2, nombre: "Colegio San José", tipo: "colegio", horasExigidas: 80, activa: true },
  { id: 3, nombre: "Universidad Cerrada", tipo: "universidad", horasExigidas: 240, activa: false },
];
const sedes: SedeOpcion[] = [
  { id: 10, nombre: "Sede Centro", direccion: null, horaApertura: "07:00", horaCierre: "17:00", activa: true },
  { id: 11, nombre: "Bodega Fontibón", direccion: null, horaApertura: null, horaCierre: null, activa: true },
];
const catalogo: ImportCatalog = { instituciones: buildCatalogIndex(instituciones), sedes: buildCatalogIndex(sedes) };

const header = {
  Nombre: "Laura Catalina Rodríguez",
  "Cédula": "1.019.442.881",
  Correo: "laura@unal.edu.co",
  "Institución": "Universidad Nacional",
  Sede: "Sede Centro",
  "Horas requeridas": 240,
};

function without(row: Record<string, unknown>, key: string) {
  return Object.fromEntries(Object.entries(row).filter(([name]) => name !== key));
}

const classify = (rows: Record<string, unknown>[], existentes = new Set<string>()) =>
  classifyImportRows(rows, existentes, catalogo);
```

En el resto del archivo, cambiar cada `classifyImportRows(x, new Set())` por `classify(x)` y cada `classifyImportRows(x, new Set([...]))` por `classify(x, new Set([...]))`. Además:
- `"reconoce encabezados con otras mayúsculas, tildes o sinónimos"`: la expectativa pasa a `{ nombre: "Andrés Mora", cedula: "1023884112", institucionId: 2, sedeId: 11 }`. Las columnas viejas `colegio` y `sede` de esa fila siguen sirviendo como alias.
- `"sin columna Tipo asume universidad"` → título `"sin columna Tipo asume practicante"` y `.toBe("practicante")`.
- `"lee la columna Tipo"`: `Tipo: "Colegio"` → `.toBe("practicante")`.
- `"explica un tipo que no reconoce"` → `"El tipo debe ser Practicante o Natural"`.
- `"un archivo solo de naturales…"` → `toMatchObject({ tipo: "natural", institucionId: null, horasRequeridas: 0 })`.
- `"en una fila natural ignora la universidad escrita"` → título `"en una fila natural ignora la institución y la sede escritas"` y `toMatchObject({ tipo: "natural", institucionId: null, sedeId: null })`.

Agregar al final del `describe`:

```ts
  it("reconoce la institución y la sede sin importar mayúsculas, tildes ni espacios", () => {
    const result = classify([{ ...header, "Institución": "  UNIVERSIDAD   nacional ", Sede: "bodega fontibon" }]);
    expect(result.errores).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ institucionId: 1, sedeId: 11 });
  });

  it("acepta las columnas viejas Universidad / Colegio y Entidad", () => {
    const result = classify([
      { ...without(without(header, "Institución"), "Sede"), "Universidad / Colegio": "Universidad Nacional", Entidad: "Sede Centro" },
    ]);
    expect(result.columnasFaltantes).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ institucionId: 1, sedeId: 10 });
  });

  it("no crea instituciones ni sedes: explica cuál no existe o está inactiva", () => {
    const result = classify([
      { ...header, "Institución": "U. Nacional" },
      { ...header, "Cédula": "52123456", "Institución": "Universidad Cerrada", Sede: "Sede Norte" },
    ]);
    expect(result.validos).toEqual([]);
    expect(result.errores.map((error) => error.motivo)).toEqual([
      "La institución «U. Nacional» no existe. Agrégala en Instituciones y sedes o corrige el nombre.",
      "La institución «Universidad Cerrada» está inactiva.; La sede «Sede Norte» no existe. Agrégala en Instituciones y sedes o corrige el nombre.",
    ]);
  });

  it("sin horas ni horario toma los de la institución y la sede", () => {
    const result = classify([without(header, "Horas requeridas")]);
    expect(result.validos[0]?.input).toMatchObject({ horasRequeridas: 240, horaInicio: "07:00", horaFin: "17:00" });
  });

  it("lo escrito en el Excel gana a lo de la institución y la sede", () => {
    const result = classify([{ ...header, "Horas requeridas": 300, "Hora de inicio": "08:00", "Hora de fin": "12:00" }]);
    expect(result.validos[0]?.input).toMatchObject({ horasRequeridas: 300, horaInicio: "08:00", horaFin: "12:00" });
  });
```

Ajustar también `"si falta una columna obligatoria…"` (sigue esperando `["Cédula"]`) y la prueba de errores en español llano: su tercera fila (`"Horas requeridas": "muchas"`) sigue esperando `"Horas exigidas sin número"`.

- [ ] **Step 4: Pruebas del servicio**

En `src/lib/server/usuarioService.test.ts`:
- `input()`: `tipo: "practicante",`, y `universidad: INSTITUCION, entidad: "Entidad Prueba",` pasa a `institucionId, sedeId,`. Como `input()` se llama dentro de `beforeAll` después de crear el catálogo, lee los `let` ya asignados.
- En el natural de `beforeAll`: `universidad: null, entidad: null` → `institucionId: null, sedeId: null`.
- Borrar el `prisma.user.updateMany(...)` que agregó la Task 5 (ya no hace falta).
- Agregar al `describe("createUsuario / updateUsuario")`:

```ts
  it("no asigna una sede inactiva o que no existe", async () => {
    const cerrada = await guardarSede(null, { nombre: `${SEDE} Cerrada`, direccion: null, horaApertura: null, horaCierre: null, activa: false });
    if (!cerrada.ok) throw new Error("No se pudo crear la sede");
    expect(await createUsuario(input({ cedula: `${PREFIX}020`, sedeId: cerrada.id }))).toEqual({ ok: false, noDisponible: "sedeId" });
    expect(await createUsuario(input({ cedula: `${PREFIX}021`, institucionId: 999_999_999 }))).toEqual({
      ok: false,
      noDisponible: "institucionId",
    });
    await prisma.sede.delete({ where: { id: cerrada.id } });
  });

  it("conserva una institución inactiva que ya tenía", async () => {
    const ana = await prisma.user.findUniqueOrThrow({ where: { cedula: `${PREFIX}001` } });
    await prisma.institucion.update({ where: { id: institucionId }, data: { activa: false } });
    try {
      const result = await updateUsuario(ana.id, input({ nombre: "Ana Prueba Activa", cedula: `${PREFIX}001` }));
      expect(result).toEqual({ ok: true, id: ana.id });
    } finally {
      await prisma.institucion.update({ where: { id: institucionId }, data: { activa: true } });
    }
  });
```

y en `cleanup()` cambiar el borrado de sedes a `await prisma.sede.deleteMany({ where: { nombre: { startsWith: SEDE } } });`.

En `src/app/api/usuarios/importar/route.test.ts`:
- Agregar `const INSTITUCION = "Zz Universidad de Prueba Importación"; const SEDE = "Zz Sede de Prueba Importación";`.
- `row()`: `"Universidad / Colegio": INSTITUCION, Entidad: SEDE,`. Se dejan los nombres viejos de columna a propósito: prueban los alias.
- En `beforeEach`, después de `await cleanup();`:

```ts
  await prisma.institucion.upsert({
    where: { nombre: INSTITUCION },
    create: { nombre: INSTITUCION, tipo: "universidad", horasExigidas: 240 },
    update: { activa: true },
  });
  await prisma.sede.upsert({ where: { nombre: SEDE }, create: { nombre: SEDE }, update: { activa: true } });
```

- `afterAll`: `afterAll(async () => { await cleanup(); await prisma.institucion.deleteMany({ where: { nombre: INSTITUCION } }); await prisma.sede.deleteMany({ where: { nombre: SEDE } }); });`
- `"si faltan columnas obligatorias…"`: la fila `{ Nombre: "Sin cédula", Entidad: "Sede" }` ahora reporta `["Cédula", "Institución"]` (Entidad cuenta como Sede).

- [ ] **Step 5: Correr y verificar que fallan**

Run: `pnpm test src/lib/usuarios src/lib/server/usuarioService.test.ts src/app/api/usuarios/importar`
Expected: FAIL (tipos viejos, `institucionId` desconocido, `classifyImportRows` sin catálogo).

- [ ] **Step 6: `src/lib/usuarios/tipoUsuario.ts`**

Reemplazar desde la cabecera hasta `parseTipoUsuario` (incluida) por:

```ts
/**
 * Tipos de usuario: practicantes (con institución, sede y meta de horas del
 * convenio) y voluntarios naturales (sin meta, sin institución ni sede).
 * Universidad / técnica / colegio no es un tipo de usuario: lo dice la
 * institución (src/lib/catalogo/institucion.ts). Módulo puro: lo usan el
 * formulario, la importación, la marcación y el kiosko.
 */

import { TIPO_INSTITUCION_LABEL, isTipoInstitucion } from "@/lib/catalogo/institucion";

export const TIPOS_USUARIO = ["practicante", "natural"] as const;
export type TipoUsuario = (typeof TIPOS_USUARIO)[number];

export const TIPO_USUARIO_LABEL: Record<TipoUsuario, string> = {
  practicante: "Practicante",
  natural: "Voluntario natural",
};

export function isTipoUsuario(value: unknown): value is TipoUsuario {
  return typeof value === "string" && (TIPOS_USUARIO as readonly string[]).includes(value);
}

/** Los naturales acumulan horas, pero sin horas requeridas ni progreso. */
export function tieneMetaDeHoras(tipo: string): boolean {
  return tipo !== "natural";
}

// Universidad, técnica o colegio se aceptan por compatibilidad con los Excel
// viejos: son practicantes y el tipo concreto lo pone su institución.
const TIPO_ALIASES: Record<string, TipoUsuario> = {
  practicante: "practicante",
  universidad: "practicante",
  universitario: "practicante",
  universitaria: "practicante",
  tecnica: "practicante",
  tecnico: "practicante",
  colegio: "practicante",
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
```

(`describeAfiliacion` y `etiquetaTipo` se quedan como las dejaron las Tasks 4 y 5. El import de `institucion` que agregó la Task 5 queda solo una vez.)

- [ ] **Step 7: `src/lib/usuarios/userInput.ts`**

- En `UsuarioInput`, reemplazar `universidad: string | null; entidad: string | null;` (con su comentario) por:

```ts
  /** IDs del catálogo (maqueta 4f); null para voluntarios naturales. */
  institucionId: number | null;
  sedeId: number | null;
```

- En `UsuarioField`, reemplazar `| "universidad"` y `| "entidad"` por `| "institucionId"` y `| "sedeId"`.
- Debajo de `function clean(…)`, agregar:

```ts
/** ID del catálogo: entero positivo, o null. Llega como texto del formulario o número del Excel. */
function parseId(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : clean(raw);
  const id = Number(text);
  return text && Number.isInteger(id) && id > 0 ? id : null;
}
```

- En `validateUsuarioInput`:
  - `const tipo: TipoUsuario = isTipoUsuario(tipoRaw) ? tipoRaw : "practicante";`
  - Reemplazar `let universidad … let entidad …` por `let institucionId: number | null = null;` y `let sedeId: number | null = null;`.
  - Dentro de `if (!esNatural) {`, reemplazar las cuatro líneas de universidad/entidad por:

```ts
    institucionId = parseId(raw.institucionId);
    if (institucionId === null) errors.institucionId = "Falta la institución";

    sedeId = parseId(raw.sedeId);
    if (sedeId === null) errors.sedeId = "Falta la sede";
```

  - En el `value` devuelto, reemplazar `universidad, entidad,` por `institucionId, sedeId,`.

- [ ] **Step 8: `createUsuario` / `updateUsuario` en `src/lib/server/usuarioService.ts`**

Reemplazar `SaveResult`, `createUsuario` y `updateUsuario` por:

```ts
export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: { id: string; nombre: string } }
  | { ok: false; noDisponible: "institucionId" | "sedeId" };

/**
 * Institución o sede elegida que ya no se puede asignar: no existe, o está
 * inactiva y el usuario no la tenía. La que ya tenía la conserva aunque se
 * haya inactivado después.
 */
async function catalogoNoDisponible(
  input: UsuarioInput,
  actual?: { institucionId: number | null; sedeId: number | null }
): Promise<"institucionId" | "sedeId" | null> {
  if (input.institucionId !== null && input.institucionId !== actual?.institucionId) {
    const found = await prisma.institucion.findUnique({ where: { id: input.institucionId }, select: { activa: true } });
    if (!found?.activa) return "institucionId";
  }
  if (input.sedeId !== null && input.sedeId !== actual?.sedeId) {
    const found = await prisma.sede.findUnique({ where: { id: input.sedeId }, select: { activa: true } });
    if (!found?.activa) return "sedeId";
  }
  return null;
}

export async function createUsuario(input: UsuarioInput): Promise<SaveResult> {
  const duplicate = await findDuplicate(input.cedula);
  if (duplicate) return { ok: false, duplicate };
  const noDisponible = await catalogoNoDisponible(input);
  if (noDisponible) return { ok: false, noDisponible };
  const user = await prisma.user.create({ data: toDbInput(input), select: { id: true } });
  return { ok: true, id: user.id };
}

export async function updateUsuario(id: string, input: UsuarioInput): Promise<SaveResult> {
  const duplicate = await findDuplicate(input.cedula, id);
  if (duplicate) return { ok: false, duplicate };
  const actual = await prisma.user.findUnique({ where: { id }, select: { institucionId: true, sedeId: true } });
  const noDisponible = await catalogoNoDisponible(input, actual ?? undefined);
  if (noDisponible) return { ok: false, noDisponible };
  await prisma.user.update({ where: { id }, data: toDbInput(input) });
  return { ok: true, id };
}
```

- [ ] **Step 9: `src/app/admin/usuarios/_form/actions.ts`**

- En `FIELDS`, reemplazar `"universidad",` y `"entidad",` por `"institucionId",` y `"sedeId",`.
- Reemplazar el bloque `if (!result.ok) { … }` por:

```ts
  if (!result.ok) {
    if ("noDisponible" in result) {
      const errors =
        result.noDisponible === "institucionId"
          ? { institucionId: "Esa institución ya no está disponible; elige otra." }
          : { sedeId: "Esa sede ya no está disponible; elige otra." };
      return { status: "invalid", errors, values };
    }
    return {
      status: "invalid",
      errors: { cedula: `Esta cédula ya está registrada a nombre de ${result.duplicate.nombre}.` },
      duplicate: result.duplicate,
      values,
    };
  }
```

- [ ] **Step 10: `src/lib/usuarios/importRows.ts`**

- Imports:

```ts
import type { InstitucionOpcion } from "@/lib/catalogo/institucion";
import { normalizeNombre } from "@/lib/catalogo/nombres";
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { parseTipoUsuario } from "./tipoUsuario";
import { type UsuarioErrors, type UsuarioField, type UsuarioInput, validateUsuarioInput } from "./userInput";
```

- Debajo de `ImportClassification`:

```ts
/** Catálogo indexado por nombre normalizado (`buildCatalogIndex`). */
export interface ImportCatalog {
  instituciones: Map<string, InstitucionOpcion>;
  sedes: Map<string, SedeOpcion>;
}
```

- `type Column = Exclude<UsuarioField, "institucionId" | "sedeId"> | "nombres" | "apellidos" | "institucion" | "sede";`
- En `HEADER_ALIASES`, reemplazar las entradas `universidad` y `entidad` por:

```ts
  institucion: ["institucion", "universidad / colegio", "universidad", "colegio"],
  sede: ["sede", "entidad", "entidad donde practica"],
```

- `REQUIRED`:

```ts
// Las horas ya no son obligatorias: si faltan se toman de la institución.
const REQUIRED: { column: Column; label: string }[] = [
  { column: "cedula", label: "Cédula" },
  { column: "institucion", label: "Institución" },
  { column: "sede", label: "Sede" },
];
```

- Debajo de `isEmptyRow`:

```ts
type Resolucion<T> = { item: T | null; error: string | null };

/**
 * Busca la celda en el catálogo sin distinguir mayúsculas ni tildes. Nunca
 * crea: si no está, la fila queda con error para corregir el nombre o
 * agregarla en Instituciones y sedes.
 */
function resolver<T extends { activa: boolean }>(index: Map<string, T>, raw: string, que: "La institución" | "La sede"): Resolucion<T> {
  const nombre = raw.trim().replace(/\s+/g, " ");
  if (!nombre) return { item: null, error: null }; // validateUsuarioInput dice que falta
  const item = index.get(normalizeNombre(nombre));
  if (!item) return { item: null, error: `${que} «${nombre}» no existe. Agrégala en Instituciones y sedes o corrige el nombre.` };
  if (!item.activa) return { item: null, error: `${que} «${nombre}» está inactiva.` };
  return { item, error: null };
}

const SIN_CATALOGO = { item: null, error: null } as const;
```

- Firma: `export function classifyImportRows(rows: RawRow[], cedulasExistentes: Set<string>, catalogo: ImportCatalog): ImportClassification {`
- En el bucle, reemplazar desde `const tipo = tipoRaw ? parseTipoUsuario(tipoRaw) : "universidad";` hasta el cierre del `if (!validation.ok) { … }` por:

```ts
    const tipo = tipoRaw ? parseTipoUsuario(tipoRaw) : "practicante";
    if (tipo === null) {
      result.errores.push({
        fila,
        nombre: nombre.trim().replace(/\s+/g, " "),
        cedula: cedulaRaw,
        motivo: "El tipo debe ser Practicante o Natural",
      });
      return;
    }

    // Los naturales no llevan institución ni sede: lo escrito se ignora.
    const esNatural = tipo === "natural";
    const institucion = esNatural ? SIN_CATALOGO : resolver(catalogo.instituciones, toText(cell(row, "institucion")), "La institución");
    const sede = esNatural ? SIN_CATALOGO : resolver(catalogo.sedes, toText(cell(row, "sede")), "La sede");

    // Lo que falte en el Excel se toma de la institución (horas) y la sede (horario).
    const horasRaw = toText(cell(row, "horasRequeridas")).trim();
    const horasPorDefecto = institucion.item && institucion.item.horasExigidas > 0 ? String(institucion.item.horasExigidas) : "";
    const horaInicio = toHhmm(cell(row, "horaInicio"));
    const horaFin = toHhmm(cell(row, "horaFin"));
    const sinHorario = !horaInicio && !horaFin;

    const validation = validateUsuarioInput(
      {
        tipo,
        nombre,
        cedula: cedulaRaw,
        email: toText(cell(row, "email")),
        institucionId: institucion.item?.id ?? "",
        sedeId: sede.item?.id ?? "",
        horasRequeridas: horasRaw || horasPorDefecto,
        fechaInicio: toIsoDate(cell(row, "fechaInicio")),
        horaInicio: sinHorario && sede.item?.horaApertura ? sede.item.horaApertura : horaInicio,
        horaFin: sinHorario && sede.item?.horaCierre ? sede.item.horaCierre : horaFin,
      },
      { requireFechaInicio: false }
    );

    const nombreLimpio = nombre.trim().replace(/\s+/g, " ");
    if (!validation.ok || institucion.error || sede.error) {
      const errors: UsuarioErrors = validation.ok ? {} : { ...validation.errors };
      // "No existe" / "está inactiva" explican mejor que "Falta la institución".
      if (institucion.error) errors.institucionId = institucion.error;
      if (sede.error) errors.sedeId = sede.error;
      // La cédula primero: es lo que la coordinadora usa para ubicar la fila.
      const ordered = [errors.cedula, ...Object.values(errors)].filter(Boolean);
      result.errores.push({
        fila,
        nombre: nombreLimpio,
        cedula: cedulaRaw,
        motivo: [...new Set(ordered)].join("; "),
      });
      return;
    }
```

(Borrar la declaración `const nombreLimpio` duplicada que quedaba más abajo, si existe. A partir de `const { cedula } = validation.value;` el bucle sigue igual.)

- [ ] **Step 11: Ruta de importación y plantilla**

`src/app/api/usuarios/importar/route.ts`:
- Agregar `import { buildCatalogIndex } from "@/lib/catalogo/nombres";` y `import { listCatalogo } from "@/lib/server/catalogoService";`.
- Reemplazar `const existentes = await listCedulas(…);` y `const result = classifyImportRows(rows, existentes);` por:

```ts
  const [existentes, { instituciones, sedes }] = await Promise.all([
    listCedulas([...new Set(cedulasDelArchivo)]),
    listCatalogo(),
  ]);
  const catalogo = { instituciones: buildCatalogIndex(instituciones), sedes: buildCatalogIndex(sedes) };

  const result = classifyImportRows(rows, existentes, catalogo);
```

`src/lib/server/excel.ts`, en `TEMPLATE_HEADERS`: `"Universidad / Colegio",` → `"Institución",` y `"Entidad",` → `"Sede",`.

`src/app/api/usuarios/importar/plantilla/route.ts`, reemplazar desde `type Row` hasta el final por:

```ts
type Row = Record<(typeof TEMPLATE_HEADERS)[number], string | number>;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Filas de ejemplo con nombres reales del catálogo, para que se entienda que
  // deben coincidir: un practicante y un voluntario natural, que solo lleva horario.
  const { instituciones, sedes } = await listCatalogo();
  const institucion = instituciones.find((item) => item.activa)?.nombre ?? "Universidad Nacional";
  const sede = sedes.find((item) => item.activa)?.nombre ?? "Sede Centro";

  const ejemplo: Row = {
    Nombre: "Laura Catalina Rodríguez",
    "Cédula": "1019442881",
    Correo: "laura@unal.edu.co",
    Tipo: "Practicante",
    "Institución": institucion,
    Sede: sede,
    "Horas requeridas": 240,
    "Fecha de inicio": "01/08/2026",
    "Hora de inicio": "08:00",
    "Hora de fin": "12:00",
  };
  const ejemploNatural: Row = {
    Nombre: "Marta Lucía Gómez",
    "Cédula": "52123456",
    Correo: "",
    Tipo: "Natural",
    "Institución": "",
    Sede: "",
    "Horas requeridas": "",
    "Fecha de inicio": "",
    "Hora de inicio": "09:00",
    "Hora de fin": "13:00",
  };

  const file = buildWorkbook([ejemplo, ejemploNatural], "Practicantes");
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-practicantes.xlsx"',
    },
  });
}
```

y agregar `import { listCatalogo } from "@/lib/server/catalogoService";`.

- [ ] **Step 12: Correr pruebas y revisar tipos fuera del formulario**

Run: `pnpm test src/lib src/app/api/usuarios`
Expected: PASS.

Run: `pnpm exec tsc --noEmit 2>&1 | grep "error TS" | grep -v "src/app/admin/usuarios/_form/usuario-form.tsx\|src/app/admin/usuarios/nuevo/page.tsx\|src/app/admin/usuarios/\[userId\]/editar/page.tsx"`
Expected: ninguna línea (los únicos errores restantes son los del formulario, que arregla la Task 7).

- [ ] **Step 13: Commit**

```bash
git add src/lib/usuarios src/lib/server/usuarioService.ts src/lib/server/usuarioService.test.ts src/app/admin/usuarios/_form/actions.ts src/app/api/usuarios/importar src/lib/server/excel.ts
git commit -m "feat(usuarios): guarda institución y sede por ID y valida la importación contra el catálogo"
```

---

### Task 7: Formulario de usuario con institución, sede y precarga

**Files:**
- Create: `src/lib/usuarios/precarga.ts`
- Test: `src/lib/usuarios/precarga.test.ts`
- Create: `src/components/admin/institucion-combobox.tsx`
- Modify: `src/app/admin/usuarios/_form/usuario-form.tsx`
- Modify: `src/app/admin/usuarios/nuevo/page.tsx`
- Modify: `src/app/admin/usuarios/[userId]/editar/page.tsx`
- Modify: `src/lib/server/usuarioService.ts` (borrar `listFilterOptions`)

**Interfaces:**
- Consumes: `listCatalogo` (Task 2); `agruparInstituciones`, `InstitucionOpcion` (Task 1); `opcionesVisibles`, `etiquetaOpcion` (Task 1); `SedeOpcion` (Task 1); `TIPOS_USUARIO`, `TIPO_USUARIO_LABEL`, `isTipoUsuario` (Task 6); `UsuarioField` con `institucionId`/`sedeId` (Task 6).
- Produces:
  - `precargar(actual: string, propuestoAntes: string | null, propuesto: string | null): string`
  - `InstitucionCombobox(props: { id: string; name: string; instituciones: InstitucionOpcion[]; defaultValue: number | null; invalid?: boolean; onValueChange?: (value: InstitucionOpcion | null) => void })`
  - `UsuarioFormDefaults`: `institucionId: string; sedeId: string` en lugar de `universidad`/`entidad`. Props `instituciones: InstitucionOpcion[]; sedes: SedeOpcion[]` en lugar de `universidades`/`entidades`.

- [ ] **Step 1: Prueba que falla de `precargar`**

`src/lib/usuarios/precarga.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { precargar } from "./precarga";

describe("precargar", () => {
  it("llena un campo vacío", () => {
    expect(precargar("", null, "240")).toBe("240");
  });

  it("reemplaza lo que se había propuesto antes y nadie tocó", () => {
    expect(precargar("240", "240", "80")).toBe("80");
  });

  it("nunca pisa lo que se escribió a mano", () => {
    expect(precargar("300", "240", "80")).toBe("300");
    expect(precargar("300", null, "80")).toBe("300");
  });

  it("sin propuesta deja el campo como está", () => {
    expect(precargar("240", "240", null)).toBe("240");
    expect(precargar("", null, "")).toBe("");
  });
});
```

Run: `pnpm test src/lib/usuarios/precarga.test.ts`
Expected: FAIL con "Failed to resolve import ./precarga".

- [ ] **Step 2: Implementar `src/lib/usuarios/precarga.ts`**

```ts
/**
 * Valor que propone el catálogo al elegir institución (horas) o sede
 * (horario). Solo reemplaza un campo vacío o que todavía tiene lo último que
 * se propuso: nunca lo que la coordinadora escribió a mano (p. ej. un
 * convenio especial con otras horas).
 */
export function precargar(actual: string, propuestoAntes: string | null, propuesto: string | null): string {
  if (!propuesto) return actual;
  return actual === "" || actual === propuestoAntes ? propuesto : actual;
}
```

Run: `pnpm test src/lib/usuarios/precarga.test.ts`
Expected: PASS.

- [ ] **Step 3: Combobox de institución — `src/components/admin/institucion-combobox.tsx`**

```tsx
"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useMemo } from "react";
import { type InstitucionOpcion, agruparInstituciones } from "@/lib/catalogo/institucion";
import { etiquetaOpcion } from "@/lib/catalogo/nombres";

interface Grupo {
  value: string;
  items: InstitucionOpcion[];
}

interface InstitucionComboboxProps {
  id: string;
  /** Nombre del campo oculto que se envía con el formulario (el ID). */
  name: string;
  instituciones: InstitucionOpcion[];
  defaultValue: number | null;
  invalid?: boolean;
  onValueChange?: (value: InstitucionOpcion | null) => void;
}

/**
 * Institución con búsqueda, agrupada en Universidades / Técnicas / Colegios
 * (pueden ser decenas). Ofrece las activas, más la actual aunque esté inactiva.
 */
export function InstitucionCombobox({ id, name, instituciones, defaultValue, invalid, onValueChange }: InstitucionComboboxProps) {
  const grupos = useMemo(() => agruparInstituciones(instituciones, defaultValue), [instituciones, defaultValue]);
  const inicial = instituciones.find((item) => item.id === defaultValue) ?? null;

  return (
    <Combobox.Root
      items={grupos}
      name={name}
      defaultValue={inicial}
      itemToStringLabel={(item: InstitucionOpcion) => etiquetaOpcion(item)}
      itemToStringValue={(item: InstitucionOpcion) => String(item.id)}
      isItemEqualToValue={(a: InstitucionOpcion, b: InstitucionOpcion) => a.id === b.id}
      onValueChange={(value) => onValueChange?.((value as InstitucionOpcion | null) ?? null)}
      autoHighlight
    >
      <Combobox.InputGroup className="relative">
        <Combobox.Input
          id={id}
          placeholder="Escribe para buscar…"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="h-11 w-full min-w-0 rounded-lg border-[1.5px] border-input bg-white py-2 pr-10 pl-3.5 text-[14.5px] text-navy transition-colors outline-none placeholder:text-navy/45 focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 aria-invalid:border-brand-red aria-invalid:ring-3 aria-invalid:ring-brand-red/15"
        />
        <Combobox.Trigger
          aria-label="Ver instituciones"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-xs text-navy"
        >
          ▾
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup className="max-h-[min(22rem,var(--available-height))] w-(--anchor-width) overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-[0_12px_32px_rgba(19,30,61,.16)]">
            <Combobox.Empty>
              <p className="px-3.5 py-3 text-sm text-muted-foreground">Ninguna institución coincide.</p>
            </Combobox.Empty>
            <Combobox.List>
              {(grupo: Grupo) => (
                <Combobox.Group key={grupo.value} items={grupo.items}>
                  <Combobox.GroupLabel className="px-3.5 pt-2.5 pb-1 text-[11.5px] font-semibold tracking-[.08em] text-navy/62 uppercase">
                    {grupo.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: InstitucionOpcion) => (
                      <Combobox.Item
                        key={item.id}
                        value={item}
                        className="cursor-default px-3.5 py-2 text-[14px] text-navy outline-none select-none data-highlighted:bg-bone-2 data-selected:font-semibold"
                      >
                        {etiquetaOpcion(item)}
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
```

La API de referencia es `node_modules/@base-ui/react/docs/react/components/combobox.md` (secciones "Grouped" y "Root"). Si `tsc` rechaza la anotación de `itemToStringLabel` por el genérico, quitar las anotaciones de tipo de los parámetros y dejar que se infieran de `items`.

- [ ] **Step 4: El formulario — `src/app/admin/usuarios/_form/usuario-form.tsx`**

- Imports: agregar `useRef` a `react`, y además

```tsx
import { InstitucionCombobox } from "@/components/admin/institucion-combobox";
import type { InstitucionOpcion } from "@/lib/catalogo/institucion";
import { etiquetaOpcion, opcionesVisibles } from "@/lib/catalogo/nombres";
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { precargar } from "@/lib/usuarios/precarga";
```

- `UsuarioFormDefaults`: reemplazar `universidad: string; entidad: string;` por `institucionId: string; sedeId: string;`.
- `UsuarioFormProps`: reemplazar `universidades: string[]; entidades: string[];` por `instituciones: InstitucionOpcion[]; sedes: SedeOpcion[];`. En la desestructuración de `UsuarioForm`, lo mismo.
- `const [tipo, setTipo] = useState<TipoUsuario>(isTipoUsuario(values.tipo) ? values.tipo : "practicante");`
- Debajo de `const esNatural = …`, agregar:

```tsx
  const formRef = useRef<HTMLFormElement>(null);
  // Último valor que propuso el catálogo, para no pisar lo escrito a mano.
  const propuesto = useRef<{ horas: string | null; horaInicio: string | null; horaFin: string | null }>({
    horas: null,
    horaInicio: null,
    horaFin: null,
  });
  const institucionActual = Number(values.institucionId) || null;
  const sedeActual = Number(values.sedeId) || null;

  function readPlan(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      fechaInicio: String(data.get("fechaInicio") ?? ""),
      horasRequeridas: String(data.get("horasRequeridas") ?? ""),
      horaInicio: String(data.get("horaInicio") ?? ""),
      horaFin: String(data.get("horaFin") ?? ""),
    };
  }

  /** Escribe la propuesta en el campo (no controlado) y recuerda qué se propuso. */
  function proponer(name: "horasRequeridas" | "horaInicio" | "horaFin", key: "horas" | "horaInicio" | "horaFin", valor: string | null) {
    const input = formRef.current?.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement)) return;
    const next = precargar(input.value, propuesto.current[key], valor);
    if (next !== input.value) {
      input.value = next;
      propuesto.current[key] = next;
    }
  }

  function aplicarInstitucion(institucion: InstitucionOpcion | null) {
    if (!institucion || !formRef.current) return;
    proponer("horasRequeridas", "horas", institucion.horasExigidas > 0 ? String(institucion.horasExigidas) : null);
    setPlan(readPlan(formRef.current));
  }

  function aplicarSede(sede: SedeOpcion | null) {
    if (!sede || !formRef.current) return;
    proponer("horaInicio", "horaInicio", sede.horaApertura);
    proponer("horaFin", "horaFin", sede.horaCierre);
    setPlan(readPlan(formRef.current));
  }
```

- En `<form …>`: agregar `ref={formRef}` y simplificar el `onChange`:

```tsx
      onChange={(event) => {
        const nextTipo = new FormData(event.currentTarget).get("tipo");
        if (isTipoUsuario(nextTipo)) setTipo(nextTipo);
        setPlan(readPlan(event.currentTarget));
      }}
```

- En la tarjeta "Práctica", reemplazar los dos `Field` de `universidad` y `entidad` por:

```tsx
                <Field id="institucionId" label="Institución" required error={errors.institucionId}>
                  <InstitucionCombobox
                    id="institucionId"
                    name="institucionId"
                    instituciones={instituciones}
                    defaultValue={institucionActual}
                    invalid={Boolean(errors.institucionId)}
                    onValueChange={aplicarInstitucion}
                  />
                </Field>
                <Field
                  id="sedeId"
                  label="Sede"
                  required
                  error={errors.sedeId}
                  hint={
                    <>
                      ¿No está en la lista?{" "}
                      <Link
                        href="/admin/instituciones-y-sedes"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand-red-ink hover:underline"
                      >
                        Agrégala en Instituciones y sedes
                      </Link>{" "}
                      (se abre en otra pestaña).
                    </>
                  }
                >
                  <div className="relative">
                    <select
                      id="sedeId"
                      name="sedeId"
                      defaultValue={values.sedeId}
                      onChange={(event) => aplicarSede(sedes.find((sede) => String(sede.id) === event.target.value) ?? null)}
                      {...invalid("sedeId")}
                      className="h-11 w-full cursor-pointer appearance-none rounded-lg border-[1.5px] border-input bg-white pr-10 pl-3.5 text-[14.5px] text-navy outline-none focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 aria-invalid:border-brand-red aria-invalid:ring-3 aria-invalid:ring-brand-red/15"
                    >
                      <option value="">Elige una sede</option>
                      {opcionesVisibles(sedes, sedeActual).map((sede) => (
                        <option key={sede.id} value={sede.id}>
                          {etiquetaOpcion(sede)}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-navy">
                      ▾
                    </span>
                  </div>
                </Field>
```

- En el `Field` de `horasRequeridas`, cambiar el `hint` a `"Se proponen las de la institución; las define el convenio."`. En el del horario, a `"Se propone el de la sede. Sirve para marcar llegadas tarde."`.
- Borrar los dos `<datalist>` del final de la tarjeta "Práctica".

- [ ] **Step 5: Páginas `nuevo` y `editar`**

`src/app/admin/usuarios/nuevo/page.tsx`:

```tsx
import type { Metadata } from "next";
import { listCatalogo } from "@/lib/server/catalogoService";
import { UsuarioForm } from "../_form/usuario-form";

export const metadata: Metadata = { title: "Crear usuario" };

export default async function NuevoUsuarioPage() {
  const { instituciones, sedes } = await listCatalogo();

  return (
    <UsuarioForm
      fotos={0}
      instituciones={instituciones}
      sedes={sedes}
      defaults={{
        tipo: "practicante",
        nombre: "",
        cedula: "",
        email: "",
        institucionId: "",
        sedeId: "",
        horasRequeridas: "",
        fechaInicio: "",
        horaInicio: "",
        horaFin: "",
        activo: "true",
      }}
    />
  );
}
```

`src/app/admin/usuarios/[userId]/editar/page.tsx`:
- Imports: quitar `listFilterOptions` y `isTipoUsuario`. Agregar `import { listCatalogo } from "@/lib/server/catalogoService";`.
- `const [user, { instituciones, sedes }] = await Promise.all([getUsuario(userId), listCatalogo()]);`
- Props: `instituciones={instituciones}` y `sedes={sedes}` en lugar de `universidades`/`entidades`.
- `defaults`:

```tsx
        tipo: user.tipo === "natural" ? "natural" : "practicante",
        nombre: user.nombre,
        cedula: user.cedula,
        email: user.email ?? "",
        institucionId: user.institucionId ? String(user.institucionId) : "",
        sedeId: user.sedeId ? String(user.sedeId) : "",
```

(el resto de `defaults` sigue igual).

- [ ] **Step 6: Borrar `listFilterOptions`**

En `src/lib/server/usuarioService.ts`, borrar la función `listFilterOptions` con su comentario.

Run: `grep -rn "listFilterOptions" src`
Expected: sin resultados.

- [ ] **Step 7: Tipos, lint y pruebas**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test src/lib`
Expected: sin errores y todo en PASS.

- [ ] **Step 8: Verificar en el navegador**

En `/admin/usuarios/nuevo`, a 1366×768:
- "Tipo de usuario" muestra **Practicante** / **Voluntario natural**.
- El combobox de Institución filtra al escribir "nac", agrupa por Universidades / Técnicas / Colegios y no muestra las inactivas.
- Elegir una institución con 240 h llena "Horas requeridas" con 240. Escribir 300 y elegir otra institución **deja 300**.
- Elegir una sede con horario 07:00–17:00 llena el horario y la fecha estimada de fin se recalcula.
- Guardar sin institución muestra "Falta la institución" bajo el combobox.
- Editar a un usuario cuya sede se inactivó muestra "Nombre (inactiva)" seleccionada, y guardar funciona.

- [ ] **Step 9: Commit**

```bash
git add src/lib/usuarios/precarga.ts src/lib/usuarios/precarga.test.ts src/components/admin/institucion-combobox.tsx src/app/admin/usuarios/_form/usuario-form.tsx src/app/admin/usuarios/nuevo/page.tsx "src/app/admin/usuarios/[userId]/editar/page.tsx" src/lib/server/usuarioService.ts
git commit -m "feat(usuarios): elige institución y sede del catálogo y propone horas y horario"
```

---

### Task 8: Migración de contracción y limpieza

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_tipo_practicante_sin_texto_libre/migration.sql` (generado y editado)
- Modify: `src/app/api/marcacion/qr/route.test.ts`, `src/app/api/usuarios/[userId]/enrolar/route.test.ts`, `src/app/api/usuarios/importar/route.test.ts`, `src/lib/configRules.test.ts`

**Interfaces:**
- Produces: `User` sin `universidad` ni `entidad`; `User.tipo` con `@default("practicante")` y valores `practicante | natural` en la base.

- [ ] **Step 1: Confirmar que no queda nada sin enlazar**

```bash
pnpm exec tsx -e '
process.loadEnvFile(".env");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
console.log(await prisma.user.findMany({
  where: { tipo: { not: "natural" }, OR: [{ institucionId: null }, { sedeId: null }] },
  select: { cedula: true, nombre: true, universidad: true, entidad: true },
}));
await prisma.$disconnect();
'
```

Expected: `[]`. Si aparece alguien, es un practicante creado entre la Task 2 y la Task 6 por el formulario viejo. Asignarle institución y sede desde "Editar usuario" antes de seguir, porque el paso 3 borra el texto.

- [ ] **Step 2: Esquema**

En `model User` de `prisma/schema.prisma`:
- Borrar las líneas `universidad String?` y `entidad String?` (con sus comentarios).
- Cambiar la línea de `tipo` y su comentario a:

```prisma
  // practicante | natural (src/lib/usuarios/tipoUsuario.ts). Universidad /
  // técnica / colegio lo dice la institución.
  tipo            String          @default("practicante") @db.VarChar(20)
```

- [ ] **Step 3: Generar la migración y anteponer la conversión de tipos**

Run: `pnpm exec prisma migrate dev --create-only --name tipo_practicante_sin_texto_libre`

En el `migration.sql` generado, justo **después** de `BEGIN TRAN;`, pegar:

```sql
-- Universidad / colegio ya no es un tipo de usuario: lo dice su institución
-- (maqueta 4f). El texto libre de universidad y entidad ya está en el
-- catálogo desde la migración instituciones_y_sedes.
UPDATE [dbo].[User] SET [tipo] = 'practicante' WHERE [tipo] <> 'natural';
```

Revisar que el resto del archivo **solo** cambie el default de `tipo` (`User_tipo_df`) y haga `DROP COLUMN [universidad], [entidad]`.

Run: `pnpm exec prisma migrate dev`
Expected: migración aplicada y cliente regenerado.

- [ ] **Step 4: Ajustar las pruebas que creaban usuarios con texto libre**

Run: `pnpm exec tsc --noEmit`
Expected: errores solo en archivos de prueba que todavía pasan `universidad` / `entidad`.

- `src/app/api/marcacion/qr/route.test.ts` y `src/app/api/usuarios/[userId]/enrolar/route.test.ts`: borrar las líneas `universidad: "Universidad de Prueba",` y `entidad: "Entidad de Prueba",` del `data` de `prisma.user.create`. Esas pruebas no dependen de la afiliación.
- `src/app/api/usuarios/importar/route.test.ts`: `data: { nombre: "Ya Existía", cedula: \`${PREFIX}009\`, universidad: "U", entidad: "E" }` → `data: { nombre: "Ya Existía", cedula: \`${PREFIX}009\` }`.
- `src/lib/configRules.test.ts:104`: `reglasPara(config, "universidad")` → `reglasPara(config, "practicante")`.

Run: `grep -rn "universidad:\|entidad:" src --include=*.ts --include=*.tsx`
Expected: solo apariciones dentro de `TIPO_INSTITUCION_LABEL`, `TIPO_INSTITUCION_GRUPO`, `TIPO_ALIASES` y los datos de prueba de `tipo: "universidad"` de instituciones. Ningún campo de `User`.

- [ ] **Step 5: Todo verde**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: sin errores de tipos ni de lint, y todas las pruebas en PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/app/api/marcacion/qr/route.test.ts "src/app/api/usuarios/[userId]/enrolar/route.test.ts" src/app/api/usuarios/importar/route.test.ts src/lib/configRules.test.ts
git commit -m "refactor(db): elimina universidad y entidad de texto y deja el tipo en practicante o natural" -m "BREAKING CHANGE: User.universidad y User.entidad dejan de existir; la afiliación sale de Institucion y Sede."
```

---

### Task 9: Prueba de punta a punta y documentación

**Files:**
- Create: `e2e/instituciones-y-sedes.spec.ts`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-10-10-tipos-de-usuario-design.md` (nota al inicio)

- [ ] **Step 1: Prueba E2E**

`e2e/instituciones-y-sedes.spec.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

process.loadEnvFile(".env");

const SUFIJO = `E2E ${Date.now()}`;
const SEDE = `Sede ${SUFIJO}`;
const INSTITUCION = `Universidad ${SUFIJO}`;
const CEDULA = `9900${String(Date.now()).slice(-6)}`;

test.use({ viewport: { width: 1366, height: 768 } });

test.afterAll(async () => {
  const prisma = new PrismaClient();
  await prisma.user.deleteMany({ where: { cedula: CEDULA } });
  await prisma.institucion.deleteMany({ where: { nombre: INSTITUCION } });
  await prisma.sede.deleteMany({ where: { nombre: SEDE } });
  await prisma.$disconnect();
});

test("instituciones y sedes de punta a punta", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(process.env.SEED_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin/);

  // 4f: crear sede e institución.
  await page.getByRole("link", { name: "Instituciones y sedes" }).click();
  await page.getByRole("button", { name: "+ Agregar sede" }).click();
  await page.locator("#sede-nombre").fill(SEDE);
  await page.locator("#sede-apertura").fill("07:00");
  await page.getByLabel("Hora de cierre").fill("17:00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: SEDE })).toBeVisible();

  await page.getByRole("button", { name: "+ Agregar institución" }).click();
  await page.locator("#institucion-nombre").fill(INSTITUCION);
  await page.locator("#institucion-horas").fill("240");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("cell", { name: INSTITUCION })).toBeVisible();

  // Nombre repetido con otras mayúsculas: error, sin perder lo escrito.
  await page.getByRole("button", { name: "+ Agregar sede" }).click();
  await page.locator("#sede-nombre").fill(SEDE.toLowerCase());
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ya existe una sede con ese nombre")).toBeVisible();
  await expect(page.locator("#sede-nombre")).toHaveValue(SEDE.toLowerCase());
  await page.keyboard.press("Escape");

  // 4c: crear practicante eligiendo del catálogo, con precarga.
  await page.goto("/admin/usuarios/nuevo");
  await page.locator("#nombre").fill(`Practicante ${SUFIJO}`);
  await page.locator("#cedula").fill(CEDULA);
  await page.locator("#institucionId").fill(SUFIJO);
  await page.getByRole("option", { name: INSTITUCION }).click();
  await expect(page.locator("#horasRequeridas")).toHaveValue("240");
  await page.locator("#sedeId").selectOption({ label: SEDE });
  await expect(page.locator("#horaInicio")).toHaveValue("07:00");
  await expect(page.locator("#horaFin")).toHaveValue("17:00");
  await page.locator("#fechaInicio").fill("2026-08-01");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.waitForURL(/\/admin\/usuarios$/);

  // 2a: filtrar por sede.
  await page.locator('select[aria-label="Sede"]').selectOption({ label: SEDE });
  await expect(page.getByRole("link", { name: `Quitar filtro Sede: ${SEDE}` })).toBeVisible();
  const fila = page.getByRole("row", { name: new RegExp(`Practicante ${SUFIJO}`) });
  await expect(fila).toContainText(INSTITUCION);
  await expect(fila).toContainText(SEDE);
  await expect(fila).toContainText("Universidad");
});
```

Run: `pnpm exec playwright test e2e/instituciones-y-sedes.spec.ts`
Expected: 1 passed. (Necesita `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` en `.env` y el admin creado con `pnpm exec prisma db seed`.)

- [ ] **Step 2: `AGENTS.md`**

- **Modelo de datos:** en `users`, reemplazar `universidad, entidad` por `tipo (practicante | natural), institucion_id (FK, NULL para naturales), sede_id (FK, NULL para naturales)`. Agregar:
  - `` `institucion`: id, nombre (único), tipo (`universidad` | `tecnica` | `colegio`), horas_exigidas (valor por defecto de las horas requeridas al asignarla), activa. No se borra: se inactiva. ``
  - `` `sede`: id, nombre (único), direccion, hora_apertura / hora_cierre ("HH:mm", horario por defecto de sus practicantes), activa. No se borra: se inactiva. ``
  - Una línea: "Universidad / técnica / colegio no es un tipo de usuario: lo dice la institución. La UI dice siempre **Institución** y **Sede**; «Entidad» solo sobrevive como alias de columna al importar. La importación nunca crea instituciones ni sedes: rechaza la fila."
- **Decisiones pendientes:**
  - Reemplazar `- [ ] Catálogo de Entidades y sedes (4f): …` por `- [x] Catálogo de Instituciones y sedes (4f): desplegables en formulario y filtros; la importación valida contra el catálogo`.
  - Agregar:
    - `- [ ] Estado de los kioskos en las tarjetas de sede (4f): requiere el identificador por kiosko`
    - `- [ ] Fusionar instituciones o sedes duplicadas (reasignar sus usuarios) cuando haya datos reales`
    - `- [ ] Días de atención de la sede (la maqueta muestra L–V / L–S)`
    - `- [ ] Reportes por institución y sede (módulo 3)`

- [ ] **Step 3: Nota en el spec de tipos**

Debajo de la línea `Fecha: …` de `docs/superpowers/specs/2026-10-10-tipos-de-usuario-design.md`:

```markdown
> **Reemplazado en parte por** `2026-10-10-instituciones-y-sedes-design.md`: `User.tipo` es ahora
> `practicante | natural` y universidad / técnica / colegio lo dice la institución. Las reglas
> propias de los naturales (tolerancia y salida mínima) siguen vigentes.
```

- [ ] **Step 4: Verificación final**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: sin errores; todo PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/instituciones-y-sedes.spec.ts AGENTS.md docs/superpowers/specs/2026-10-10-tipos-de-usuario-design.md
git commit -m "docs(agents): documenta el catálogo de instituciones y sedes y agrega su prueba e2e"
```
