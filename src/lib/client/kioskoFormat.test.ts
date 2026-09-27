import { describe, expect, it } from "vitest";
import { firstName, formatClock, formatDuration, formatLongDate } from "./kioskoFormat";

describe("formatClock", () => {
  it("separa la hora en 12 h de su periodo, como en la maqueta 1c", () => {
    expect(formatClock(new Date(2026, 8, 14, 7, 58))).toEqual({ time: "07:58", period: "a. m." });
    expect(formatClock(new Date(2026, 8, 14, 17, 4))).toEqual({ time: "05:04", period: "p. m." });
  });
});

describe("formatLongDate", () => {
  it("devuelve el día en versalitas sin la coma de Intl", () => {
    expect(formatLongDate(new Date(2026, 8, 14))).toBe("LUNES 14 DE SEPTIEMBRE");
  });
});

describe("formatDuration", () => {
  const minutes = (n: number) => n * 60 * 1000;

  it("muestra horas y minutos", () => {
    expect(formatDuration(minutes(8 * 60 + 12))).toBe("8 h 12 m");
  });

  it("omite las horas cuando no llega a una", () => {
    expect(formatDuration(minutes(45))).toBe("45 m");
  });

  it("omite los minutos en horas exactas", () => {
    expect(formatDuration(minutes(126 * 60))).toBe("126 h");
  });

  it("trunca los segundos en vez de redondear hacia arriba", () => {
    expect(formatDuration(minutes(59) + 59_000)).toBe("59 m");
  });

  it("muestra 0 m para una duración vacía o negativa", () => {
    expect(formatDuration(0)).toBe("0 m");
    expect(formatDuration(-5000)).toBe("0 m");
  });
});

describe("firstName", () => {
  it("toma el primer nombre para el saludo", () => {
    expect(firstName("Laura Catalina Rodríguez")).toBe("Laura");
    expect(firstName("  Andrés  ")).toBe("Andrés");
  });
});
