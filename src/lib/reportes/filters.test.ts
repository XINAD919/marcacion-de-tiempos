import { describe, expect, it } from "vitest";
import { exportHref, parseReporteFilters, reporteHref } from "./filters";

describe("parseReporteFilters", () => {
  it("lee los filtros de la URL y arranca en la página 1", () => {
    expect(
      parseReporteFilters({ q: " ana ", universidad: "Universidad Nacional", estado: "por-finalizar" })
    ).toEqual({ q: "ana", universidad: "Universidad Nacional", entidad: undefined, estado: "por-finalizar", page: 1 });
  });

  it("descarta un estado que no existe", () => {
    expect(parseReporteFilters({ estado: "sin-rostro" }).estado).toBeUndefined();
  });

  it("descarta una página inválida", () => {
    expect(parseReporteFilters({ page: "-3" }).page).toBe(1);
    expect(parseReporteFilters({ page: "abc" }).page).toBe(1);
    expect(parseReporteFilters({ page: "4" }).page).toBe(4);
  });

  it("toma el primer valor si el parámetro viene repetido", () => {
    expect(parseReporteFilters({ entidad: ["Sede Norte", "Sede Sur"] }).entidad).toBe("Sede Norte");
  });
});

describe("reporteHref", () => {
  it("sin filtros apunta a la raíz del reporte", () => {
    expect(reporteHref({ page: 1 }, {})).toBe("/admin/reportes");
  });

  it("aplica el cambio y vuelve a la página 1", () => {
    expect(reporteHref({ universidad: "UN", page: 3 }, { estado: "completado" })).toBe(
      "/admin/reportes?universidad=UN&estado=completado"
    );
  });

  it("conserva la página cuando el cambio es de página", () => {
    expect(reporteHref({ estado: "completado", page: 1 }, { page: 2 })).toBe(
      "/admin/reportes?estado=completado&page=2"
    );
  });

  it("quitar un filtro lo elimina de la URL", () => {
    expect(reporteHref({ estado: "completado", page: 1 }, { estado: undefined })).toBe("/admin/reportes");
  });

  it("codifica caracteres especiales", () => {
    expect(reporteHref({ page: 1 }, { universidad: "Colegio San José & Cía" })).toBe(
      "/admin/reportes?universidad=Colegio+San+Jos%C3%A9+%26+C%C3%ADa"
    );
  });
});

describe("exportHref", () => {
  it("lleva los mismos filtros pero nunca la página: se exporta todo", () => {
    expect(exportHref({ q: "ana", estado: "por-finalizar", page: 5 })).toBe(
      "/api/reportes/export?q=ana&estado=por-finalizar"
    );
  });

  it("sin filtros exporta todo el reporte", () => {
    expect(exportHref({ page: 1 })).toBe("/api/reportes/export");
  });
});
