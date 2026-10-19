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

  it("lo que no parece error de correo pausa el lote", () => {
    expect(clasificarMailError(new Error("x"))).toBe("global");
    expect(clasificarMailError({ name: "PrismaClientInitializationError" })).toBe("global");
    expect(clasificarMailError({ code: "P1001" })).toBe("global");
  });
});
