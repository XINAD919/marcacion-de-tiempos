import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secretBox";

const original = process.env.AUTH_SECRET;

afterEach(() => {
  process.env.AUTH_SECRET = original;
});

describe("secretBox", () => {
  it("cifra y descifra sin dejar el texto plano a la vista", () => {
    process.env.AUTH_SECRET = "secreto-de-prueba";
    const sealed = encryptSecret("contraseña SMTP", "smtp");
    expect(sealed).not.toContain("contraseña");
    expect(decryptSecret(sealed, "smtp")).toBe("contraseña SMTP");
  });

  it("devuelve null con otro AUTH_SECRET, otro propósito o texto alterado", () => {
    process.env.AUTH_SECRET = "secreto-de-prueba";
    const sealed = encryptSecret("x", "smtp");
    expect(decryptSecret(sealed, "otro")).toBeNull();
    expect(decryptSecret(`${sealed.slice(0, -2)}AA`, "smtp")).toBeNull();
    process.env.AUTH_SECRET = "otro-secreto";
    expect(decryptSecret(sealed, "smtp")).toBeNull();
  });
});
