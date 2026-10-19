import { describe, expect, it } from "vitest";
import { encaja, findInconsistencias, jornadaAbiertaHoy, marcasPorDia, type Marca } from "./dias";

const at = (hhmm: string, day = "2026-10-18") => new Date(`${day}T${hhmm}:00`);
const m = (id: string, tipo: "IN" | "OUT", hhmm: string, day = "2026-10-17"): Marca => ({
  id,
  tipo,
  marcadoEn: at(hhmm, day),
});
const now = at("10:00", "2026-10-18");

describe("findInconsistencias", () => {
  it("una jornada completa no tiene inconsistencias", () => {
    expect(findInconsistencias([m("a", "IN", "07:00"), m("b", "OUT", "13:00")], now)).toEqual([]);
  });

  it("una entrada de un día anterior sin salida es sin-salida", () => {
    const r = findInconsistencias([m("a", "IN", "07:00")], now);
    expect(r).toMatchObject([{ tipo: "sin-salida", marca: { id: "a" } }]);
  });

  it("una entrada de hoy sin salida es la jornada abierta, no una inconsistencia", () => {
    const a = m("a", "IN", "07:00", "2026-10-18");
    expect(findInconsistencias([a], now)).toEqual([]);
    expect(jornadaAbiertaHoy([a], now)).toBe(a);
  });

  it("jornadaAbiertaHoy es null si la última de hoy es salida", () => {
    const marcas = [m("a", "IN", "07:00", "2026-10-18"), m("b", "OUT", "09:00", "2026-10-18")];
    expect(jornadaAbiertaHoy(marcas, now)).toBeNull();
  });

  it("dos entradas seguidas: ambas sin salida", () => {
    const r = findInconsistencias([m("a", "IN", "07:00"), m("b", "IN", "13:00")], now);
    expect(r.map((i) => [i.tipo, i.marca.id])).toEqual([
      ["sin-salida", "a"],
      ["sin-salida", "b"],
    ]);
  });

  it("una salida sola es sin-entrada, también hoy", () => {
    expect(findInconsistencias([m("a", "OUT", "13:00")], now)).toMatchObject([{ tipo: "sin-entrada" }]);
    expect(findInconsistencias([m("b", "OUT", "09:00", "2026-10-18")], now)).toMatchObject([
      { tipo: "sin-entrada", marca: { id: "b" } },
    ]);
  });

  it("ordena por día descendente", () => {
    const r = findInconsistencias([m("x", "IN", "07:00", "2026-10-14"), m("y", "IN", "07:00", "2026-10-17")], now);
    expect(r.map((i) => i.marca.id)).toEqual(["y", "x"]);
  });
});

describe("marcasPorDia", () => {
  it("agrupa por día local y ordena ascendente", () => {
    const map = marcasPorDia([m("b", "OUT", "13:00"), m("a", "IN", "07:00"), m("c", "IN", "07:00", "2026-10-18")]);
    expect([...map.keys()].sort()).toEqual(["2026-10-17", "2026-10-18"]);
    expect(map.get("2026-10-17")!.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("encaja", () => {
  const nueva = (tipo: string, hhmm: string) => ({ tipo, marcadoEn: at(hhmm, "2026-10-17") });
  it("acepta una salida después de una entrada", () => {
    expect(encaja([m("a", "IN", "07:00")], nueva("OUT", "12:00"))).toBe(true);
  });
  it("rechaza dos entradas seguidas", () => {
    expect(encaja([m("a", "IN", "07:00")], nueva("IN", "12:00"))).toBe(false);
  });
  it("rechaza una salida en un día vacío", () => {
    expect(encaja([], nueva("OUT", "09:00"))).toBe(false);
  });
  it("acepta una entrada antes de una salida", () => {
    expect(encaja([m("a", "OUT", "13:00")], nueva("IN", "07:00"))).toBe(true);
  });
  it("rechaza una salida entre una entrada y su salida", () => {
    expect(encaja([m("a", "IN", "07:00"), m("b", "OUT", "13:00")], nueva("OUT", "10:00"))).toBe(false);
  });
});
