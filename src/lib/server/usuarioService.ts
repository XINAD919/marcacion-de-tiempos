import type { Prisma } from "@prisma/client";
import type { Filters } from "@/lib/usuarios/filters";
import type { UsuarioInput } from "@/lib/usuarios/userInput";
import { prisma } from "./prisma";

export type UsuarioFilters = Filters;

export interface UsuarioRow {
  id: string;
  nombre: string;
  cedula: string;
  tipo: string;
  institucion: string | null;
  institucionTipo: string | null;
  sede: string | null;
  activo: boolean;
  fotos: number;
}

export const PAGE_SIZE = 20;

/** Lo necesario para describir la afiliación (kiosko, carnet, enrolamiento). */
export const AFILIACION_INCLUDE = {
  institucion: { select: { nombre: true } },
  sede: { select: { nombre: true } },
} as const satisfies Prisma.UserInclude;

/** Filtro de usuarios por texto, tipo, institución, sede y estado; Reportes lo reutiliza. */
export function whereFor({ q, tipo, institucion, sede, estado }: UsuarioFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  const text = q?.trim();
  if (text) {
    const digits = text.replace(/[.\s-]/g, "");
    and.push({
      OR: [
        // SQL Server compara sin distinguir mayúsculas con la intercalación por defecto.
        { nombre: { contains: text } },
        ...(/^\d+$/.test(digits) ? [{ cedula: { contains: digits } }] : []),
      ],
    });
  }
  // Natural es un tipo de usuario; universidad / técnica / colegio, de su institución.
  if (tipo === "natural") and.push({ tipo: "natural" });
  else if (tipo) and.push({ tipo: { not: "natural" }, institucion: { tipo } });
  if (institucion) and.push({ institucionId: institucion });
  if (sede) and.push({ sedeId: sede });
  if (estado === "activo") and.push({ activo: true });
  if (estado === "inactivo") and.push({ activo: false });
  if (estado === "sin-rostro") and.push({ activo: true, embeddings: { none: {} } });

  return { AND: and };
}

export async function listUsuarios(filters: UsuarioFilters) {
  const where = whereFor(filters);
  const page = Math.max(1, filters.page ?? 1);

  const [users, total, registrados, activos] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { nombre: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        nombre: true,
        cedula: true,
        tipo: true,
        activo: true,
        institucion: { select: { nombre: true, tipo: true } },
        sede: { select: { nombre: true } },
        _count: { select: { embeddings: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { activo: true } }),
  ]);

  const rows: UsuarioRow[] = users.map(({ _count, institucion, sede, ...user }) => ({
    ...user,
    institucion: institucion?.nombre ?? null,
    institucionTipo: institucion?.tipo ?? null,
    sede: sede?.nombre ?? null,
    fotos: _count.embeddings,
  }));
  return { rows, total, page, counts: { registrados, activos, inactivos: registrados - activos } };
}

export async function getUsuario(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      ...AFILIACION_INCLUDE,
      _count: { select: { embeddings: true } },
      carnet: { select: { enviadoEn: true, enviadoA: true } },
    },
  });
  if (!user) return null;
  const { _count, ...rest } = user;
  return { ...rest, fotos: _count.embeddings };
}

/**
 * `fechaInicio` es una columna DATE: Prisma la guarda y la devuelve como
 * medianoche UTC. Se normaliza aquí para que la fecha local elegida no se
 * corra un día según la zona horaria del servidor.
 */
function toDbInput(input: UsuarioInput): UsuarioInput {
  const fecha = input.fechaInicio;
  return {
    ...input,
    fechaInicio: fecha ? new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())) : null,
  };
}

/** Columna DATE (medianoche UTC) → "YYYY-MM-DD", sin correrse por zona horaria. */
export function dbDateToIso(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: { id: string; nombre: string } }
  | { ok: false; noDisponible: "institucionId" | "sedeId" };

async function findDuplicate(cedula: string, exceptId?: string) {
  const other = await prisma.user.findUnique({ where: { cedula }, select: { id: true, nombre: true } });
  return other && other.id !== exceptId ? other : null;
}

/**
 * Institución o sede elegida que ya no se puede asignar: no existe, o está
 * inactiva y el usuario no la tenía. La que ya tenía la conserva aunque se
 * haya inactivado después.
 */
async function catalogoNoDisponible(
  input: UsuarioInput,
  actual?: { institucionId: number | null; sedeId: number | null }
): Promise<"institucionId" | "sedeId" | null> {
  if (input.institucionId !== null && input.institucionId !== actual?.institucionId) {
    const found = await prisma.institucion.findUnique({ where: { id: input.institucionId }, select: { activa: true } });
    if (!found?.activa) return "institucionId";
  }
  if (input.sedeId !== null && input.sedeId !== actual?.sedeId) {
    const found = await prisma.sede.findUnique({ where: { id: input.sedeId }, select: { activa: true } });
    if (!found?.activa) return "sedeId";
  }
  return null;
}

export async function createUsuario(input: UsuarioInput): Promise<SaveResult> {
  const duplicate = await findDuplicate(input.cedula);
  if (duplicate) return { ok: false, duplicate };
  const noDisponible = await catalogoNoDisponible(input);
  if (noDisponible) return { ok: false, noDisponible };
  const user = await prisma.user.create({ data: toDbInput(input), select: { id: true } });
  return { ok: true, id: user.id };
}

export async function updateUsuario(id: string, input: UsuarioInput): Promise<SaveResult> {
  const duplicate = await findDuplicate(input.cedula, id);
  if (duplicate) return { ok: false, duplicate };
  const actual = await prisma.user.findUnique({ where: { id }, select: { institucionId: true, sedeId: true } });
  const noDisponible = await catalogoNoDisponible(input, actual ?? undefined);
  if (noDisponible) return { ok: false, noDisponible };
  await prisma.user.update({ where: { id }, data: toDbInput(input) });
  return { ok: true, id };
}

export async function listCedulas(cedulas: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  // SQL Server admite hasta 2100 parámetros por consulta: se consulta por lotes.
  for (let i = 0; i < cedulas.length; i += 1000) {
    const rows = await prisma.user.findMany({
      where: { cedula: { in: cedulas.slice(i, i + 1000) } },
      select: { cedula: true },
    });
    for (const row of rows) found.add(row.cedula);
  }
  return found;
}

/**
 * Inserta en lotes de 200. Con 11 columnas eso pasa de los 2100 parámetros de
 * SQL Server, pero Prisma parte la consulta por su cuenta (lo cubre un test).
 */
export async function insertUsuarios(inputs: UsuarioInput[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < inputs.length; i += 200) {
    const result = await prisma.user.createMany({ data: inputs.slice(i, i + 200).map(toDbInput) });
    inserted += result.count;
  }
  return inserted;
}
