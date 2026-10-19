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
    expect(clasificarMailError(new Error("x"))).toBe("destinatario");
  });
});
