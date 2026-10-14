const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MESES_CORTOS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const DIAS_CORTOS = ["dom","lun","mar","mié","jue","vie","sáb"];
const pad = (n: number) => String(n).padStart(2, "0");

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function formatDayLong(date: Date): string {
  const dia = DIAS[date.getDay()]!;
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${date.getDate()} de ${MESES[date.getMonth()]}`;
}
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} de ${MESES[date.getMonth()]}`;
}
export function formatDayShort(date: Date): string {
  return `${DIAS_CORTOS[date.getDay()]} ${date.getDate()} ${MESES_CORTOS[date.getMonth()]}`;
}
export function formatSince(date: Date, now: Date): string {
  if (isSameDay(date, now)) return `hoy ${formatTime(date)}`;
  return `${date.getDate()} ${MESES_CORTOS[date.getMonth()]}`;
}
export function toDayParam(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function parseDayParam(value: string | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : null;
}
export function semester(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() < 6 ? 1 : 2}`;
}
export function dateOnlyToLocal(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}