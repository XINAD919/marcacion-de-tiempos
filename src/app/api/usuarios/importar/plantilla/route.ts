import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { listCatalogo } from "@/lib/server/catalogoService";
import { TEMPLATE_HEADERS, buildWorkbook } from "@/lib/server/excel";

type Row = Record<(typeof TEMPLATE_HEADERS)[number], string | number>;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Filas de ejemplo con nombres reales del catálogo, para que se entienda que
  // deben coincidir: un practicante y un voluntario natural, que solo lleva horario.
  const { instituciones, sedes } = await listCatalogo();
  const institucion = instituciones.find((item) => item.activa)?.nombre ?? "Universidad Nacional";
  const sede = sedes.find((item) => item.activa)?.nombre ?? "Sede Centro";

  const ejemplo: Row = {
    Nombre: "Laura Catalina Rodríguez",
    "Cédula": "1019442881",
    Correo: "laura@unal.edu.co",
    Tipo: "Practicante",
    "Institución": institucion,
    Sede: sede,
    "Horas requeridas": 240,
    "Fecha de inicio": "01/08/2026",
    "Hora de inicio": "08:00",
    "Hora de fin": "12:00",
  };
  const ejemploNatural: Row = {
    Nombre: "Marta Lucía Gómez",
    "Cédula": "52123456",
    Correo: "",
    Tipo: "Natural",
    "Institución": "",
    Sede: "",
    "Horas requeridas": "",
    "Fecha de inicio": "",
    "Hora de inicio": "09:00",
    "Hora de fin": "13:00",
  };

  const file = buildWorkbook([ejemplo, ejemploNatural], "Practicantes");
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-practicantes.xlsx"',
    },
  });
}
