export interface AttendanceMark {
  tipo: string;
  marcadoEn: Date;
}

/**
 * Tiempo trabajado en milisegundos a partir de pares ENTRADA → SALIDA.
 *
 * Las horas nunca se guardan: siempre se derivan de `attendance_logs`
 * (AGENTS.md › Modelo de datos). Una entrada sin salida no cuenta — puede ser
 * la jornada en curso o una salida olvidada que la coordinadora corregirá.
 */
export function sumWorkedMs(marks: AttendanceMark[]): number {
  const sorted = [...marks].sort((a, b) => a.marcadoEn.getTime() - b.marcadoEn.getTime());

  let total = 0;
  let openSince: Date | null = null;

  for (const mark of sorted) {
    if (mark.tipo === "IN") {
      openSince = mark.marcadoEn;
    } else if (mark.tipo === "OUT" && openSince) {
      total += mark.marcadoEn.getTime() - openSince.getTime();
      openSince = null;
    }
  }

  return total;
}
