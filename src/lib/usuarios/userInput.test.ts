import { describe, expect, it } from "vitest";
import { estimateEndDate, formatCedula, normalizeCedula, validateUsuarioInput } from "./userInput";

describe("normalizeCedula", () => {
  it("quita puntos, espacios y guiones", () => {
    expect(normalizeCedula("1.019.442.881")).toEqual({ ok: true, value: "1019442881" });
    expect(normalizeCedula(" 1019 442-881 ")).toEqual({ ok: true, value: "1019442881" });
  });

  it("explica por qué no sirve una cédula", () => {
    expect(normalizeCedula("")).toEqual({ ok: false, error: "Cédula vacía" });
    expect(normalizeCedula("1.0A4.221")).toEqual({ ok: false, error: "La cédula tiene letras" });
    expect(normalizeCedula("123")).toEqual({ ok: false, error: "La cédula es muy corta" });
  });
});

describe("formatCedula", () => {
  it("agrupa de a tres con puntos, como se escribe en Colombia", () => {
    expect(formatCedula("1019442881")).toBe("1.019.442.881");
    expect(formatCedula("52123456")).toBe("52.123.456");
  });
});

const valid = {
  nombre: "Tomás Esteban Rincón Duarte",
  cedula: "1.030.771.564",
  email: "tomas.rincon@unal.edu.co",
  universidad: "Universidad Nacional",
  entidad: "Sede Centro",
  horasRequeridas: "240",
  fechaInicio: "2026-08-01",
  horaInicio: "08:00",
  horaFin: "12:00",
  activo: "true",
};

describe("validateUsuarioInput", () => {
  it("normaliza un usuario válido", () => {
    expect(validateUsuarioInput(valid)).toEqual({
      ok: true,
      value: {
        nombre: "Tomás Esteban Rincón Duarte",
        cedula: "1030771564",
        email: "tomas.rincon@unal.edu.co",
        universidad: "Universidad Nacional",
        entidad: "Sede Centro",
        horasRequeridas: 240,
        fechaInicio: new Date(2026, 7, 1),
        horaInicio: "08:00",
        horaFin: "12:00",
        activo: true,
      },
    });
  });

  it("el correo y el horario son opcionales", () => {
    const result = validateUsuarioInput({ ...valid, email: " ", horaInicio: "", horaFin: "" });
    expect(result.ok && result.value).toMatchObject({ email: null, horaInicio: null, horaFin: null });
  });

  it("junta espacios repetidos en los textos", () => {
    const result = validateUsuarioInput({ ...valid, nombre: "  Tomás   Rincón " });
    expect(result.ok && result.value.nombre).toBe("Tomás Rincón");
  });

  it("marca cada campo obligatorio vacío", () => {
    const result = validateUsuarioInput({});
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(
      ["cedula", "entidad", "fechaInicio", "horasRequeridas", "nombre", "universidad"].sort()
    );
  });

  it("puede no exigir fecha de inicio (importación desde Excel)", () => {
    const result = validateUsuarioInput({ ...valid, fechaInicio: "" }, { requireFechaInicio: false });
    expect(result.ok && result.value.fechaInicio).toBeNull();
  });

  it("explica errores de formato en español llano", () => {
    const result = validateUsuarioInput({
      ...valid,
      email: "tomas@",
      horasRequeridas: "doscientas",
      horaInicio: "8am",
    });
    expect(!result.ok && result.errors).toEqual({
      email: "El correo no parece válido",
      horasRequeridas: "Horas exigidas sin número",
      horaInicio: "Escribe la hora como 08:00",
    });
  });

  it("exige inicio y fin juntos, y fin después de inicio", () => {
    const soloInicio = validateUsuarioInput({ ...valid, horaFin: "" });
    expect(!soloInicio.ok && soloInicio.errors.horaFin).toBe("Falta la hora de fin del horario");

    const alReves = validateUsuarioInput({ ...valid, horaInicio: "12:00", horaFin: "08:00" });
    expect(!alReves.ok && alReves.errors.horaFin).toBe("La hora de fin debe ser después del inicio");
  });

  it("rechaza fechas que no existen", () => {
    const result = validateUsuarioInput({ ...valid, fechaInicio: "2026-02-30" });
    expect(!result.ok && result.errors.fechaInicio).toBe("La fecha de inicio no es válida");
  });
});

describe("estimateEndDate", () => {
  it("cuenta días hábiles (lunes a viernes) con las horas del horario", () => {
    // 240 h / 4 h por día = 60 días hábiles desde el sábado 1 de agosto de 2026
    // → primer día hábil lunes 3 de agosto; el 60.º es el viernes 23 de octubre.
    expect(estimateEndDate(new Date(2026, 7, 1), 240, "08:00", "12:00")).toEqual(new Date(2026, 9, 23));
  });

  it("redondea hacia arriba un último día parcial", () => {
    // 10 h / 4 h = 2,5 → 3 días hábiles: lunes 3, martes 4, miércoles 5.
    expect(estimateEndDate(new Date(2026, 7, 3), 10, "08:00", "12:00")).toEqual(new Date(2026, 7, 5));
  });

  it("sin horario o sin horas no se puede estimar", () => {
    expect(estimateEndDate(new Date(2026, 7, 1), 240, null, null)).toBeNull();
    expect(estimateEndDate(new Date(2026, 7, 1), 0, "08:00", "12:00")).toBeNull();
  });
});
