export const MENSAJE = {
  motivoCorto: "Escribe el motivo (mínimo 3 caracteres).",
  motivoLargo: "El motivo no puede pasar de 300 caracteres.",
  horaInvalida: "Escribe la hora en formato HH:mm, por ejemplo 13:00.",
  futuro: "La hora no puede ser posterior a este momento.",
  desorden: "Con esa hora quedarían dos entradas o dos salidas seguidas ese día.",
  salidaAntesDeEntrada: "La salida debe quedar después de la entrada y antes de la siguiente marcación.",
  noExiste: "Esa marcación ya no existe o fue anulada. Recarga la página.",
  reemplazada: "Esta marcación ya fue reemplazada por una corrección; corrige esa en su lugar.",
  mismoUsuario: "Elige a otro practicante: la marcación ya es de esta persona.",
  destinoInactivo: "Ese practicante está inactivo.",
  noAnulada: "Esa marcación no está anulada.",
} as const;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseMotivo(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const motivo = typeof value === "string" ? value.trim() : "";
  if (motivo.length < 3) return { ok: false, error: MENSAJE.motivoCorto };
  if (motivo.length > 300) return { ok: false, error: MENSAJE.motivoLargo };
  return { ok: true, value: motivo };
}

/** "HH:mm" en el día local de `dia`; null si el formato no es válido. */
export function horaEnDia(dia: Date, hhmm: unknown): Date | null {
  const match = typeof hhmm === "string" ? HHMM.exec(hhmm) : null;
  if (!match) return null;
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Number(match[1]), Number(match[2]));
}

/** Hora que se propone al corregir una salida: la del practicante o, si no, el cierre de su sede. */
export function horaSugerida(dia: Date, horaFin: string | null, horaCierre: string | null): string | null {
  for (const hora of [horaFin, horaCierre]) {
    if (hora && horaEnDia(dia, hora)) return hora;
  }
  return null;
}
