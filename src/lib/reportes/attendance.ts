import { lateMinutes } from "@/lib/server/markingRules";
import type { AttendanceMark, WorkedTimeOptions } from "@/lib/server/workedTime";
import { addDays, startOfDay } from "./dates";
import { type ReporteRow, type ReporteUser, buildReporteRow } from "./rows";

export type EstadoAsistencia = "presente" | "marcaron" | "tarde" | "sin-marcar";

export interface AsistenciaRow extends ReporteRow {
  entrada: Date | null;
  salida: Date | null;
  presente: boolean;
  minutosTarde: number | null;
  sinMarcar: boolean;
}

export interface AsistenciaSummary {
  total: number;
  presentes: number;
  marcaron: number;
  tarde: number;
  sinMarcar: number;
}

export function isExpected(
  user: Pick<ReporteUser, "activo" | "fechaInicio">,
  completado: boolean,
  day: Date
): boolean {
  if (!user.activo || completado) return false;
  return !user.fechaInicio || user.fechaInicio.getTime() <= day.getTime();
}

export function buildAsistenciaRow(
  user: ReporteUser,
  marks: AttendanceMark[],
  day: Date,
  options: { worked: WorkedTimeOptions; toleranciaMin: number }
): AsistenciaRow {
  const base = buildReporteRow(user, marks, options.worked);

  const start = startOfDay(day);
  const end = addDays(start, 1);
  const delDia = marks
    .filter((mark) => mark.marcadoEn >= start && mark.marcadoEn < end)
    .sort((a, b) => a.marcadoEn.getTime() - b.marcadoEn.getTime());

  const entrada = delDia.find((mark) => mark.tipo === "IN")?.marcadoEn ?? null;
  const ultima = delDia[delDia.length - 1];

  return {
    ...base,
    entrada,
    salida: ultima?.tipo === "OUT" ? ultima.marcadoEn : null,
    presente: ultima?.tipo === "IN",
    minutosTarde: entrada ? lateMinutes(entrada, user.horaInicio ?? null, options.toleranciaMin) : null,
    sinMarcar: entrada === null && isExpected(user, base.estado === "completado", start),
  };
}

export function incluirEnAsistencia(row: AsistenciaRow): boolean {
  return row.entrada !== null || row.sinMarcar;
}

export function matchesEstadoAsistencia(row: AsistenciaRow, estado: EstadoAsistencia | undefined): boolean {
  switch (estado) {
    case "presente":
      return row.presente;
    case "marcaron":
      return row.entrada !== null;
    case "tarde":
      return row.minutosTarde !== null;
    case "sin-marcar":
      return row.sinMarcar;
    default:
      return true;
  }
}

export function summarizeAsistencia(rows: AsistenciaRow[]): AsistenciaSummary {
  const summary: AsistenciaSummary = { total: rows.length, presentes: 0, marcaron: 0, tarde: 0, sinMarcar: 0 };
  for (const row of rows) {
    if (row.presente) summary.presentes += 1;
    if (row.entrada !== null) summary.marcaron += 1;
    if (row.minutosTarde !== null) summary.tarde += 1;
    if (row.sinMarcar) summary.sinMarcar += 1;
  }
  return summary;
}