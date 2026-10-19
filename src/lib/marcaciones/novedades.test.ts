import { describe, expect, it } from "vitest";
import { horaFinEfectiva, novedadesDe, NOVEDAD_LABEL } from "./novedades";

const at = (hhmm: string, day = "2026-10-17") => new Date(`${day}T${hhmm}:00`);
const ctx = { primeraEntradaDelDia: true, horaInicio: "07:00", horaFin: "13:00" as string | null, toleranciaMin: 10 };

describe("novedadesDe", () => {
  it("salida del kiosko antes de la hora fin es salida temprana", () => {
    expect(novedadesDe({ tipo: "OUT", metodo: "face", marcadoEn: at("11:00") }, ctx)).toEqual([
      { tipo: "salida-temprana" },
    ]);
  });
  it("salida manual a tiempo es manual", () => {
    expect(novedadesDe({ tipo: "OUT", metodo: "manual", marcadoEn: at("13:30") }, ctx)).toEqual([{ tipo: "manual" }]);
  });
  it("salida manual temprana solo marca salida temprana", () => {
    expect(novedadesDe({ tipo: "OUT", metodo: "manual", marcadoEn: at("11:00") }, ctx)).toEqual([
      { tipo: "salida-temprana" },
    ]);
  });
  it("entrada por QR tarde suma tarde y qr", () => {
    expect(novedadesDe({ tipo: "IN", metodo: "qr", marcadoEn: at("07:22") }, ctx)).toEqual([
      { tipo: "tarde", minutos: 22 },
      { tipo: "qr" },
    ]);
  });
  it("la tolerancia no marca tarde", () => {
    expect(novedadesDe({ tipo: "IN", metodo: "face", marcadoEn: at("07:08") }, ctx)).toEqual([]);
  });
  it("solo la primera entrada del día puede ser tarde", () => {
    expect(
      novedadesDe({ tipo: "IN", metodo: "face", marcadoEn: at("14:00") }, { ...ctx, primeraEntradaDelDia: false })
    ).toEqual([]);
  });
  it("sin hora fin no hay salida temprana", () => {
    expect(novedadesDe({ tipo: "OUT", metodo: "face", marcadoEn: at("11:00") }, { ...ctx, horaFin: null })).toEqual([]);
  });
});

describe("horaFinEfectiva", () => {
  it("usa la del usuario y si no, la de la sede", () => {
    expect(horaFinEfectiva({ horaFin: "12:00", sede: { horaCierre: "17:00" } })).toBe("12:00");
    expect(horaFinEfectiva({ horaFin: null, sede: { horaCierre: "17:00" } })).toBe("17:00");
    expect(horaFinEfectiva({ horaFin: null, sede: null })).toBeNull();
  });
});

describe("NOVEDAD_LABEL", () => {
  it("tiene etiqueta en español para cada tipo", () => {
    expect(Object.keys(NOVEDAD_LABEL).sort()).toEqual(["manual", "qr", "salida-temprana", "tarde"]);
  });
});
