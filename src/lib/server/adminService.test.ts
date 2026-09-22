import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const create = vi.fn();
const update = vi.fn();
const count = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    admin: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
      count: (...args: unknown[]) => count(...args),
    },
  },
}));

import { createAdmin, listAdmins, resetAdminPassword, setAdminActivo } from "./adminService";

const FAKE_ADMIN = {
  id: "admin-1",
  email: "admin@example.com",
  nombre: "Admin de Prueba",
  passwordHash: "hash-irrelevante-aqui",
  activo: true,
  creadoEn: new Date("2026-01-01"),
};

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
  create.mockReset();
  update.mockReset();
  count.mockReset();
});

describe("listAdmins", () => {
  it("devuelve los admins sin el passwordHash", async () => {
    findMany.mockResolvedValue([FAKE_ADMIN]);

    const result = await listAdmins();

    expect(result).toEqual([
      { id: "admin-1", email: "admin@example.com", nombre: "Admin de Prueba", activo: true, creadoEn: FAKE_ADMIN.creadoEn },
    ]);
  });
});

describe("createAdmin", () => {
  it("crea el admin cuando los datos son válidos", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ ...FAKE_ADMIN, id: "admin-2", email: "nuevo@example.com" });

    const result = await createAdmin({ email: "nuevo@example.com", nombre: "Nuevo", password: "Sup3r$ecreta" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: { email: "nuevo@example.com", nombre: "Nuevo", passwordHash: expect.any(String) },
    });
  });

  it("rechaza un correo duplicado con 409", async () => {
    findUnique.mockResolvedValue(FAKE_ADMIN);

    const result = await createAdmin({ email: "admin@example.com", nombre: "Otro", password: "Sup3r$ecreta" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña demasiado corta con 400", async () => {
    const result = await createAdmin({ email: "nuevo@example.com", nombre: "Nuevo", password: "corta" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rechaza un nombre vacío con 400", async () => {
    const result = await createAdmin({ email: "nuevo@example.com", nombre: "  ", password: "Sup3r$ecreta" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});

describe("setAdminActivo", () => {
  it("inactiva a otro admin cuando quedan más admins activos", async () => {
    findUnique.mockResolvedValue({ ...FAKE_ADMIN, id: "admin-2" });
    count.mockResolvedValue(2);
    update.mockResolvedValue({ ...FAKE_ADMIN, id: "admin-2", activo: false });

    const result = await setAdminActivo({ currentAdminId: "admin-1", targetAdminId: "admin-2", activo: false });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("rechaza que un admin se inactive a sí mismo", async () => {
    findUnique.mockResolvedValue(FAKE_ADMIN);

    const result = await setAdminActivo({ currentAdminId: "admin-1", targetAdminId: "admin-1", activo: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("rechaza inactivar al último admin activo", async () => {
    findUnique.mockResolvedValue({ ...FAKE_ADMIN, id: "admin-2" });
    count.mockResolvedValue(1);

    const result = await setAdminActivo({ currentAdminId: "admin-1", targetAdminId: "admin-2", activo: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("permite reactivar sin chequear las salvaguardas de inactivación", async () => {
    findUnique.mockResolvedValue({ ...FAKE_ADMIN, id: "admin-2", activo: false });
    update.mockResolvedValue({ ...FAKE_ADMIN, id: "admin-2", activo: true });

    const result = await setAdminActivo({ currentAdminId: "admin-1", targetAdminId: "admin-2", activo: true });

    expect(result.ok).toBe(true);
    expect(count).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el admin objetivo no existe", async () => {
    findUnique.mockResolvedValue(null);

    const result = await setAdminActivo({ currentAdminId: "admin-1", targetAdminId: "no-existe", activo: false });

    expect(result.status).toBe(404);
  });
});

describe("resetAdminPassword", () => {
  it("actualiza el passwordHash con una contraseña válida", async () => {
    findUnique.mockResolvedValue(FAKE_ADMIN);
    update.mockResolvedValue(FAKE_ADMIN);

    const result = await resetAdminPassword({ targetAdminId: "admin-1", password: "OtraSup3r$ecreta" });

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: { passwordHash: expect.any(String) },
    });
  });

  it("rechaza una contraseña demasiado corta con 400", async () => {
    const result = await resetAdminPassword({ targetAdminId: "admin-1", password: "corta" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el admin objetivo no existe", async () => {
    findUnique.mockResolvedValue(null);

    const result = await resetAdminPassword({ targetAdminId: "no-existe", password: "OtraSup3r$ecreta" });

    expect(result.status).toBe(404);
  });
});
