import { NextResponse } from "next/server";
import { toExportRows } from "@/lib/reportes/exportRows";
import { parseCumplimientoFilters } from "@/lib/reportes/filters";
import { auth } from "@/lib/server/auth";
import { buildWorkbook } from "@/lib/server/excel";
import { listCumplimientoForExport } from "@/lib/server/reporteService";

const pad = (n: number) => String(n).padStart(2, "0");

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await listCumplimientoForExport(parseCumplimientoFilters(params));
  const file = buildWorkbook(toExportRows(rows), "Cumplimiento");

  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cumplimiento-horas-${fecha}.xlsx"`,
    },
  });
}