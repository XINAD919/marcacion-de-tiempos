import { describe, expect, it } from "vitest";
import { sumWorkedMs } from "./workedTime";

const HOUR = 60 * 60 * 1000;
const at = (hhmm: string, day = "2026-09-14") => new Date(`${day}T${hhmm}:00`);

describe("sumWorkedMs", () => {
  it("suma cada par ENTRADA → SALIDA", () => {
    expect(
      sumWorkedMs([
        { tipo: "IN", marcadoEn: at("08:00") },
        { tipo: "OUT", marcadoEn: at("12:00") },
        { tipo: "IN", marcadoEn: at("13:00") },
        { tipo: "OUT", marcadoEn: at("17:30") },
      ])
    ).toBe(8.5 * HOUR);
  });

  it("no depende del orden en que llegan los registros", () => {
    expect(
      sumWorkedMs([
        { tipo: "OUT", marcadoEn: at("12:00") },
        { tipo: "IN", marcadoEn: at("08:00") },
      ])
    ).toBe(4 * HOUR);
  });

  it("ignora una entrada abierta sin salida (jornada en curso u olvidada)", () => {
    expect(
      sumWorkedMs([
        { tipo: "IN", marcadoEn: at("08:00") },
        { tipo: "OUT", marcadoEn: at("10:00") },
        { tipo: "IN", marcadoEn: at("11:00") },
      ])
    ).toBe(2 * HOUR);
  });

  it("ignora una salida sin entrada previa", () => {
    expect(
      sumWorkedMs([
        { tipo: "OUT", marcadoEn: at("07:00") },
        { tipo: "IN", marcadoEn: at("08:00") },
        { tipo: "OUT", marcadoEn: at("09:00") },
      ])
    ).toBe(1 * HOUR);
  });

  it("con dos entradas seguidas cuenta desde la más reciente", () => {
    expect(
      sumWorkedMs([
        { tipo: "IN", marcadoEn: at("08:00") },
        { tipo: "IN", marcadoEn: at("09:00") },
        { tipo: "OUT", marcadoEn: at("10:00") },
      ])
    ).toBe(1 * HOUR);
  });

  it("devuelve 0 sin registros", () => {
    expect(sumWorkedMs([])).toBe(0);
  });

  describe("con jornada máxima por día", () => {
    it("no suma más del tope en un día (salida marcada al día siguiente)", () => {
      expect(
        sumWorkedMs(
          [
            { tipo: "IN", marcadoEn: at("08:00") },
            { tipo: "OUT", marcadoEn: at("07:00", "2026-09-15") },
          ],
          { maxDailyMs: 9 * HOUR }
        )
      ).toBe(9 * HOUR);
    });

    it("aplica el tope a la suma de todos los tramos del día", () => {
      expect(
        sumWorkedMs(
          [
            { tipo: "IN", marcadoEn: at("06:00") },
            { tipo: "OUT", marcadoEn: at("12:00") },
            { tipo: "IN", marcadoEn: at("13:00") },
            { tipo: "OUT", marcadoEn: at("19:00") },
          ],
          { maxDailyMs: 9 * HOUR }
        )
      ).toBe(9 * HOUR);
    });

    it("cada día tiene su propio tope", () => {
      expect(
        sumWorkedMs(
          [
            { tipo: "IN", marcadoEn: at("08:00") },
            { tipo: "OUT", marcadoEn: at("20:00") },
            { tipo: "IN", marcadoEn: at("08:00", "2026-09-15") },
            { tipo: "OUT", marcadoEn: at("12:00", "2026-09-15") },
          ],
          { maxDailyMs: 9 * HOUR }
        )
      ).toBe(13 * HOUR);
    });
  });
});
