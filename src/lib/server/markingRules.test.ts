import { describe, expect, it } from "vitest";
import { earlyExitUntil, lateMinutes } from "./markingRules";

const at = (hhmm: string) => new Date(`2026-09-14T${hhmm}:00`);

describe("lateMinutes", () => {
  it("cuenta los minutos desde la hora de inicio cuando se pasa de la tolerancia", () => {
    expect(lateMinutes(at("08:12"), "08:00", 10)).toBe(12);
  });

  it("dentro de la tolerancia no es llegada tarde", () => {
    expect(lateMinutes(at("08:10"), "08:00", 10)).toBeNull();
    expect(lateMinutes(at("07:45"), "08:00", 10)).toBeNull();
  });

  it("con tolerancia 0 cualquier minuto después del inicio es tarde", () => {
    expect(lateMinutes(at("08:01"), "08:00", 0)).toBe(1);
  });

  it("sin horario asignado no hay llegada tarde", () => {
    expect(lateMinutes(at("11:00"), null, 10)).toBeNull();
  });

  it("ignora un horario mal formado en vez de fallar", () => {
    expect(lateMinutes(at("11:00"), "8am", 10)).toBeNull();
  });
});

describe("earlyExitUntil", () => {
  it("bloquea la salida antes del mínimo y dice desde cuándo se puede", () => {
    expect(earlyExitUntil(at("08:00"), at("08:30"), 60)).toEqual(at("09:00"));
  });

  it("permite la salida al cumplir el mínimo", () => {
    expect(earlyExitUntil(at("08:00"), at("09:00"), 60)).toBeNull();
  });

  it("con mínimo 0 nunca bloquea", () => {
    expect(earlyExitUntil(at("08:00"), at("08:00"), 0)).toBeNull();
  });
});
