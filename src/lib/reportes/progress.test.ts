import { describe, expect, it } from "vitest";
import {
  NEAR_COMPLETION_RATIO,
  estadoReporte,
  msToHours,
  progressPercent,
  progressTier,
  remainingMs,
} from "./progress";

const HOUR = 60 * 60 * 1000;

describe("progressPercent", () => {
  it("calcula el porcentaje sobre las horas requeridas", () => {
    expect(progressPercent(126 * HOUR, 240)).toBe(52);
  });

  it("trunca: nunca muestra más avance del cumplido", () => {
    expect(progressPercent(239.9 * HOUR, 240)).toBe(99);
  });

  it("no pasa de 100 aunque haya más horas de las requeridas", () => {
    expect(progressPercent(300 * HOUR, 240)).toBe(100);
  });

  it("es null si el practicante no tiene horas requeridas", () => {
    expect(progressPercent(10 * HOUR, 0)).toBeNull();
  });
});

describe("progressTier (AGENTS.md › Progreso de horas)", () => {
  it("rojo por debajo de 25 %, ámbar de 25 a 49 %, verde desde 50 %", () => {
    expect(progressTier(0)).toBe("red");
    expect(progressTier(24)).toBe("red");
    expect(progressTier(25)).toBe("amber");
    expect(progressTier(49)).toBe("amber");
    expect(progressTier(50)).toBe("green");
    expect(progressTier(100)).toBe("green");
  });
});

describe("remainingMs", () => {
  it("devuelve lo que falta para cumplir las horas", () => {
    expect(remainingMs(100 * HOUR, 240)).toBe(140 * HOUR);
  });

  it("no baja de cero cuando ya cumplió", () => {
    expect(remainingMs(250 * HOUR, 240)).toBe(0);
  });

  it("es null sin horas requeridas", () => {
    expect(remainingMs(5 * HOUR, 0)).toBeNull();
  });
});

describe("estadoReporte", () => {
  const base = { activo: true, horasRequeridas: 100 };

  it("está en curso por debajo del umbral de próximo a finalizar", () => {
    expect(estadoReporte({ ...base, workedMs: 50 * HOUR })).toBe("en-curso");
  });

  it("es 'por finalizar' justo al llegar al umbral y mientras falten horas", () => {
    const umbral = 100 * NEAR_COMPLETION_RATIO * HOUR;
    expect(estadoReporte({ ...base, workedMs: umbral - 1 })).toBe("en-curso");
    expect(estadoReporte({ ...base, workedMs: umbral })).toBe("por-finalizar");
    expect(estadoReporte({ ...base, workedMs: 99 * HOUR })).toBe("por-finalizar");
  });

  it("es completado al cumplir todas las horas", () => {
    expect(estadoReporte({ ...base, workedMs: 100 * HOUR })).toBe("completado");
  });

  it("quien cumplió sus horas sigue Completado aunque lo hayan inactivado", () => {
    expect(estadoReporte({ activo: false, horasRequeridas: 100, workedMs: 100 * HOUR })).toBe("completado");
  });

  it("quien dejó la práctica sin cumplir sus horas figura Inactivo", () => {
    expect(estadoReporte({ activo: false, horasRequeridas: 100, workedMs: 20 * HOUR })).toBe("inactivo");
  });

  it("sin horas requeridas nunca queda Completado por error", () => {
    expect(estadoReporte({ activo: true, horasRequeridas: 0, workedMs: 0 })).toBe("en-curso");
  });
});

describe("msToHours", () => {
  it("trunca en vez de redondear: 59 min son 0,9 h", () => {
    expect(msToHours(59 * 60_000)).toBe(0.9);
  });

  it("respeta los decimales pedidos", () => {
    expect(msToHours(3.5 * HOUR, 1)).toBe(3.5);
    expect(msToHours(100 * 60_000, 2)).toBe(1.66);
  });

  it("no da error de coma flotante en medias horas exactas", () => {
    expect(msToHours(6 * 60_000)).toBe(0.1);
    expect(msToHours(36 * 60_000)).toBe(0.6);
  });

  it("nunca devuelve negativos", () => {
    expect(msToHours(-5 * HOUR)).toBe(0);
  });
});
