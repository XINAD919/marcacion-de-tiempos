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
