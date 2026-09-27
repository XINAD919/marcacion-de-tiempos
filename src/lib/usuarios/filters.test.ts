import { describe, expect, it } from "vitest";
import { hrefWith, parseUsuarioFilters } from "./filters";

describe("parseUsuarioFilters", () => {
  it("lee los filtros de la URL e ignora valores desconocidos", () => {
    expect(
      parseUsuarioFilters({ q: " laura ", estado: "sin-rostro", entidad: "Sede Centro", page: "3" })
    ).toEqual({ q: "laura", estado: "sin-rostro", entidad: "Sede Centro", universidad: undefined, page: 3 });

    expect(parseUsuarioFilters({ estado: "borrado", page: "-2" })).toEqual({
      q: undefined,
      estado: undefined,
      entidad: undefined,
      universidad: undefined,
      page: 1,
    });
  });

  it("si un parámetro viene repetido toma el primero", () => {
    expect(parseUsuarioFilters({ q: ["ana", "beto"] }).q).toBe("ana");
  });
});

describe("hrefWith", () => {
  it("cambiar un filtro vuelve a la primera página", () => {
    expect(hrefWith({ q: "ana", page: 3 }, { estado: "activo" })).toBe("/admin/usuarios?q=ana&estado=activo");
  });

  it("quitar un filtro lo saca de la URL", () => {
    expect(hrefWith({ q: "ana", estado: "activo" }, { estado: undefined })).toBe("/admin/usuarios?q=ana");
  });

  it("la página 1 no se escribe en la URL", () => {
    expect(hrefWith({ q: "ana" }, { page: 1 })).toBe("/admin/usuarios?q=ana");
    expect(hrefWith({ q: "ana" }, { page: 2 })).toBe("/admin/usuarios?q=ana&page=2");
    expect(hrefWith({}, {})).toBe("/admin/usuarios");
  });
});
