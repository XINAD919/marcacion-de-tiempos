import { describe, expect, it } from "vitest";
import { cumplimientoExportHref, cumplimientoHref, parseCumplimientoFilters } from "./filters";

describe("parseCumplimientoFilters", () => {
  it("lee los filtros de la URL y arranca en la página 1 con el riesgo por defecto", () => {
    expect(parseCumplimientoFilters({ q: " ana ", institucion: "3", sede: "7" })).toEqual({
      q: "ana",
      tipo: undefined,
      institucion: 3,
      sede: 7,
      riesgo: "50",
      page: 1,
    });
  });

  it("descarta un riesgo que no existe y acepta 0 para apagarlo", () => {
    expect(parseCumplimientoFilters({ riesgo: "33" }).riesgo).toBe("50");
    expect(parseCumplimientoFilters({ riesgo: "25" }).riesgo).toBe("25");
    expect(parseCumplimientoFilters({ riesgo: "0" }).riesgo).toBe("0");
  });

  it("descarta una página inválida", () => {
    expect(parseCumplimientoFilters({ page: "-3" }).page).toBe(1);
    expect(parseCumplimientoFilters({ page: "abc" }).page).toBe(1);
    expect(parseCumplimientoFilters({ page: "4" }).page).toBe(4);
  });

  it("toma el primer valor si el parámetro viene repetido", () => {
    expect(parseCumplimientoFilters({ sede: ["2", "5"] }).sede).toBe(2);
  });
});

describe("cumplimientoHref", () => {
  it("sin filtros apunta a la raíz del reporte", () => {
    expect(cumplimientoHref({ page: 1 }, {})).toBe("/admin/reportes/cumplimiento");
  });

  it("aplica el cambio y vuelve a la página 1", () => {
    expect(cumplimientoHref({ institucion: 3, page: 3 }, { riesgo: "25" })).toBe(
      "/admin/reportes/cumplimiento?institucion=3&riesgo=25"
    );
  });

  it("conserva la página cuando el cambio es de página", () => {
    expect(cumplimientoHref({ sede: 7, page: 1 }, { page: 2 })).toBe("/admin/reportes/cumplimiento?sede=7&page=2");
  });

  it("el riesgo por defecto no aparece en la URL", () => {
    expect(cumplimientoHref({ riesgo: "25", page: 1 }, { riesgo: "50" })).toBe("/admin/reportes/cumplimiento");
  });

  it("codifica caracteres especiales", () => {
    expect(cumplimientoHref({ page: 1 }, { q: "José & Cía" })).toBe("/admin/reportes/cumplimiento?q=Jos%C3%A9+%26+C%C3%ADa");
  });
});

describe("cumplimientoExportHref", () => {
  it("lleva los mismos filtros pero nunca la página ni el riesgo: se exporta todo", () => {
    expect(cumplimientoExportHref({ q: "ana", sede: 7, riesgo: "25", page: 5 })).toBe("/api/reportes/export?q=ana&sede=7");
  });

  it("sin filtros exporta todo el reporte", () => {
    expect(cumplimientoExportHref({ page: 1 })).toBe("/api/reportes/export");
  });
});
