import { describe, expect, it } from "vitest";
import { SmtpNotConfiguredError, clasificarMailError } from "./mailer";

describe("clasificarMailError", () => {
  it("SMTP sin configurar es global", () => {
    expect(clasificarMailError(new SmtpNotConfiguredError())).toBe("global");
  });

  it.each(["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ETLS"])("%s es global", (code) => {
    expect(clasificarMailError({ code })).toBe("global");
  });

  it("los rechazos del destinatario no frenan el lote", () => {
    expect(clasificarMailError({ code: "EENVELOPE" })).toBe("destinatario");
    expect(clasificarMailError({ responseCode: 550 })).toBe("destinatario");
  });

  it.each([421, 450, 451, 452, 454])("la respuesta %i del proveedor es global", (responseCode) => {
    expect(clasificarMailError({ code: "EENVELOPE", responseCode })).toBe("global");
  });

  it.each(["550 5.4.5 Daily sending limit exceeded", "451 4.7.0 Temporary throttle", "550 5.7.1 Rejected"])(
    "el estado mejorado de %j es global",
    (response) => {
      expect(clasificarMailError({ code: "EENVELOPE", responseCode: 550, response })).toBe("global");
    }
  );

  it("un rechazo normal del destinatario sigue siendo del destinatario", () => {
    expect(clasificarMailError({ code: "EENVELOPE", responseCode: 550, response: "550 5.1.1 User unknown" })).toBe("destinatario");
  });

  it("lo que no parece error de correo pausa el lote", () => {
    expect(clasificarMailError(new Error("x"))).toBe("global");
    expect(clasificarMailError({ name: "PrismaClientInitializationError" })).toBe("global");
    expect(clasificarMailError({ code: "P1001" })).toBe("global");
  });
});
