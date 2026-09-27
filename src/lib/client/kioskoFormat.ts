const LOCALE = "es-CO";

const clockFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const longDateFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "07:58" + "a. m." por separado: el kiosko los dibuja con tamaños distintos. */
export function formatClock(date: Date): { time: string; period: string } {
  const parts = clockFormat.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    time: `${value("hour")}:${value("minute")}`,
    // Intl separa "a. m." con espacios no separables; se normalizan.
    period: value("dayPeriod").replace(/\s+/g, " "),
  };
}

/** "LUNES 14 DE SEPTIEMBRE" */
export function formatLongDate(date: Date): string {
  return longDateFormat.format(date).replace(",", "").toLocaleUpperCase(LOCALE);
}

/** "8 h 12 m", "45 m", "126 h". Trunca: nunca muestra tiempo no cumplido. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} m`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} m`;
}

export function firstName(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}
