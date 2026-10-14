import { NextResponse } from "next/server";
import { toAsistenciaExportRows } from "@/lib/reportes/asistenciaExport";
import { parseAsistenciaFilters, resolveDay } from "@/lib/reportes/asistenciaFilters";
import { isSameDay, toDayParam } from "@/lib/reportes/dates";
import { auth } from "@/lib/server/auth";
import { buildWorkbook } from "@/lib/server/excel";
import { listAsistenciaForExport } from "@/lib/server/reporteService";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const now = new Date();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseAsistenciaFilters(params, now);
  const day = resolveDay(filters, now);

  const rows = await listAsistenciaForExport(filters, now);
  const file = buildWorkbook(toAsistenciaExportRows(rows, isSameDay(day, now)), "Asistencia");

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="asistencia-${toDayParam(day)}.xlsx"`,
    },
  });
}