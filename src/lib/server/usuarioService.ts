import type { Prisma } from "@prisma/client";
import type { Filters } from "@/lib/usuarios/filters";
import type { UsuarioInput } from "@/lib/usuarios/userInput";
import { prisma } from "./prisma";

export type UsuarioFilters = Filters;

export interface UsuarioRow {
  id: string;
  nombre: string;
  cedula: string;
  universidad: string;
  entidad: string;
  activo: boolean;
  fotos: number;
}

export const PAGE_SIZE = 20;

function whereFor({ q, universidad, entidad, estado }: UsuarioFilters): Prisma.UserWhereInput {
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
  if (universidad) and.push({ universidad });
  if (entidad) and.push({ entidad });
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
        universidad: true,
        entidad: true,
        activo: true,
        _count: { select: { embeddings: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { activo: true } }),
  ]);

  const rows: UsuarioRow[] = users.map(({ _count, ...user }) => ({ ...user, fotos: _count.embeddings }));
  return { rows, total, page, counts: { registrados, activos, inactivos: registrados - activos } };
}

/** Valores existentes para los filtros y el autocompletado del formulario. */
export async function listFilterOptions() {
  const [universidades, entidades] = await Promise.all([
    prisma.user.findMany({ distinct: ["universidad"], select: { universidad: true }, orderBy: { universidad: "asc" } }),
    prisma.user.findMany({ distinct: ["entidad"], select: { entidad: true }, orderBy: { entidad: "asc" } }),
  ]);
  return {
    universidades: universidades.map((row) => row.universidad),
    entidades: entidades.map((row) => row.entidad),
  };
}

export async function getUsuario(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { embeddings: true } } },
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
  | { ok: false; duplicate: { id: string; nombre: string } };

async function findDuplicate(cedula: string, exceptId?: string) {
  const other = await prisma.user.findUnique({ where: { cedula }, select: { id: true, nombre: true } });
  return other && other.id !== exceptId ? other : null;
}

export async function createUsuario(input: UsuarioInput): Promise<SaveResult> {
  const duplicate = await findDuplicate(input.cedula);
  if (duplicate) return { ok: false, duplicate };
  const user = await prisma.user.create({ data: toDbInput(input), select: { id: true } });
  return { ok: true, id: user.id };
}

export async function updateUsuario(id: string, input: UsuarioInput): Promise<SaveResult> {
  const duplicate = await findDuplicate(input.cedula, id);
  if (duplicate) return { ok: false, duplicate };
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

/** Inserta en lotes; 10 columnas × 200 filas queda lejos del límite de 2100 parámetros. */
export async function insertUsuarios(inputs: UsuarioInput[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < inputs.length; i += 200) {
    const result = await prisma.user.createMany({ data: inputs.slice(i, i + 200).map(toDbInput) });
    inserted += result.count;
  }
  return inserted;
}
