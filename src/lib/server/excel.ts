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
  const workbook = isBinaryWorkbook(data)
    ? XLSX.read(data, { type: "array", raw: true })
    : XLSX.read(decodeText(data), { type: "string", raw: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet]!, { defval: "", raw: true });
}

/** .xlsx (ZIP, "PK\x03\x04") o .xls (OLE, D0 CF 11 E0); lo demás se trata como texto. */
function isBinaryWorkbook(data: ArrayBuffer): boolean {
  const head = new Uint8Array(data, 0, Math.min(4, data.byteLength));
  const zip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  const ole = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  return zip || ole;
}

/**
 * Texto de un CSV. SheetJS asume Latin-1 con bytes crudos y rompe las tildes
 * de un UTF-8 sin BOM. Se intenta UTF-8 y, si no es válido, Windows-1252:
 * lo que guarda Excel en español con "CSV (delimitado por comas)".
 */
function decodeText(data: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    text = new TextDecoder("windows-1252").decode(data);
  }
  return text.replace(/^﻿/, "");
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
