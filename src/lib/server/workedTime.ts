export interface AttendanceMark {
  tipo: string;
  marcadoEn: Date;
}

export interface WorkedTimeOptions {
  /**
   * Tope de tiempo que suma un día ("Jornada máxima por día", maqueta 4g).
   * Evita sumar horas de más por una salida marcada al día siguiente.
   */
  maxDailyMs?: number;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Tiempo trabajado en milisegundos a partir de pares ENTRADA → SALIDA.
 *
 * Las horas nunca se guardan: siempre se derivan de `attendance_logs`
 * (AGENTS.md › Modelo de datos). Una entrada sin salida no cuenta — puede ser
 * la jornada en curso o una salida olvidada que la coordinadora corregirá.
 * Cada tramo cuenta para el día de su entrada.
 */
export function sumWorkedMs(marks: AttendanceMark[], options: WorkedTimeOptions = {}): number {
  const sorted = [...marks].sort((a, b) => a.marcadoEn.getTime() - b.marcadoEn.getTime());

  const byDay = new Map<string, number>();
  let openSince: Date | null = null;

  for (const mark of sorted) {
    if (mark.tipo === "IN") {
      openSince = mark.marcadoEn;
    } else if (mark.tipo === "OUT" && openSince) {
      const key = dayKey(openSince);
      byDay.set(key, (byDay.get(key) ?? 0) + mark.marcadoEn.getTime() - openSince.getTime());
      openSince = null;
    }
  }

  const cap = options.maxDailyMs ?? Infinity;
  let total = 0;
  for (const dayMs of byDay.values()) total += Math.min(dayMs, cap);
  return total;
}
