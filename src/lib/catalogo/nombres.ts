/**
 * Nombres de instituciones y sedes (maqueta 4f). Se comparan sin tildes,
 * mayúsculas ni espacios sobrantes, como los escribe la coordinadora en Excel.
 * Módulo puro: lo usan la validación, la importación y el formulario.
 */

export const MAX_NOMBRE = 150;

/** Recorta y junta espacios repetidos; lo que no es texto queda vacío. */
export function cleanText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

export function normalizeNombre(raw: string): string {
  return cleanText(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface CatalogEntry {
  id: number;
  nombre: string;
  activa: boolean;
}

/**
 * Nombre normalizado → entrada, para resolver las celdas del Excel. Si dos
 * entradas solo difieren en tildes o espacios (p. ej. una duplicada que se
 * inactivó), gana la activa.
 */
export function buildCatalogIndex<T extends CatalogEntry>(items: readonly T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    const key = normalizeNombre(item.nombre);
    const previa = index.get(key);
    if (!previa || (!previa.activa && item.activa)) index.set(key, item);
  }
  return index;
}

/**
 * Lo que ofrece un desplegable: las activas, más la que el usuario ya tiene
 * aunque se haya inactivado, para que no se pierda en silencio al editar.
 */
export function opcionesVisibles<T extends CatalogEntry>(items: readonly T[], actualId: number | null): T[] {
  return items.filter((item) => item.activa || item.id === actualId);
}

export function etiquetaOpcion(item: CatalogEntry): string {
  return item.activa ? item.nombre : `${item.nombre} (inactiva)`;
}
