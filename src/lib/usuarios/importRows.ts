import type { InstitucionOpcion } from "@/lib/catalogo/institucion";
import { normalizeNombre } from "@/lib/catalogo/nombres";
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { parseTipoUsuario } from "./tipoUsuario";
import { type UsuarioErrors, type UsuarioField, type UsuarioInput, validateUsuarioInput } from "./userInput";

/** Fila tal como la entrega SheetJS: texto, número (seriales de Excel) o Date. */
export type RawRow = Record<string, unknown>;

export interface ImportIssue {
  /** Número de fila en Excel (la 1 es el encabezado). */
  fila: number;
  nombre: string;
  cedula: string;
  motivo: string;
}

export interface ImportClassification {
  validos: { fila: number; input: UsuarioInput }[];
  duplicados: ImportIssue[];
  errores: ImportIssue[];
  /** Columnas obligatorias que no aparecen en el encabezado. */
  columnasFaltantes: string[];
}

/** Catálogo indexado por nombre normalizado (`buildCatalogIndex`). */
export interface ImportCatalog {
  instituciones: Map<string, InstitucionOpcion>;
  sedes: Map<string, SedeOpcion>;
}

type Column = Exclude<UsuarioField, "institucionId" | "sedeId"> | "nombres" | "apellidos" | "institucion" | "sede";

// Encabezados aceptados, ya normalizados (minúsculas, sin tildes ni espacios extra).
const HEADER_ALIASES: Record<Column, string[]> = {
  nombre: ["nombre", "nombre completo", "nombres y apellidos", "practicante"],
  tipo: ["tipo", "tipo de usuario", "tipo de practicante"],
  nombres: ["nombres"],
  apellidos: ["apellidos"],
  cedula: ["cedula", "cedula / documento", "documento", "numero de documento", "cc"],
  email: ["correo", "email", "correo electronico"],
  institucion: ["institucion", "universidad / colegio", "universidad", "colegio"],
  sede: ["sede", "entidad", "entidad donde practica"],
  horasRequeridas: ["horas requeridas", "horas exigidas", "horas"],
  fechaInicio: ["fecha de inicio", "fecha inicio", "inicio"],
  horaInicio: ["hora de inicio", "hora inicio", "hora de llegada", "llegada"],
  horaFin: ["hora de fin", "hora fin", "hora de salida", "salida"],
};

// Las horas ya no son obligatorias: si faltan se toman de la institución.
const REQUIRED: { column: Column; label: string }[] = [
  { column: "cedula", label: "Cédula" },
  { column: "institucion", label: "Institución" },
  { column: "sede", label: "Sede" },
];

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Día 0 de Excel en milisegundos (30/12/1899), para convertir seriales.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

function excelSerialToDate(serial: number): Date {
  const utc = new Date(EXCEL_EPOCH_UTC + Math.round(serial) * 86_400_000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Fecha de Excel → "YYYY-MM-DD" (lo que espera validateUsuarioInput). */
function toIsoDate(value: unknown): string {
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = excelSerialToDate(value);
  else if (typeof value === "string") {
    const text = value.trim();
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
    if (dmy) return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
    return text;
  }
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : "";
}

/** Hora de Excel → "HH:mm". Excel guarda horas como fracción de día. */
function toHhmm(value: unknown): string {
  if (value instanceof Date) return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60);
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }
  const text = toText(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  return match ? `${pad(Number(match[1]))}:${match[2]}` : text;
}

function isEmptyRow(row: RawRow): boolean {
  return Object.values(row).every((value) => toText(value).trim() === "");
}

type Resolucion<T> = { item: T | null; error: string | null };

/**
 * Busca la celda en el catálogo sin distinguir mayúsculas ni tildes. Nunca
 * crea: si no está, la fila queda con error para corregir el nombre o
 * agregarla en Instituciones y sedes.
 */
function resolver<T extends { activa: boolean }>(
  index: Map<string, T>,
  raw: string,
  que: "La institución" | "La sede"
): Resolucion<T> {
  const nombre = raw.trim().replace(/\s+/g, " ");
  if (!nombre) return { item: null, error: null }; // validateUsuarioInput dice que falta
  const item = index.get(normalizeNombre(nombre));
  if (!item) return { item: null, error: `${que} «${nombre}» no existe. Agrégala en Instituciones y sedes o corrige el nombre.` };
  if (!item.activa) return { item: null, error: `${que} «${nombre}» está inactiva.` };
  return { item, error: null };
}

const SIN_CATALOGO = { item: null, error: null } as const;

/**
 * Clasifica las filas de un Excel de practicantes en válidas, duplicadas y con
 * error (maqueta 2b). `cedulasExistentes` son las ya registradas en la base.
 */
export function classifyImportRows(rows: RawRow[], cedulasExistentes: Set<string>, catalogo: ImportCatalog): ImportClassification {
  const headers = new Set(rows.flatMap((row) => Object.keys(row)));
  const columnKey = new Map<Column, string>();
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [Column, string[]][]) {
      if (!columnKey.has(column) && aliases.includes(normalized)) columnKey.set(column, header);
    }
  }

  const hasNombre = columnKey.has("nombre") || columnKey.has("nombres");
  // Con columna Tipo puede haber naturales, que no llevan datos de práctica;
  // entonces cada fila se valida por su cuenta en vez de exigir la columna.
  const required = columnKey.has("tipo") ? REQUIRED.filter(({ column }) => column === "cedula") : REQUIRED;
  const columnasFaltantes = [
    ...(hasNombre ? [] : ["Nombre"]),
    ...required.filter(({ column }) => !columnKey.has(column as Column)).map(({ label }) => label),
  ];
  const result: ImportClassification = { validos: [], duplicados: [], errores: [], columnasFaltantes };
  if (columnasFaltantes.length > 0) return result;

  const cell = (row: RawRow, column: Column) => {
    const key = columnKey.get(column);
    return key === undefined ? undefined : row[key];
  };
  const seenInFile = new Map<string, number>();

  rows.forEach((row, index) => {
    const fila = index + 2;
    if (isEmptyRow(row)) return;

    const nombre = columnKey.has("nombre")
      ? toText(cell(row, "nombre"))
      : `${toText(cell(row, "nombres"))} ${toText(cell(row, "apellidos"))}`;
    const cedulaRaw = toText(cell(row, "cedula")).trim();

    const tipoRaw = toText(cell(row, "tipo")).trim();
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
    const institucion = esNatural
      ? SIN_CATALOGO
      : resolver(catalogo.instituciones, toText(cell(row, "institucion")), "La institución");
    const sede = esNatural ? SIN_CATALOGO : resolver(catalogo.sedes, toText(cell(row, "sede")), "La sede");

    // Lo que falte en el Excel se toma de la institución (horas) y la sede (horario).
    const horasRaw = toText(cell(row, "horasRequeridas")).trim();
    const horasPorDefecto =
      institucion.item && institucion.item.horasExigidas > 0 ? String(institucion.item.horasExigidas) : "";
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

    const { cedula } = validation.value;
    const firstRow = seenInFile.get(cedula);
    if (firstRow !== undefined) {
      result.duplicados.push({ fila, nombre: nombreLimpio, cedula, motivo: `Repetida en la fila ${firstRow}` });
      return;
    }
    seenInFile.set(cedula, fila);

    if (cedulasExistentes.has(cedula)) {
      result.duplicados.push({ fila, nombre: nombreLimpio, cedula, motivo: "Ya está registrada" });
      return;
    }

    result.validos.push({ fila, input: validation.value });
  });

  return result;
}
