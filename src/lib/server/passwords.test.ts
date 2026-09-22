import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords";

describe("hashPassword / verifyPassword", () => {
  it("verifica una contraseña contra su propio hash", async () => {
    const hash = await hashPassword("Sup3r$ecreta");

    await expect(verifyPassword("Sup3r$ecreta", hash)).resolves.toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("Sup3r$ecreta");

    await expect(verifyPassword("otra-cosa", hash)).resolves.toBe(false);
  });

  it("nunca guarda la contraseña en texto plano", async () => {
    const hash = await hashPassword("Sup3r$ecreta");

    expect(hash).not.toBe("Sup3r$ecreta");
  });
});
