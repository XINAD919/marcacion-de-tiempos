import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, matchThresholdFor, parseConfigForm, reglasPara } from "./configRules";

const valid = {
  toleranciaLlegadaMin: "10",
  minHorasAntesSalida: "1.5",
  toleranciaLlegadaNaturalMin: "20",
  minHorasAntesSalidaNatural: "0,5",
  exigenciaReconocimiento: "estricto",
  intentosAntesQr: "5",
  jornadaMaximaHoras: "9",
  carnetsPorHora: "250",
};

describe("parseConfigForm", () => {
  it("convierte el formulario a reglas, con el mínimo antes de salida en minutos", () => {
    expect(parseConfigForm(valid)).toEqual({
      ok: true,
      value: {
        toleranciaLlegadaMin: 10,
        minMinutosAntesSalida: 90,
        toleranciaLlegadaNaturalMin: 20,
        minMinutosAntesSalidaNatural: 30,
        exigenciaReconocimiento: "estricto",
        intentosAntesQr: 5,
        jornadaMaximaHoras: 9,
        carnetsPorHora: 250,
      },
    });
  });

  it("acepta coma decimal en las horas", () => {
    const result = parseConfigForm({ ...valid, minHorasAntesSalida: "2,5" });
    expect(result.ok && result.value.minMinutosAntesSalida).toBe(150);
  });

  it("explica en español llano cada campo inválido", () => {
    const result = parseConfigForm({
      ...valid,
      toleranciaLlegadaMin: "-3",
      minHorasAntesSalida: "abc",
      exigenciaReconocimiento: "máximo",
      intentosAntesQr: "0",
      jornadaMaximaHoras: "30",
      carnetsPorHora: "0",
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        toleranciaLlegadaMin: "Escribe un número de minutos entre 0 y 120.",
        minHorasAntesSalida: "Escribe un número de horas entre 0 y 12.",
        exigenciaReconocimiento: "Elige Flexible, Equilibrado o Estricto.",
        intentosAntesQr: "Elige entre 1 y 10 intentos.",
        jornadaMaximaHoras: "Escribe un número de horas entre 1 y 24.",
        carnetsPorHora: "Escribe un número de carnets entre 1 y 10.000.",
      },
    });
  });

  it.each(["0", "abc", "10001", "2.5", ""])("rechaza %j como carnets por hora", (raw) => {
    const result = parseConfigForm({ ...valid, carnetsPorHora: raw });
    expect(result.ok).toBe(false);
  });

  it("no acepta minutos con decimales en la tolerancia", () => {
    const result = parseConfigForm({ ...valid, toleranciaLlegadaMin: "10.5" });
    expect(result.ok).toBe(false);
  });
});

describe("matchThresholdFor", () => {
  it("más estricto significa menor distancia aceptada", () => {
    expect(matchThresholdFor("estricto")).toBeLessThan(matchThresholdFor("equilibrado"));
    expect(matchThresholdFor("equilibrado")).toBeLessThan(matchThresholdFor("flexible"));
  });

  it("equilibrado conserva el umbral que se usaba hasta ahora (0.5)", () => {
    expect(matchThresholdFor("equilibrado")).toBe(0.5);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("usa los valores de la maqueta 4g", () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      toleranciaLlegadaMin: 10,
      exigenciaReconocimiento: "equilibrado",
      intentosAntesQr: 3,
      jornadaMaximaHoras: 9,
    });
  });
});

describe("parseConfigForm · voluntarios naturales", () => {
  it("valida sus reglas con los mismos rangos", () => {
    const result = parseConfigForm({ ...valid, toleranciaLlegadaNaturalMin: "200", minHorasAntesSalidaNatural: "x" });
    expect(!result.ok && result.errors).toEqual({
      toleranciaLlegadaNaturalMin: "Escribe un número de minutos entre 0 y 120.",
      minHorasAntesSalidaNatural: "Escribe un número de horas entre 0 y 12.",
    });
  });
});

describe("reglasPara", () => {
  const config = {
    ...DEFAULT_CONFIG,
    toleranciaLlegadaMin: 10,
    minMinutosAntesSalida: 60,
    toleranciaLlegadaNaturalMin: 25,
    minMinutosAntesSalidaNatural: 30,
  };

  it("los practicantes usan las reglas generales", () => {
    expect(reglasPara(config, "practicante")).toEqual({ toleranciaLlegadaMin: 10, minMinutosAntesSalida: 60 });
    expect(reglasPara(config, "colegio")).toEqual({ toleranciaLlegadaMin: 10, minMinutosAntesSalida: 60 });
  });

  it("los voluntarios naturales usan las suyas", () => {
    expect(reglasPara(config, "natural")).toEqual({ toleranciaLlegadaMin: 25, minMinutosAntesSalida: 30 });
  });
});
