import type { AsistenciaRow } from "./attendance";
import { formatTime } from "./dates";
import { msToHours } from "./progress";

function estadoTexto(row: AsistenciaRow, esHoy: boolean): string {
  if (row.sinMarcar) return "Sin marcar";
  if (row.presente) return esHoy ? "Presente" : "Sin salida registrada";
  return "Ya salió";
}

export function toAsistenciaExportRows(rows: AsistenciaRow[], esHoy: boolean): Record<string, string | number>[] {
  return rows.map((row) => ({
    Nombre: row.nombre,
    "Cédula": row.cedula,
    "Universidad / Colegio": row.universidad,
    Entidad: row.entidad,
    Entrada: row.entrada ? formatTime(row.entrada) : "",
    Salida: row.salida ? formatTime(row.salida) : "",
    Estado: estadoTexto(row, esHoy),
    "Minutos de retraso": row.minutosTarde ?? "",
    "Horas cumplidas": msToHours(row.workedMs, 2),
    "Horas requeridas": row.horasRequeridas,
  }));
}