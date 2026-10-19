import { describe, expect, it } from "vitest";
import { AVISO_CAMPOS, AVISO_GENERICO, avisoDe } from "./avisos";

describe("avisoDe", () => {
  it("devuelve éxito con el texto dado", () => {
    expect(avisoDe({ ok: true }, "Sede guardada")).toEqual({ tipo: "exito", texto: "Sede guardada" });
  });

  it("con errores de campo manda a revisar los campos, aunque venga mensaje", () => {
    expect(avisoDe({ ok: false, errors: { nombre: "x" }, message: "y" }, "ok")).toEqual({
      tipo: "error",
      texto: AVISO_CAMPOS,
    });
  });

  it("usa el mensaje cuando no hay errores de campo", () => {
    const texto = "Tu sesión terminó. Vuelve a entrar.";
    expect(avisoDe({ ok: false, message: texto }, "ok")).toEqual({ tipo: "error", texto });
  });

  it("sin nada usa el texto genérico", () => {
    expect(avisoDe({ ok: false, errors: {} }, "m")).toEqual({ tipo: "error", texto: AVISO_GENERICO });
    expect(avisoDe({ ok: false }, "m")).toEqual({ tipo: "error", texto: AVISO_GENERICO });
  });

  it("ignora errores de campo con valor vacío", () => {
    expect(avisoDe({ ok: false, errors: { a: undefined } }, "m").texto).toBe(AVISO_GENERICO);
  });
});
