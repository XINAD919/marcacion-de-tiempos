/** Textos de tiempo del envío masivo de carnets. Puro, sin Prisma. */

const MINUTO_MS = 60_000;

/** «unas 2 horas» para el diálogo: redondea hacia arriba, mínimo una hora. */
export function horasAproximadas(pendientes: number, porHora: number): string {
  const horas = Math.max(1, Math.ceil(pendientes / porHora));
  return horas === 1 ? "una hora" : `unas ${horas} horas`;
}

/** Tiempo restante en español llano: «menos de un minuto», «35 min», «2 h 10 min». */
export function formatoRestante(ms: number): string {
  const minutos = Math.ceil(ms / MINUTO_MS);
  if (minutos <= 0) return "menos de un minuto";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
