import { describe, expect, it } from "vitest";
import { interpretMarcacionResponse } from "./marcacionResult";

describe("interpretMarcacionResponse", () => {
  const entrada = {
    matched: true,
    nombre: "Laura Catalina Rodríguez",
    universidad: "Universidad Nacional",
    entidad: "Trabajo Social",
    hora: "2026-09-14T12:58:00.000Z",
    tipo: "IN",
  };

  it("reconoce una ENTRADA", () => {
    const result = interpretMarcacionResponse(200, entrada);
    expect(result).toEqual({
      kind: "entrada",
      nombre: "Laura Catalina Rodríguez",
      universidad: "Universidad Nacional",
      entidad: "Trabajo Social",
      hora: new Date("2026-09-14T12:58:00.000Z"),
      tardeMin: null,
    });
  });

  it("lleva los minutos de retraso cuando la entrada es tarde", () => {
    const result = interpretMarcacionResponse(200, { ...entrada, tardeMin: 12 });
    expect(result).toMatchObject({ kind: "entrada", tardeMin: 12 });
  });

  it("reconoce una salida anticipada que no se registró", () => {
    const result = interpretMarcacionResponse(200, {
      matched: true,
      bloqueado: "salida-anticipada",
      nombre: "Laura Catalina Rodríguez",
      entrada: "2026-09-14T12:58:00.000Z",
      disponibleDesde: "2026-09-14T13:58:00.000Z",
    });
    expect(result).toEqual({
      kind: "salida-anticipada",
      nombre: "Laura Catalina Rodríguez",
      entrada: new Date("2026-09-14T12:58:00.000Z"),
      disponibleDesde: new Date("2026-09-14T13:58:00.000Z"),
    });
  });

  it("reconoce una SALIDA con jornada y acumulado", () => {
    const result = interpretMarcacionResponse(200, {
      ...entrada,
      tipo: "OUT",
      jornadaMs: 1000,
      acumuladoMs: 5000,
    });
    expect(result).toMatchObject({ kind: "salida", jornadaMs: 1000, acumuladoMs: 5000 });
  });

  it("un rostro sin coincidencia es 'no-reconocido'", () => {
    expect(interpretMarcacionResponse(200, { matched: false })).toEqual({
      kind: "fallo",
      reason: "no-reconocido",
    });
  });

  it("toma de la respuesta los intentos antes del QR cuando vienen", () => {
    expect(interpretMarcacionResponse(200, { matched: false, intentosAntesQr: 5 })).toEqual({
      kind: "fallo",
      reason: "no-reconocido",
      intentosAntesQr: 5,
    });
  });

  it("un 422 (sin rostro o varios rostros) es 'rostro-no-legible'", () => {
    expect(interpretMarcacionResponse(422, { error: "No se detectó ningún rostro" })).toEqual({
      kind: "fallo",
      reason: "rostro-no-legible",
    });
  });

  it("cualquier otro error o respuesta inesperada es 'error'", () => {
    expect(interpretMarcacionResponse(500, { error: "boom" })).toEqual({ kind: "fallo", reason: "error" });
    expect(interpretMarcacionResponse(200, null)).toEqual({ kind: "fallo", reason: "error" });
    expect(interpretMarcacionResponse(200, { matched: true, tipo: "IN" })).toEqual({
      kind: "fallo",
      reason: "error",
    });
  });
});
