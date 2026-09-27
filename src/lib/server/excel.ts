import * as XLSX from "xlsx";
import type { RawRow } from "@/lib/usuarios/importRows";

/**
 * Primera hoja del libro como filas {encabezado: valor}.
 *
 * - `raw: true` al leer: en CSV no adivina fechas ("01/08/2026" se quedaría
 *   como 8 de enero con la convención de EE. UU.); llegan como texto.
 * - Sin `cellDates`: en .xlsx las fechas y horas llegan como seriales y
 *   fracciones de día de Excel, que classifyImportRows convierte sin
 *   depender de la zona horaria del servidor.
 */
export function readSheetRows(data: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(data, { type: "array", raw: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet]!, { defval: "", raw: true });
}

/** Libro .xlsx con una hoja a partir de filas {encabezado: valor}. */
export function buildWorkbook(rows: Record<string, unknown>[], sheetName: string): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Encabezados de la plantilla de importación, en el orden en que se descargan. */
export const TEMPLATE_HEADERS = [
  "Nombre",
  "Cédula",
  "Correo",
  "Universidad / Colegio",
  "Entidad",
  "Horas requeridas",
  "Fecha de inicio",
  "Hora de inicio",
  "Hora de fin",
] as const;
