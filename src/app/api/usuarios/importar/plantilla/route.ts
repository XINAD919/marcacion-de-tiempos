import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { TEMPLATE_HEADERS, buildWorkbook } from "@/lib/server/excel";

// Fila de ejemplo para que se entienda el formato de cada columna.
const EXAMPLE: Record<(typeof TEMPLATE_HEADERS)[number], string | number> = {
  Nombre: "Laura Catalina Rodríguez",
  "Cédula": "1019442881",
  Correo: "laura@unal.edu.co",
  "Universidad / Colegio": "Universidad Nacional",
  Entidad: "Sede Centro",
  "Horas requeridas": 240,
  "Fecha de inicio": "01/08/2026",
  "Hora de inicio": "08:00",
  "Hora de fin": "12:00",
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const file = buildWorkbook([EXAMPLE], "Practicantes");
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-practicantes.xlsx"',
    },
  });
}
