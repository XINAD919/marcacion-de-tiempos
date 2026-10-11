import { describe, expect, it } from "vitest";
import { buildCatalogIndex, cleanText, etiquetaOpcion, normalizeNombre, opcionesVisibles } from "./nombres";

describe("cleanText", () => {
  it("recorta y junta espacios repetidos; lo que no es texto queda vacío", () => {
    expect(cleanText("  Sede   Centro ")).toBe("Sede Centro");
    expect(cleanText(null)).toBe("");
    expect(cleanText(42)).toBe("");
  });
});

describe("normalizeNombre", () => {
  it("ignora tildes, mayúsculas y espacios sobrantes", () => {
    expect(normalizeNombre("  Bodega   Fontibón ")).toBe("bodega fontibon");
    expect(normalizeNombre("UNIVERSIDAD NACIONAL")).toBe(normalizeNombre("universidad nacional"));
  });
});

describe("buildCatalogIndex", () => {
  it("encuentra una entrada escrita de otra forma", () => {
    const index = buildCatalogIndex([{ id: 3, nombre: "Bodega Fontibón", activa: true }]);
    expect(index.get(normalizeNombre("bodega fontibon"))?.id).toBe(3);
    expect(index.get(normalizeNombre("Bodega Kennedy"))).toBeUndefined();
  });
});

describe("opcionesVisibles", () => {
  const items = [
    { id: 1, nombre: "Sede Centro", activa: true },
    { id: 2, nombre: "Bodega Vieja", activa: false },
  ];

  it("muestra solo las activas", () => {
    expect(opcionesVisibles(items, null).map((item) => item.id)).toEqual([1]);
  });

  it("incluye la inactiva si es la que ya tiene el usuario", () => {
    expect(opcionesVisibles(items, 2).map((item) => item.id)).toEqual([1, 2]);
  });
});

describe("etiquetaOpcion", () => {
  it("rotula las inactivas", () => {
    expect(etiquetaOpcion({ id: 1, nombre: "Sede Centro", activa: true })).toBe("Sede Centro");
    expect(etiquetaOpcion({ id: 2, nombre: "Bodega Vieja", activa: false })).toBe("Bodega Vieja (inactiva)");
  });
});
