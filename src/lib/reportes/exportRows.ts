import { ESTADO_REPORTE_LABEL, msToHours } from "./progress";
import type { ReporteRow } from "./rows";

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-09-14 08:02" en hora local del servidor (el PC de la fundación). */
function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Filas de la hoja de Excel. Las horas van como número (con dos decimales,
 * truncadas) para que la coordinadora pueda sumarlas o filtrarlas en Excel; la
 * cédula va como texto para que Excel no la convierta en notación científica.
 */
export function toExportRows(rows: ReporteRow[]): Record<string, string | number>[] {
  return rows.map((row) => ({
    Nombre: row.nombre,
    "Cédula": row.cedula,
    "Universidad / Colegio": row.universidad,
    Entidad: row.entidad,
    "Horas requeridas": row.horasRequeridas,
    "Horas cumplidas": msToHours(row.workedMs, 2),
    "Horas restantes": row.remainingMs === null ? "" : msToHours(row.remainingMs, 2),
    "Avance (%)": row.percent ?? "",
    "Última marcación": row.ultimaMarcacion ? formatDateTime(row.ultimaMarcacion.en) : "",
    Estado: ESTADO_REPORTE_LABEL[row.estado],
  }));
}
