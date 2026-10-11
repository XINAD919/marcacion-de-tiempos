import { describe, expect, it } from "vitest";
import { describeAfiliacion, etiquetaTipo, isTipoUsuario, parseTipoUsuario, tieneMetaDeHoras } from "./tipoUsuario";

describe("isTipoUsuario", () => {
  it("acepta solo practicante y natural", () => {
    expect(isTipoUsuario("practicante")).toBe(true);
    expect(isTipoUsuario("natural")).toBe(true);
    expect(isTipoUsuario("universidad")).toBe(false);
    expect(isTipoUsuario("")).toBe(false);
    expect(isTipoUsuario(undefined)).toBe(false);
  });
});

describe("tieneMetaDeHoras", () => {
  it("solo los voluntarios naturales no tienen meta", () => {
    expect(tieneMetaDeHoras("practicante")).toBe(true);
    expect(tieneMetaDeHoras("natural")).toBe(false);
  });
});

describe("parseTipoUsuario", () => {
  it("universidad, técnica o colegio son practicantes: el tipo concreto lo pone la institución", () => {
    for (const raw of ["Practicante", "Universidad", " UNIVERSITARIO ", "Técnica", "tecnico", "colegio"]) {
      expect(parseTipoUsuario(raw)).toBe("practicante");
    }
  });

  it("natural o voluntario", () => {
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

describe("etiquetaTipo", () => {
  it("el tipo de un practicante sale de su institución", () => {
    expect(etiquetaTipo({ tipo: "universidad", institucionTipo: "tecnica" })).toBe("Técnica");
    expect(etiquetaTipo({ tipo: "universidad", institucionTipo: null })).toBe("—");
    expect(etiquetaTipo({ tipo: "natural", institucionTipo: null })).toBe("Voluntario natural");
  });
});
