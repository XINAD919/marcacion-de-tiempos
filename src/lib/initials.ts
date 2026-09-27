/** "Marcela Cárdenas" → "MC". Para avatares de administradores y practicantes. */
export function initials(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
