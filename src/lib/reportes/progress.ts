/**
 * Reglas de avance de un practicante, compartidas por la pantalla de Reportes
 * y la exportación a Excel. Módulo puro (sin Prisma): se prueba sin base de
 * datos. Las horas cumplidas no se guardan; llegan ya calculadas por
 * `sumWorkedMs` a partir de `attendance_logs` (AGENTS.md › Modelo de datos).
 */

const HOUR_MS = 60 * 60 * 1000;

/**
 * Desde qué fracción de las horas requeridas un practicante se considera
 * "próximo a finalizar". Decisión por confirmar con la fundación (AGENTS.md ›
 * Decisiones pendientes): cambiar este valor basta para ajustar toda la app.
 */
export const NEAR_COMPLETION_RATIO = 0.9;

export type EstadoReporte = "en-curso" | "por-finalizar" | "completado" | "inactivo";

export const ESTADO_REPORTE_LABEL: Record<EstadoReporte, string> = {
  "en-curso": "En curso",
  "por-finalizar": "Por finalizar",
  completado: "Completado",
  inactivo: "Inactivo",
};

export type ProgressTier = "green" | "amber" | "red";

function goalMs(horasRequeridas: number): number {
  return Math.max(0, horasRequeridas) * HOUR_MS;
}

/**
 * Avance de 0 a 100, truncado: nunca se muestra más avance del cumplido.
 * Null si el practicante no tiene horas requeridas (filas anteriores a que
 * el formulario las exigiera), para no mostrar un 0 % engañoso.
 */
export function progressPercent(workedMs: number, horasRequeridas: number): number | null {
  const goal = goalMs(horasRequeridas);
  if (goal <= 0) return null;
  return Math.min(100, Math.max(0, Math.floor((workedMs / goal) * 100)));
}

/** Color por tramo: verde ≥ 50 %, ámbar 25–49 %, rojo < 25 % (AGENTS.md › Progreso de horas). */
export function progressTier(percent: number): ProgressTier {
  if (percent >= 50) return "green";
  if (percent >= 25) return "amber";
  return "red";
}

/** Tiempo que falta para cumplir las horas; null si no hay horas requeridas. */
export function remainingMs(workedMs: number, horasRequeridas: number): number | null {
  const goal = goalMs(horasRequeridas);
  if (goal <= 0) return null;
  return Math.max(0, goal - workedMs);
}

/**
 * Estado del practicante en el reporte. El orden importa: quien ya cumplió
 * sus horas figura como Completado aunque coordinación lo haya inactivado al
 * cerrar la práctica; Inactivo queda para quien dejó la práctica sin cumplirlas.
 */
export function estadoReporte(input: {
  activo: boolean;
  workedMs: number;
  horasRequeridas: number;
}): EstadoReporte {
  const goal = goalMs(input.horasRequeridas);
  if (goal > 0 && input.workedMs >= goal) return "completado";
  if (!input.activo) return "inactivo";
  if (goal > 0 && input.workedMs >= goal * NEAR_COMPLETION_RATIO) return "por-finalizar";
  return "en-curso";
}

/**
 * Milisegundos → horas con `decimals` decimales, truncando: 59 min son 0,9 h,
 * nunca 1,0 h (misma regla que `formatDuration`: no se muestra tiempo no cumplido).
 */
export function msToHours(ms: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.floor((Math.max(0, ms) * factor) / HOUR_MS) / factor;
}
