import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/server/prisma";

const auth = vi.fn();
vi.mock("@/lib/server/auth", () => ({ auth: () => auth() }));

import { POST } from "./route";

const PREFIX = "990088";

function xlsxOf(rows: Record<string, unknown>[]): Blob {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Practicantes");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function request(file: Blob, name = "practicantes.xlsx"): Request {
  const formData = new FormData();
  formData.append("archivo", file, name);
  return new Request("http://localhost/api/usuarios/importar", { method: "POST", body: formData });
}

const row = (cedula: string, overrides: Record<string, unknown> = {}) => ({
  Nombre: `Persona ${cedula}`,
  "Cédula": cedula,
  "Universidad / Colegio": "Universidad de Prueba Importación",
  Entidad: "Sede Centro",
  "Horas requeridas": 240,
  ...overrides,
});

async function cleanup() {
  await prisma.user.deleteMany({ where: { cedula: { startsWith: PREFIX } } });
}

beforeEach(async () => {
  auth.mockReset();
  auth.mockResolvedValue({ user: { id: "test-admin" } });
  await cleanup();
});

afterAll(cleanup);

describe("POST /api/usuarios/importar", () => {
  it("responde 401 sin sesión", async () => {
    auth.mockResolvedValue(null);
    const response = await POST(request(xlsxOf([row(`${PREFIX}001`)])));
    expect(response.status).toBe(401);
  });

  it("inserta las filas válidas y reporta duplicados y errores con fila y motivo", async () => {
    await prisma.user.create({
      data: { nombre: "Ya Existía", cedula: `${PREFIX}009`, universidad: "U", entidad: "E" },
    });

    const response = await POST(
      request(
        xlsxOf([
          row(`${PREFIX}001`),
          row(`${PREFIX}002`),
          row(`${PREFIX}001`),
          row(`${PREFIX}009`),
          row("9900A8"),
        ])
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      archivo: "practicantes.xlsx",
      filasLeidas: 5,
      insertados: 2,
      columnasFaltantes: [],
    });
    expect(body.duplicados).toEqual([
      { fila: 4, nombre: `Persona ${PREFIX}001`, cedula: `${PREFIX}001`, motivo: "Repetida en la fila 2" },
      { fila: 5, nombre: `Persona ${PREFIX}009`, cedula: `${PREFIX}009`, motivo: "Ya está registrada" },
    ]);
    expect(body.errores).toEqual([
      { fila: 6, nombre: "Persona 9900A8", cedula: "9900A8", motivo: "La cédula tiene letras" },
    ]);
    // Las filas con error vuelven como Excel para corregirlas y reintentar.
    expect(typeof body.filasConErrorXlsx).toBe("string");

    expect(await prisma.user.count({ where: { cedula: { in: [`${PREFIX}001`, `${PREFIX}002`] } } })).toBe(2);
  });

  it("si faltan columnas obligatorias no inserta nada y dice cuáles", async () => {
    const response = await POST(request(xlsxOf([{ Nombre: "Sin cédula", Entidad: "Sede" }])));
    const body = await response.json();

    expect(body.insertados).toBe(0);
    expect(body.columnasFaltantes).toEqual(["Cédula", "Universidad / Colegio", "Horas requeridas"]);
  });

  it("rechaza archivos que no son hojas de cálculo", async () => {
    const response = await POST(request(new Blob(["hola"], { type: "text/plain" }), "notas.txt"));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Sube un archivo de Excel (.xlsx o .xls) o CSV.");
  });
});
