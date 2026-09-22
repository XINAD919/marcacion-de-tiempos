import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/passwords";

export type AdminSessionUser = { id: string; email: string; name: string };

export async function authenticateAdmin(
  email: unknown,
  password: unknown
): Promise<AdminSessionUser | null> {
  if (typeof email !== "string" || typeof password !== "string") return null;

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !admin.activo) return null;

  const esValida = await verifyPassword(password, admin.passwordHash);
  if (!esValida) return null;

  return { id: admin.id, email: admin.email, name: admin.nombre };
}
