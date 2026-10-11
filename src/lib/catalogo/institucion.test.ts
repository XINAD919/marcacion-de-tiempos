import { describe, expect, it } from "vitest";
import { type InstitucionOpcion, agruparInstituciones, isTipoInstitucion, validateInstitucionInput } from "./institucion";

describe("isTipoInstitucion", () => {
  it("acepta solo universidad, técnica y colegio", () => {
    expect(isTipoInstitucion("universidad")).toBe(true);
    expect(isTipoInstitucion("tecnica")).toBe(true);
    expect(isTipoInstitucion("colegio")).toBe(true);
    expect(isTipoInstitucion("Técnica")).toBe(false);
    expect(isTipoInstitucion(undefined)).toBe(false);
  });
});

describe("validateInstitucionInput", () => {
  const valid = { nombre: "  Universidad   Nacional ", tipo: "universidad", horasExigidas: "240" };

  it("normaliza una institución válida; activa por defecto", () => {
    expect(validateInstitucionInput(valid)).toEqual({
      ok: true,
      value: { nombre: "Universidad Nacional", tipo: "universidad", horasExigidas: 240, activa: true },
    });
  });

  it("lee el estado del formulario", () => {
    const result = validateInstitucionInput({ ...valid, activa: "false" });
    expect(result.ok && result.value.activa).toBe(false);
  });

  it("explica cada error en español llano", () => {
    expect(validateInstitucionInput({ nombre: "", tipo: "empresa", horasExigidas: "" })).toEqual({
      ok: false,
      errors: {
        nombre: "Falta el nombre",
        tipo: "Elige si es universidad, técnica o colegio",
        horasExigidas: "Faltan las horas exigidas",
      },
    });
  });

  it("las horas son un entero entre 1 y 5000", () => {
    for (const horas of ["0", "12.5", "doscientas", "5001"]) {
      const result = validateInstitucionInput({ ...valid, horasExigidas: horas });
      expect(!result.ok && result.errors.horasExigidas).toBe("Las horas deben ser un número entero entre 1 y 5000");
    }
  });

  it("limita el nombre a 150 letras", () => {
    const result = validateInstitucionInput({ ...valid, nombre: "a".repeat(151) });
    expect(!result.ok && result.errors.nombre).toBe("El nombre puede tener hasta 150 letras");
  });
});

describe("agruparInstituciones", () => {
  const items: InstitucionOpcion[] = [
    { id: 1, nombre: "Universidad Nacional", tipo: "universidad", horasExigidas: 240, activa: true },
    { id: 2, nombre: "Colegio San José", tipo: "colegio", horasExigidas: 80, activa: true },
    { id: 3, nombre: "Universidad Cerrada", tipo: "universidad", horasExigidas: 240, activa: false },
  ];

  it("agrupa por tipo en orden universidad, técnica, colegio y omite grupos vacíos", () => {
    expect(agruparInstituciones(items, null)).toEqual([
      { value: "Universidades", items: [items[0]] },
      { value: "Colegios", items: [items[1]] },
    ]);
  });

  it("incluye la inactiva que ya tiene el usuario", () => {
    expect(agruparInstituciones(items, 3)[0]?.items.map((item) => item.id)).toEqual([1, 3]);
  });
});
