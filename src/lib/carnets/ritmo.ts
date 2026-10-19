/**
 * Ritmo del envío masivo de carnets: módulo puro, sin Prisma, para probarlo
 * con relojes inyectados.
 */

const HORA_MS = 3_600_000;

/** Tiempo mínimo entre dos envíos para no pasar de `porHora`. */
export function intervaloMs(porHora: number): number {
  return HORA_MS / porHora;
}

/**
 * Cuándo se puede enviar el siguiente: el mayor entre el intervalo desde el
 * último envío del lote y, si la hora está llena, la salida del envío más
 * antiguo de la ventana de 60 min. `null` = puede enviar ya.
 */
export function esperarHasta(i: {
  now: Date;
  ultimoEnvioLote: Date | null;
  enviadosUltimaHora: number;
  masAntiguoUltimaHora: Date | null;
  porHora: number;
}): Date | null {
  const candidatos: number[] = [];
  if (i.ultimoEnvioLote) candidatos.push(i.ultimoEnvioLote.getTime() + intervaloMs(i.porHora));
  if (i.enviadosUltimaHora >= i.porHora && i.masAntiguoUltimaHora) {
    candidatos.push(i.masAntiguoUltimaHora.getTime() + HORA_MS);
  }
  if (candidatos.length === 0) return null;
  const hasta = Math.max(...candidatos);
  return hasta <= i.now.getTime() ? null : new Date(hasta);
}

export function estimadoRestanteMs(pendientes: number, porHora: number): number {
  return pendientes * intervaloMs(porHora);
}
