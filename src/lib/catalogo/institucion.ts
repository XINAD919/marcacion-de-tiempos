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
