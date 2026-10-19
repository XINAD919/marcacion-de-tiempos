import { describe, expect, it } from "vitest";
import { esperarHasta, estimadoRestanteMs, intervaloMs } from "./ritmo";

const now = new Date("2026-10-19T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;

describe("ritmo del envío masivo", () => {
  it("el intervalo reparte la hora entre los carnets permitidos", () => {
    expect(intervaloMs(100)).toBe(36_000);
  });

  it("sin envíos previos puede enviar ya", () => {
    expect(esperarHasta({ now, ultimoEnvioLote: null, enviadosUltimaHora: 0, masAntiguoUltimaHora: null, porHora: 100 })).toBeNull();
  });

  it("espera lo que falta del intervalo desde el último envío del lote", () => {
    const hasta = esperarHasta({ now, ultimoEnvioLote: ago(10_000), enviadosUltimaHora: 1, masAntiguoUltimaHora: ago(10_000), porHora: 100 });
    expect(hasta).toEqual(new Date(now.getTime() + 26_000));
  });

  it("con el tope de la hora lleno espera a que salga el envío más antiguo", () => {
    const hasta = esperarHasta({ now, ultimoEnvioLote: ago(60 * MIN), enviadosUltimaHora: 100, masAntiguoUltimaHora: ago(59 * MIN), porHora: 100 });
    expect(hasta).toEqual(new Date(now.getTime() + MIN));
  });

  it("si el intervalo ya pasó puede enviar", () => {
    expect(esperarHasta({ now, ultimoEnvioLote: ago(40_000), enviadosUltimaHora: 3, masAntiguoUltimaHora: ago(30 * MIN), porHora: 100 })).toBeNull();
  });

  it("estima el tiempo restante según el ritmo", () => {
    expect(estimadoRestanteMs(50, 100)).toBe(1_800_000);
  });
});
