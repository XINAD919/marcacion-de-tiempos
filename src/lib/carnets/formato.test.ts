import { describe, expect, it } from "vitest";
import { formatoRestante, horasAproximadas } from "./formato";

describe("horasAproximadas", () => {
  it("redondea hacia arriba y nunca baja de una hora", () => {
    expect(horasAproximadas(2, 100)).toBe("una hora");
    expect(horasAproximadas(250, 100)).toBe("unas 3 horas");
    expect(horasAproximadas(2700, 100)).toBe("unas 27 horas");
  });
});

describe("formatoRestante", () => {
  it("usa minutos u horas según el tamaño", () => {
    expect(formatoRestante(0)).toBe("menos de un minuto");
    expect(formatoRestante(35 * 60_000)).toBe("35 min");
    expect(formatoRestante(120 * 60_000)).toBe("2 h");
    expect(formatoRestante(130 * 60_000)).toBe("2 h 10 min");
  });
});
