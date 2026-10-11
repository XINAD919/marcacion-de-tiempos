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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return TIPO_ALIASES[key] ?? null;
}

interface ConNombre {
  nombre: string;
}

/** Línea bajo el nombre (kiosko, carnet, enrolamiento): "Institución · Sede". */
export function describeAfiliacion(user: { tipo: string; institucion: ConNombre | null; sede: ConNombre | null }): string {
  if (user.tipo === "natural") return TIPO_USUARIO_LABEL.natural;
  return [user.institucion?.nombre, user.sede?.nombre].filter((part) => part && part.trim()).join(" · ");
}

/** Columna Tipo del listado: la del practicante la pone su institución. */
export function etiquetaTipo(user: { tipo: string; institucionTipo: string | null }): string {
  if (user.tipo === "natural") return TIPO_USUARIO_LABEL.natural;
  return isTipoInstitucion(user.institucionTipo) ? TIPO_INSTITUCION_LABEL[user.institucionTipo] : "—";
}
