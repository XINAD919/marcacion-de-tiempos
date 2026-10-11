import { describe, expect, it } from "vitest";
import { describeAfiliacion, isTipoUsuario, parseTipoUsuario, tieneMetaDeHoras } from "./tipoUsuario";

describe("isTipoUsuario", () => {
  it("acepta solo los tres tipos", () => {
    expect(isTipoUsuario("universidad")).toBe(true);
    expect(isTipoUsuario("colegio")).toBe(true);
    expect(isTipoUsuario("natural")).toBe(true);
    expect(isTipoUsuario("Natural")).toBe(false);
    expect(isTipoUsuario("")).toBe(false);
    expect(isTipoUsuario(undefined)).toBe(false);
  });
});

describe("tieneMetaDeHoras", () => {
  it("solo los voluntarios naturales no tienen meta", () => {
    expect(tieneMetaDeHoras("universidad")).toBe(true);
    expect(tieneMetaDeHoras("colegio")).toBe(true);
    expect(tieneMetaDeHoras("natural")).toBe(false);
  });
});

describe("parseTipoUsuario", () => {
  it("entiende cómo lo escribe la coordinadora en Excel", () => {
    expect(parseTipoUsuario("Universidad")).toBe("universidad");
    expect(parseTipoUsuario(" UNIVERSITARIO ")).toBe("universidad");
    expect(parseTipoUsuario("colegio")).toBe("colegio");
    expect(parseTipoUsuario("Natural")).toBe("natural");
    expect(parseTipoUsuario("Voluntario")).toBe("natural");
    expect(parseTipoUsuario("voluntario natural")).toBe("natural");
  });

  it("devuelve null si no lo reconoce", () => {
    expect(parseTipoUsuario("empresa")).toBeNull();
    expect(parseTipoUsuario("")).toBeNull();
  });
});

describe("describeAfiliacion", () => {
  it("une institución y sede", () => {
    expect(
      describeAfiliacion({
        tipo: "universidad",
        institucion: { nombre: "Universidad Nacional" },
        sede: { nombre: "Sede Centro" },
      })
    ).toBe("Universidad Nacional · Sede Centro");
  });

  it("para un voluntario natural dice el tipo", () => {
    expect(describeAfiliacion({ tipo: "natural", institucion: null, sede: null })).toBe("Voluntario natural");
  });

  it("omite las partes vacías", () => {
    expect(describeAfiliacion({ tipo: "colegio", institucion: { nombre: "Colegio San José" }, sede: null })).toBe(
      "Colegio San José"
    );
  });
});
