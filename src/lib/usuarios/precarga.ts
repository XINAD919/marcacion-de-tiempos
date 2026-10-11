/**
 * Valor que propone el catálogo al elegir institución (horas) o sede
 * (horario). Solo reemplaza un campo vacío o que todavía tiene lo último que
 * se propuso: nunca lo que la coordinadora escribió a mano (p. ej. un
 * convenio especial con otras horas).
 */
export function precargar(actual: string, propuestoAntes: string | null, propuesto: string | null): string {
  if (!propuesto) return actual;
  return actual === "" || actual === propuestoAntes ? propuesto : actual;
}
