import { type AttendanceMark, type WorkedTimeOptions, sumWorkedMs } from "@/lib/server/workedTime";
import { type EstadoReporte, estadoReporte, progressPercent, remainingMs } from "./progress";

/** Datos del practicante que el reporte necesita; los trae `reporteService`. */
export interface ReporteUser {
  id: string;
  nombre: string;
  cedula: string;
  institucion: string | null;
  sede: string | null;
  activo: boolean;
  horasRequeridas: number;
  horaInicio?: string | null;
  fechaInicio?: Date | null;
  sinRostro?: boolean;
}

export interface ReporteRow extends ReporteUser {
  workedMs: number;
  remainingMs: number | null;
  percent: number | null;
  estado: EstadoReporte;
  ultimaMarcacion: { en: Date; tipo: string } | null;
}

export interface ReporteSummary {
  total: number;
  enCurso: number;
  porFinalizar: number;
  completados: number;
  inactivos: number;
  workedMs: number;
}

/**
 * Una fila del reporte. Las horas salen de `sumWorkedMs`, la misma función
 * que usa el kiosko al marcar la salida: el número que ve la coordinadora es
 * el mismo que vio el practicante.
 */
export function buildReporteRow(
  user: ReporteUser,
  marks: AttendanceMark[],
  options: WorkedTimeOptions
): ReporteRow {
  const workedMs = sumWorkedMs(marks, options);

  let ultima: (typeof marks)[number] | null = null;
  for (const mark of marks) {
    if (!ultima || mark.marcadoEn > ultima.marcadoEn) ultima = mark;
  }

  return {
    ...user,
    workedMs,
    remainingMs: remainingMs(workedMs, user.horasRequeridas),
    percent: progressPercent(workedMs, user.horasRequeridas),
    estado: estadoReporte({ activo: user.activo, workedMs, horasRequeridas: user.horasRequeridas }),
    ultimaMarcacion: ultima ? { en: ultima.marcadoEn, tipo: ultima.tipo } : null,
  };
}

export function summarize(rows: ReporteRow[]): ReporteSummary {
  const summary: ReporteSummary = {
    total: rows.length,
    enCurso: 0,
    porFinalizar: 0,
    completados: 0,
    inactivos: 0,
    workedMs: 0,
  };
  for (const row of rows) {
    summary.workedMs += row.workedMs;
    if (row.estado === "en-curso") summary.enCurso += 1;
    else if (row.estado === "por-finalizar") summary.porFinalizar += 1;
    else if (row.estado === "completado") summary.completados += 1;
    else summary.inactivos += 1;
  }
  return summary;
}

/** Orden alfabético en español (Álvaro antes que Beto). No modifica el arreglo recibido. */
export function sortByNombre<T extends { nombre: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
