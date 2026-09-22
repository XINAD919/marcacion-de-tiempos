import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();

vi.mock("./prisma", () => ({
  prisma: { admin: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { authenticateAdmin } from "./adminCredentials";
import { hashPassword } from "./passwords";

describe("authenticateAdmin", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("devuelve el admin cuando el correo y la contraseña son correctos", async () => {
    const passwordHash = await hashPassword("Sup3r$ecreta");
    findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      nombre: "Admin de Prueba",
      passwordHash,
      activo: true,
    });

    const result = await authenticateAdmin("admin@example.com", "Sup3r$ecreta");

    expect(result).toEqual({ id: "admin-1", email: "admin@example.com", name: "Admin de Prueba" });
  });

  it("devuelve null cuando la contraseña es incorrecta", async () => {
    const passwordHash = await hashPassword("Sup3r$ecreta");
    findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      nombre: "Admin de Prueba",
      passwordHash,
      activo: true,
    });

    const result = await authenticateAdmin("admin@example.com", "otra-cosa");

    expect(result).toBeNull();
  });

  it("devuelve null cuando la cuenta está inactiva", async () => {
    const passwordHash = await hashPassword("Sup3r$ecreta");
    findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      nombre: "Admin de Prueba",
      passwordHash,
      activo: false,
    });

    const result = await authenticateAdmin("admin@example.com", "Sup3r$ecreta");

    expect(result).toBeNull();
  });

  it("devuelve null cuando el correo no existe", async () => {
    findUnique.mockResolvedValue(null);

    const result = await authenticateAdmin("nadie@example.com", "cualquier-cosa");

    expect(result).toBeNull();
  });

  it("devuelve null cuando las credenciales no son strings (payload inesperado)", async () => {
    const result = await authenticateAdmin(undefined, undefined);

    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
