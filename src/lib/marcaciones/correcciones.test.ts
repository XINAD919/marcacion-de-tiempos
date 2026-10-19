import { describe, expect, it } from "vitest";
import { horaEnDia, horaSugerida, MENSAJE, parseMotivo } from "./correcciones";

const dia = new Date("2026-10-17T00:00:00");

describe("parseMotivo", () => {
  it("rechaza motivos cortos tras recortar", () => {
    expect(parseMotivo("  ab ")).toEqual({ ok: false, error: MENSAJE.motivoCorto });
    expect(parseMotivo(null)).toEqual({ ok: false, error: MENSAJE.motivoCorto });
  });
  it("rechaza más de 300 caracteres", () => {
    expect(parseMotivo("a".repeat(301))).toEqual({ ok: false, error: MENSAJE.motivoLargo });
    expect(parseMotivo("a".repeat(300)).ok).toBe(true);
  });
  it("recorta espacios", () => {
    expect(parseMotivo(" Cita médica ")).toEqual({ ok: true, value: "Cita médica" });
  });
});

describe("horaEnDia", () => {
  it("devuelve la hora en el día local dado", () => {
    expect(horaEnDia(dia, "13:05")).toEqual(new Date("2026-10-17T13:05:00"));
  });
  it("devuelve null con formatos inválidos", () => {
    for (const v of ["", "25:00", "7", null, undefined, 1305, "13:60"]) expect(horaEnDia(dia, v)).toBeNull();
  });
});

describe("horaSugerida", () => {
  it("prefiere la hora fin del practicante, luego el cierre de la sede", () => {
    expect(horaSugerida(dia, "13:00", "17:00")).toBe("13:00");
    expect(horaSugerida(dia, null, "17:00")).toBe("17:00");
    expect(horaSugerida(dia, null, null)).toBeNull();
  });
});
