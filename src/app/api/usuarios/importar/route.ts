import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { buildWorkbook, readSheetRows } from "@/lib/server/excel";
import { insertUsuarios, listCedulas } from "@/lib/server/usuarioService";
import { classifyImportRows } from "@/lib/usuarios/importRows";
import { normalizeCedula } from "@/lib/usuarios/userInput";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const ACCEPTED_EXTENSIONS = /\.(xlsx|xls|csv)$/i;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const startedAt = Date.now();
  const formData = await request.formData();
  const archivo = formData.get("archivo");

  if (!(archivo instanceof File) || !ACCEPTED_EXTENSIONS.test(archivo.name)) {
    return badRequest("Sube un archivo de Excel (.xlsx o .xls) o CSV.");
  }
  if (archivo.size > MAX_FILE_BYTES) {
    return badRequest("El archivo pesa más de 5 MB. Divídelo en partes más pequeñas.");
  }

  let rows;
  try {
    rows = readSheetRows(await archivo.arrayBuffer());
  } catch {
    return badRequest("No se pudo leer el archivo. Ábrelo en Excel y guárdalo de nuevo como .xlsx.");
  }
  if (rows.length > MAX_ROWS) {
    return badRequest(`El archivo tiene más de ${MAX_ROWS.toLocaleString("es-CO")} filas. Divídelo en partes.`);
  }

  // Solo se consultan en la base las cédulas que aparecen en el archivo.
  const cedulasDelArchivo = rows
    .map((row) => Object.entries(row).find(([header]) => /c[eé]dula|documento|^cc$/i.test(header.trim()))?.[1])
    .map((value) => normalizeCedula(String(value ?? "")))
    .flatMap((result) => (result.ok ? [result.value] : []));
  const existentes = await listCedulas([...new Set(cedulasDelArchivo)]);

  const result = classifyImportRows(rows, existentes);
  const insertados = result.columnasFaltantes.length > 0 ? 0 : await insertUsuarios(result.validos.map((row) => row.input));

  // Filas con error tal como venían, más el motivo, para corregir y reintentar.
  const filasConErrorXlsx =
    result.errores.length > 0
      ? buildWorkbook(
          result.errores.map((error) => ({ ...rows[error.fila - 2], Motivo: error.motivo })),
          "Para corregir"
        ).toString("base64")
      : null;

  return NextResponse.json({
    archivo: archivo.name,
    filasLeidas: rows.length,
    segundos: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
    insertados,
    duplicados: result.duplicados,
    errores: result.errores,
    columnasFaltantes: result.columnasFaltantes,
    filasConErrorXlsx,
  });
}
