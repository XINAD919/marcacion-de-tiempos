import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { TEMPLATE_HEADERS, buildWorkbook } from "@/lib/server/excel";

type Row = Record<(typeof TEMPLATE_HEADERS)[number], string | number>;

// Filas de ejemplo para que se entienda el formato de cada columna: un
// practicante y un voluntario natural, que solo lleva horario.
const EXAMPLE: Row = {
  Nombre: "Laura Catalina Rodríguez",
  "Cédula": "1019442881",
  Correo: "laura@unal.edu.co",
  Tipo: "Universidad",
  "Universidad / Colegio": "Universidad Nacional",
  Entidad: "Sede Centro",
  "Horas requeridas": 240,
  "Fecha de inicio": "01/08/2026",
  "Hora de inicio": "08:00",
  "Hora de fin": "12:00",
};

const EXAMPLE_NATURAL: Row = {
  Nombre: "Marta Lucía Gómez",
  "Cédula": "52123456",
  Correo: "",
  Tipo: "Natural",
  "Universidad / Colegio": "",
  Entidad: "",
  "Horas requeridas": "",
  "Fecha de inicio": "",
  "Hora de inicio": "09:00",
  "Hora de fin": "13:00",
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const file = buildWorkbook([EXAMPLE, EXAMPLE_NATURAL], "Practicantes");
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-practicantes.xlsx"',
    },
  });
}
