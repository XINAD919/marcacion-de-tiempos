import { describe, expect, it } from "vitest";
import { parseSmtpForm } from "./smtpRules";

const valid = {
  host: "smtp.office365.com",
  puerto: "587",
  seguridad: "starttls",
  usuario: "practicas@fundacion.org",
  password: "secreta",
  remitenteNombre: "Banco de Alimentos",
  remitenteEmail: "practicas@fundacion.org",
};

describe("parseSmtpForm", () => {
  it("acepta una configuración completa", () => {
    const result = parseSmtpForm(valid, false);
    expect(result).toEqual({
      ok: true,
      value: {
        host: "smtp.office365.com",
        puerto: 587,
        seguridad: "starttls",
        usuario: "practicas@fundacion.org",
        remitenteNombre: "Banco de Alimentos",
        remitenteEmail: "practicas@fundacion.org",
      },
      password: "secreta",
    });
  });

  it("contraseña vacía con una ya guardada significa no cambiarla", () => {
    const result = parseSmtpForm({ ...valid, password: "" }, true);
    expect(result.ok && result.password).toBeNull();
  });

  it("exige contraseña si hay usuario y no hay ninguna guardada", () => {
    const result = parseSmtpForm({ ...valid, password: "" }, false);
    expect(!result.ok && result.errors.password).toBeTruthy();
  });

  it("permite relay interno sin usuario ni contraseña", () => {
    const result = parseSmtpForm({ ...valid, usuario: "", password: "", seguridad: "ninguna", puerto: "25" }, false);
    expect(result.ok && result.value.usuario).toBeNull();
  });

  it("rechaza host con protocolo y puertos fuera de rango", () => {
    const result = parseSmtpForm({ ...valid, host: "https://smtp.x.com", puerto: "70000" }, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["host", "puerto"]);
    }
  });

  it("rechaza seguridad desconocida y remitente inválido", () => {
    const result = parseSmtpForm({ ...valid, seguridad: "ssl3", remitenteEmail: "no-es-correo" }, false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["remitenteEmail", "seguridad"]);
  });
});
