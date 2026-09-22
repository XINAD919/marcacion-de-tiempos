import { prisma } from "@/lib/server/prisma";
import { hashPassword } from "@/lib/server/passwords";

const MIN_PASSWORD_LENGTH = 8;

export type AdminDTO = {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  creadoEn: Date;
};

export type ServiceResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; body: { error: string } };

function toDTO(admin: {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  creadoEn: Date;
}): AdminDTO {
  return {
    id: admin.id,
    email: admin.email,
    nombre: admin.nombre,
    activo: admin.activo,
    creadoEn: admin.creadoEn,
  };
}

export async function listAdmins(): Promise<AdminDTO[]> {
  const admins = await prisma.admin.findMany({ orderBy: { creadoEn: "asc" } });
  return admins.map(toDTO);
}

export async function createAdmin(input: {
  email: string;
  nombre: string;
  password: string;
}): Promise<ServiceResult<AdminDTO>> {
  const email = input.email?.trim();
  const nombre = input.nombre?.trim();
  const password = input.password ?? "";

  if (!email || !nombre) {
    return { ok: false, status: 400, body: { error: "Faltan el correo o el nombre" } };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      body: { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
    };
  }

  const existente = await prisma.admin.findUnique({ where: { email } });
  if (existente) {
    return { ok: false, status: 409, body: { error: "Ya existe un administrador con ese correo" } };
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.create({ data: { email, nombre, passwordHash } });
  return { ok: true, status: 201, body: toDTO(admin) };
}

export async function setAdminActivo(input: {
  currentAdminId: string;
  targetAdminId: string;
  activo: boolean;
}): Promise<ServiceResult<AdminDTO>> {
  const target = await prisma.admin.findUnique({ where: { id: input.targetAdminId } });
  if (!target) {
    return { ok: false, status: 404, body: { error: "Administrador no encontrado" } };
  }

  if (!input.activo) {
    if (input.targetAdminId === input.currentAdminId) {
      return { ok: false, status: 403, body: { error: "No podés inactivar tu propia cuenta" } };
    }

    const activos = await prisma.admin.count({ where: { activo: true } });
    if (activos <= 1) {
      return {
        ok: false,
        status: 403,
        body: { error: "No se puede inactivar al último administrador activo" },
      };
    }
  }

  const admin = await prisma.admin.update({
    where: { id: input.targetAdminId },
    data: { activo: input.activo },
  });
  return { ok: true, status: 200, body: toDTO(admin) };
}

export async function resetAdminPassword(input: {
  targetAdminId: string;
  password: string;
}): Promise<ServiceResult<AdminDTO>> {
  const password = input.password ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      body: { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
    };
  }

  const target = await prisma.admin.findUnique({ where: { id: input.targetAdminId } });
  if (!target) {
    return { ok: false, status: 404, body: { error: "Administrador no encontrado" } };
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.update({
    where: { id: input.targetAdminId },
    data: { passwordHash },
  });
  return { ok: true, status: 200, body: toDTO(admin) };
}
