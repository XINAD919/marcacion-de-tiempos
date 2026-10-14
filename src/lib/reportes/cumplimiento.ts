import { formatSince } from "./dates";
import type { ReporteRow } from "./rows";

export const RIESGO_OPCIONES = [25, 50, 75].map((n) => ({
  value: String(n),
  label: `Menos del ${n} %`,
  chip: `Riesgo: menos del ${n} %`,
}));
export const RIESGO_DEFAULT = "50";
export const RIESGO_OFF = "0";
export const MAX_ANILLOS = 8;

export function riesgoUmbral(riesgo: string | undefined): number | null {
  if (riesgo === RIESGO_OFF) return null;
  return Number(riesgo ?? RIESGO_DEFAULT);
}

const byNombre = (a: ReporteRow, b: ReporteRow) => a.nombre.localeCompare(b.nombre, "es");

export function splitCumplimiento(rows: ReporteRow[], umbral: number | null, maxAnillos = MAX_ANILLOS) {
  const enRiesgo =
    umbral === null
      ? []
      : rows
          .filter((row) => row.percent !== null && row.percent < umbral)
          .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0) || byNombre(a, b));

  const anillos = enRiesgo.slice(0, maxAnillos);
  const enAnillos = new Set(anillos.map((row) => row.id));

  const resto = rows
    .filter((row) => !enAnillos.has(row.id))
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || byNombre(a, b));

  return { enRiesgo, anillos, resto };
}

export function ringNote(row: ReporteRow, now: Date): string {
  const ultima = row.ultimaMarcacion ? formatSince(row.ultimaMarcacion.en, now) : null;
  if (!row.activo) return ultima ? `Inactivo · última marcación: ${ultima}` : "Inactivo";
  if (row.sinRostro) return "Sin rostro registrado";
  return ultima ? `Última marcación: ${ultima}` : "Sin marcaciones";
}