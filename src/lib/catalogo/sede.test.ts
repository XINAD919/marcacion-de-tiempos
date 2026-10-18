import { describe, expect, it } from "vitest";
import { formatHorario, validateSedeInput } from "./sede";

describe("validateSedeInput", () => {
  it("normaliza una sede válida; dirección y horario son opcionales", () => {
    expect(validateSedeInput({ nombre: " Sede  Centro ", direccion: " ", horaApertura: "", horaCierre: "" })).toEqual({
      ok: true,
      value: { nombre: "Sede Centro", direccion: null, horaApertura: null, horaCierre: null, activa: true },
    });
  });

  it("guarda dirección y horario", () => {
    const result = validateSedeInput({
      nombre: "Bodega Fontibón",
      direccion: "Av. Centenario # 98-12",
      horaApertura: "06:00",
      horaCierre: "15:00",
      activa: "false",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        nombre: "Bodega Fontibón",
        direccion: "Av. Centenario # 98-12",
        horaApertura: "06:00",
        horaCierre: "15:00",
        activa: false,
      },
    });
  });

  it("exige apertura y cierre juntos, y cierre después de apertura", () => {
    const soloApertura = validateSedeInput({ nombre: "Sede", horaApertura: "07:00" });
    expect(!soloApertura.ok && soloApertura.errors).toEqual({ horaCierre: "Falta la hora de cierre" });

    const soloCierre = validateSedeInput({ nombre: "Sede", horaCierre: "17:00" });
    expect(!soloCierre.ok && soloCierre.errors).toEqual({ horaApertura: "Falta la hora de apertura" });

    const alReves = validateSedeInput({ nombre: "Sede", horaApertura: "17:00", horaCierre: "07:00" });
    expect(!alReves.ok && alReves.errors).toEqual({ horaCierre: "La hora de cierre debe ser después de la apertura" });
  });

  it("explica formato y largo en español llano", () => {
    const result = validateSedeInput({ nombre: "", direccion: "x".repeat(201), horaApertura: "7am", horaCierre: "17:00" });
    expect(!result.ok && result.errors).toEqual({
      nombre: "Falta el nombre",
      direccion: "La dirección puede tener hasta 200 letras",
      horaApertura: "Escribe la hora como 07:00",
    });
  });
});

describe("formatHorario", () => {
  it("une apertura y cierre, o dice que no hay horario", () => {
    expect(formatHorario("07:00", "17:00")).toBe("07:00 – 17:00");
    expect(formatHorario(null, null)).toBe("Sin horario");
  });
});
