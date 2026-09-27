const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Fecha de hoy (según `now`) a la hora "HH:mm" dada, o null si no es válida. */
function todayAt(now: Date, hhmm: string): Date | null {
  const match = HHMM.exec(hhmm);
  if (!match) return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]));
}

/**
 * Minutos de retraso respecto a la hora de inicio, solo si superan la
 * tolerancia (regla "Tolerancia de llegada" de la maqueta 4g). Se cuentan
 * desde la hora de inicio, no desde el fin de la tolerancia: "12 min tarde".
 */
export function lateMinutes(now: Date, horaInicio: string | null, toleranciaMin: number): number | null {
  if (!horaInicio) return null;
  const start = todayAt(now, horaInicio);
  if (!start) return null;

  const minutes = Math.floor((now.getTime() - start.getTime()) / 60_000);
  return minutes > toleranciaMin ? minutes : null;
}

/**
 * Si todavía no se cumple el tiempo mínimo entre la entrada y la salida,
 * devuelve desde cuándo se puede marcar la salida; si ya se puede, null.
 */
export function earlyExitUntil(entrada: Date, now: Date, minMinutos: number): Date | null {
  const availableAt = new Date(entrada.getTime() + minMinutos * 60_000);
  return now < availableAt ? availableAt : null;
}
