import { Prisma } from "@prisma/client";
import { type InstitucionInput, type InstitucionOpcion, isTipoInstitucion } from "@/lib/catalogo/institucion";
import { normalizeNombre } from "@/lib/catalogo/nombres";
import type { SedeInput, SedeOpcion } from "@/lib/catalogo/sede";
import { prisma } from "./prisma";

// Activas primero: las inactivas van al final de cada lista (maqueta 4f).
// Sirve para los dos modelos: ambos tienen `activa` y `nombre`.
const ORDEN = [{ activa: "desc" as const }, { nombre: "asc" as const }];

function toInstitucionOpcion(row: Omit<InstitucionOpcion, "tipo"> & { tipo: string }): InstitucionOpcion {
  return { ...row, tipo: isTipoInstitucion(row.tipo) ? row.tipo : "universidad" };
}

/** Catálogo completo para desplegables, filtros e importación. */
export async function listCatalogo(): Promise<{ instituciones: InstitucionOpcion[]; sedes: SedeOpcion[] }> {
  const [instituciones, sedes] = await Promise.all([
    prisma.institucion.findMany({
      orderBy: ORDEN,
      select: { id: true, nombre: true, tipo: true, horasExigidas: true, activa: true },
    }),
    prisma.sede.findMany({
      orderBy: ORDEN,
      select: { id: true, nombre: true, direccion: true, horaApertura: true, horaCierre: true, activa: true },
    }),
  ]);
  return { instituciones: instituciones.map(toInstitucionOpcion), sedes };
}

export interface InstitucionConConteo extends InstitucionOpcion {
  activos: number;
}

export interface SedeConConteo extends SedeOpcion {
  practicantes: number;
}

/**
 * Pantalla 4f: cada entrada con sus usuarios activos. Dos consultas agrupadas
 * para toda la pantalla, nunca una por tarjeta.
 */
export async function listCatalogoConConteos(): Promise<{
  instituciones: InstitucionConConteo[];
  sedes: SedeConConteo[];
}> {
  const [{ instituciones, sedes }, porInstitucion, porSede] = await Promise.all([
    listCatalogo(),
    prisma.user.groupBy({
      by: ["institucionId"],
      where: { activo: true, institucionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["sedeId"],
      where: { activo: true, sedeId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const activos = new Map(porInstitucion.map((row) => [row.institucionId, row._count._all]));
  const practicantes = new Map(porSede.map((row) => [row.sedeId, row._count._all]));
  return {
    instituciones: instituciones.map((item) => ({ ...item, activos: activos.get(item.id) ?? 0 })),
    sedes: sedes.map((item) => ({ ...item, practicantes: practicantes.get(item.id) ?? 0 })),
  };
}

export type GuardarCatalogoResult = { ok: true; id: number } | { ok: false; reason: "duplicado" | "no-encontrado" };

function prismaCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

/**
 * El UNIQUE de SQL Server ya distingue mayúsculas, pero no tildes ni espacios
 * internos: "Antioquia" y "Antioquía" serían dos. Se comparan como lo hace la
 * importación, para que no convivan dos que el Excel no puede distinguir.
 */
function nombreRepetido(nombre: string, otros: { nombre: string }[]): boolean {
  const clave = normalizeNombre(nombre);
  return otros.some((otro) => normalizeNombre(otro.nombre) === clave);
}

async function guardar(
  nombre: string,
  otros: () => Promise<{ nombre: string }[]>,
  run: () => Promise<{ id: number }>
): Promise<GuardarCatalogoResult> {
  if (nombreRepetido(nombre, await otros())) return { ok: false, reason: "duplicado" };
  try {
    return { ok: true, id: (await run()).id };
  } catch (error) {
    // P2002: nombre repetido (UNIQUE). P2025: se editó una que ya no existe.
    if (prismaCode(error) === "P2002") return { ok: false, reason: "duplicado" };
    if (prismaCode(error) === "P2025") return { ok: false, reason: "no-encontrado" };
    throw error;
  }
}

// El catálogo es chico (decenas de entradas): comparar contra todas es barato.
const otrasQue = (id: number | null) => ({ where: id === null ? {} : { id: { not: id } }, select: { nombre: true } });

export function guardarInstitucion(id: number | null, input: InstitucionInput): Promise<GuardarCatalogoResult> {
  return guardar(input.nombre, () => prisma.institucion.findMany(otrasQue(id)), () =>
    id === null
      ? prisma.institucion.create({ data: input, select: { id: true } })
      : prisma.institucion.update({ where: { id }, data: input, select: { id: true } })
  );
}

export function guardarSede(id: number | null, input: SedeInput): Promise<GuardarCatalogoResult> {
  return guardar(input.nombre, () => prisma.sede.findMany(otrasQue(id)), () =>
    id === null
      ? prisma.sede.create({ data: input, select: { id: true } })
      : prisma.sede.update({ where: { id }, data: input, select: { id: true } })
  );
}
