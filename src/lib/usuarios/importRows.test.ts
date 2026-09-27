import { describe, expect, it } from "vitest";
import { classifyImportRows } from "./importRows";

const header = {
  Nombre: "Laura Catalina Rodríguez",
  "Cédula": "1.019.442.881",
  Correo: "laura@unal.edu.co",
  "Universidad / Colegio": "Universidad Nacional",
  Entidad: "Sede Centro",
  "Horas requeridas": 240,
};

function without(row: Record<string, unknown>, key: string) {
  return Object.fromEntries(Object.entries(row).filter(([name]) => name !== key));
}

describe("classifyImportRows", () => {
  it("acepta filas válidas y numera como en Excel (la fila 1 es el encabezado)", () => {
    const result = classifyImportRows([header], new Set());
    expect(result.columnasFaltantes).toEqual([]);
    expect(result.validos).toHaveLength(1);
    expect(result.validos[0]).toMatchObject({ fila: 2, input: { cedula: "1019442881", horasRequeridas: 240 } });
  });

  it("reconoce encabezados con otras mayúsculas, tildes o sinónimos", () => {
    const result = classifyImportRows(
      [
        {
          "NOMBRE COMPLETO": "Andrés Mora",
          documento: 1023884112,
          "correo electrónico": "",
          colegio: "Colegio San José",
          sede: "Bodega Fontibón",
          "horas exigidas": "120",
        },
      ],
      new Set()
    );
    expect(result.validos[0]?.input).toMatchObject({
      nombre: "Andrés Mora",
      cedula: "1023884112",
      universidad: "Colegio San José",
      entidad: "Bodega Fontibón",
    });
  });

  it("une las columnas Nombres y Apellidos", () => {
    const result = classifyImportRows(
      [{ ...without(header, "Nombre"), Nombres: "Tomás", Apellidos: "Rincón" }],
      new Set()
    );
    expect(result.validos[0]?.input.nombre).toBe("Tomás Rincón");
  });

  it("separa duplicados: ya registrados y repetidos dentro del archivo", () => {
    const result = classifyImportRows(
      [header, { ...header, Nombre: "Otra persona" }, { ...header, "Cédula": "52123456" }],
      new Set(["52123456"])
    );
    expect(result.validos.map((row) => row.fila)).toEqual([2]);
    expect(result.duplicados).toEqual([
      { fila: 3, nombre: "Otra persona", cedula: "1019442881", motivo: "Repetida en la fila 2" },
      { fila: 4, nombre: "Laura Catalina Rodríguez", cedula: "52123456", motivo: "Ya está registrada" },
    ]);
  });

  it("explica cada fila con error en español llano", () => {
    const result = classifyImportRows(
      [
        { ...header, "Cédula": "" },
        { ...header, "Cédula": "1.0A4.221" },
        { ...header, "Horas requeridas": "muchas" },
      ],
      new Set()
    );
    expect(result.errores).toEqual([
      { fila: 2, nombre: "Laura Catalina Rodríguez", cedula: "", motivo: "Cédula vacía" },
      { fila: 3, nombre: "Laura Catalina Rodríguez", cedula: "1.0A4.221", motivo: "La cédula tiene letras" },
      { fila: 4, nombre: "Laura Catalina Rodríguez", cedula: "1.019.442.881", motivo: "Horas exigidas sin número" },
    ]);
  });

  it("ignora filas completamente vacías sin descontar la numeración", () => {
    const result = classifyImportRows([header, {}, { ...header, "Cédula": "52123456" }], new Set());
    expect(result.validos.map((row) => row.fila)).toEqual([2, 4]);
  });

  it("convierte fechas y horas de Excel (seriales, fracciones de día y Date)", () => {
    const result = classifyImportRows(
      [
        { ...header, "Fecha de inicio": 46235, "Hora de inicio": 1 / 3, "Hora de fin": "12:00" },
        { ...header, "Cédula": "52123456", "Fecha de inicio": "01/08/2026", "Hora de inicio": "8:00" , "Hora de fin": "12:00:00" },
        { ...header, "Cédula": "52123457", "Fecha de inicio": new Date(2026, 7, 1) },
      ],
      new Set()
    );
    expect(result.errores).toEqual([]);
    for (const row of result.validos) {
      expect(row.input.fechaInicio).toEqual(new Date(2026, 7, 1));
    }
    expect(result.validos[0]?.input).toMatchObject({ horaInicio: "08:00", horaFin: "12:00" });
    expect(result.validos[1]?.input).toMatchObject({ horaInicio: "08:00", horaFin: "12:00" });
  });

  it("si falta una columna obligatoria no procesa filas y dice cuál falta", () => {
    const result = classifyImportRows([without(header, "Cédula")], new Set());
    expect(result.columnasFaltantes).toEqual(["Cédula"]);
    expect(result.validos).toEqual([]);
  });
});
