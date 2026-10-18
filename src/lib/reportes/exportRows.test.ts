import { describe, expect, it } from "vitest";
import { toExportRows } from "./exportRows";
import type { ReporteRow } from "./rows";

const HOUR = 60 * 60 * 1000;

const row: ReporteRow = {
  id: "u1",
  nombre: "Laura Rodríguez",
  cedula: "1019442881",
  institucion: "Universidad Nacional",
  sede: "Sede Centro",
  activo: true,
  horasRequeridas: 240,
  workedMs: 126.5 * HOUR,
  remainingMs: 113.5 * HOUR,
  percent: 52,
  estado: "en-curso",
  ultimaMarcacion: { en: new Date(2026, 8, 14, 8, 2), tipo: "IN" },
};

describe("toExportRows", () => {
  it("usa encabezados en español, en el orden de la hoja", () => {
    expect(Object.keys(toExportRows([row])[0]!)).toEqual([
      "Nombre",
      "Cédula",
      "Institución",
      "Sede",
      "Horas requeridas",
      "Horas cumplidas",
      "Horas restantes",
      "Avance (%)",
      "Última marcación",
      "Estado",
    ]);
  });

  it("exporta las horas como número y la cédula como texto", () => {
    const [out] = toExportRows([row]);
    expect(out!["Horas requeridas"]).toBe(240);
    expect(out!["Horas cumplidas"]).toBe(126.5);
    expect(out!["Horas restantes"]).toBe(113.5);
    expect(out!["Avance (%)"]).toBe(52);
    expect(out!["Cédula"]).toBe("1019442881");
  });

  it("escribe la última marcación y el estado en español llano", () => {
    const [out] = toExportRows([row]);
    expect(out!["Última marcación"]).toBe("2026-09-14 08:02");
    expect(out!.Estado).toBe("En curso");
  });

  it("deja en blanco lo que no se puede calcular", () => {
    const [out] = toExportRows([{ ...row, remainingMs: null, percent: null, ultimaMarcacion: null }]);
    expect(out!["Horas restantes"]).toBe("");
    expect(out!["Avance (%)"]).toBe("");
    expect(out!["Última marcación"]).toBe("");
  });

  it("con una lista vacía no devuelve filas", () => {
    expect(toExportRows([])).toEqual([]);
  });
});
