import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const count = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    admin: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      count: (...args: unknown[]) => count(...args),
    },
  },
}));

const auth = vi.fn();
vi.mock("@/lib/server/auth", () => ({ auth: () => auth() }));

import { PATCH } from "./route";

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/administradores/admin-2", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(adminId: string) {
  return { params: Promise.resolve({ adminId }) };
}

const FAKE_TARGET = {
  id: "admin-2",
  email: "target@example.com",
  nombre: "Target",
  passwordHash: "hash-irrelevante",
  activo: true,
  creadoEn: new Date("2026-01-01"),
};

beforeEach(() => {
  auth.mockReset();
  findUnique.mockReset();
  update.mockReset();
  count.mockReset();
});

describe("PATCH /api/administradores/[adminId]", () => {
  it("responde 401 sin sesión", async () => {
    auth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ activo: false }), params("admin-2"));

    expect(response.status).toBe(401);
  });

  it("inactiva a otro admin", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1" } });
    findUnique.mockResolvedValue(FAKE_TARGET);
    count.mockResolvedValue(2);
    update.mockResolvedValue({ ...FAKE_TARGET, activo: false });

    const response = await PATCH(patchRequest({ activo: false }), params("admin-2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activo).toBe(false);
  });

  it("rechaza que un admin se inactive a sí mismo", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1" } });
    findUnique.mockResolvedValue({ ...FAKE_TARGET, id: "admin-1" });

    const response = await PATCH(patchRequest({ activo: false }), params("admin-1"));

    expect(response.status).toBe(403);
  });

  it("restablece la contraseña con datos válidos", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1" } });
    findUnique.mockResolvedValue(FAKE_TARGET);
    update.mockResolvedValue(FAKE_TARGET);

    const response = await PATCH(patchRequest({ password: "OtraSup3r$ecreta" }), params("admin-2"));

    expect(response.status).toBe(200);
  });

  it("responde 400 cuando el cuerpo no trae activo ni password", async () => {
    auth.mockResolvedValue({ user: { id: "admin-1" } });

    const response = await PATCH(patchRequest({}), params("admin-2"));

    expect(response.status).toBe(400);
  });
});
