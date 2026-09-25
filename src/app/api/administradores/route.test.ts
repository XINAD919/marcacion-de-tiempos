import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    admin: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

const auth = vi.fn();
vi.mock("@/lib/server/auth", () => ({ auth: () => auth() }));

import { GET, POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/administradores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  auth.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  create.mockReset();
});

describe("GET /api/administradores", () => {
  it("responde 401 sin sesión", async () => {
    auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("lista los administradores cuando hay sesión", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1" } });
    findMany.mockResolvedValue([
      { id: "admin-1", email: "a@example.com", nombre: "A", activo: true, creadoEn: new Date("2026-01-01") },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.administradores).toHaveLength(1);
  });
});

describe("POST /api/administradores", () => {
  it("responde 401 sin sesión", async () => {
    auth.mockResolvedValue(null);

    const response = await POST(jsonRequest({ email: "a@example.com", nombre: "A", password: "Sup3r$ecreta" }));

    expect(response.status).toBe(401);
  });

  it("crea un administrador con datos válidos", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1" } });
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({
      id: "admin-2",
      email: "nuevo@example.com",
      nombre: "Nuevo Admin",
      activo: true,
      creadoEn: new Date("2026-01-01"),
    });

    const response = await POST(
      jsonRequest({ email: "nuevo@example.com", nombre: "Nuevo Admin", password: "Sup3r$ecreta" })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.email).toBe("nuevo@example.com");
  });

  it("responde 409 si el correo ya existe", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1" } });
    findUnique.mockResolvedValue({ id: "admin-2" });

    const response = await POST(
      jsonRequest({ email: "existe@example.com", nombre: "Nuevo Admin", password: "Sup3r$ecreta" })
    );

    expect(response.status).toBe(409);
  });
});
