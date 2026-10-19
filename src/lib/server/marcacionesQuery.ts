import { Prisma } from "@prisma/client";
import { horaSugerida } from "@/lib/marcaciones/correcciones";
import {
  type Inconsistencia, type Marca, findInconsistencias, jornadaAbiertaHoy, marcasPorDia,
} from "@/lib/marcaciones/dias";
import { type Novedad, horaFinEfectiva, novedadesDe } from "@/lib/marcaciones/novedades";
import { reglasPara } from "@/lib/configRules";
import { addDays, dateOnlyToLocal, startOfDay } from "@/lib/reportes/dates";
import { type ReporteRow, buildReporteRow } from "@/lib/reportes/rows";
import { getConfig } from "./config";
import { MARCACION_VALIDA } from "./marcacionValida";
import { prisma } from "./prisma";
import { sumWorkedMs } from "./workedTime";

const DIAS_POR_PAGINA = 30;
const HOUR = 60 * 60 * 1000;

export interface MarcaHistorial {
  id: string;
  tipo: string;
  metodo: string;
  marcadoEn: Date;
  motivo: string | null;
  registradoPor: string | null;
  anuladaEn: Date | null;
  motivoAnulacion: string | null;
  anuladaPor: string | null;
  reemplazaAId: string | null;
  /** Una corrección válida ya ocupa su lugar: no se puede restaurar. */
  reemplazada: boolean;
  novedades: Novedad[];
}

export interface DiaHistorial {
  dia: Date;
  marcas: MarcaHistorial[]; // incluye anuladas
  jornadaMs: number;
}

export interface Scope {
  sede?: number;
  institucion?: number;
}

const marcaSelect = {
  id: true, userId: true, tipo: true, metodo: true, marcadoEn: true, motivo: true, anuladaEn: true,
  motivoAnulacion: true, reemplazaAId: true,
  registradoPor: { select: { nombre: true } },
  anuladaPor: { select: { nombre: true } },
} satisfies Prisma.AttendanceLogSelect;

type Fila = Prisma.AttendanceLogGetPayload<{ select: typeof marcaSelect }>;

interface ContextoNovedades {
  horaInicio: string | null;
  horaFin: string | null;
  toleranciaMin: number;
}

/** Arma las marcas de un día; las anuladas no llevan novedades (ya no cuentan). */
function marcasHistorial(filas: Fila[], ctx: ContextoNovedades, reemplazadas: ReadonlySet<string> = new Set()): MarcaHistorial[] {
  const primeraEntrada = filas.filter((f) => !f.anuladaEn && f.tipo === "IN")[0];
  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    metodo: f.metodo,
    marcadoEn: f.marcadoEn,
    motivo: f.motivo,
    registradoPor: f.registradoPor?.nombre ?? null,
    anuladaEn: f.anuladaEn,
    motivoAnulacion: f.motivoAnulacion,
    anuladaPor: f.anuladaPor?.nombre ?? null,
    reemplazaAId: f.reemplazaAId,
    reemplazada: reemplazadas.has(f.id),
    novedades: f.anuladaEn ? [] : novedadesDe(f, { ...ctx, primeraEntradaDelDia: f.id === primeraEntrada?.id }),
  }));
}

export async function getPerfil(userId: string, page: number, now: Date = new Date()) {
  const [config, user, filas] = await Promise.all([
    getConfig(),
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        institucion: { select: { nombre: true } },
        sede: { select: { nombre: true, horaCierre: true } },
        _count: { select: { embeddings: true } },
      },
    }),
    prisma.attendanceLog.findMany({ where: { userId }, orderBy: { marcadoEn: "asc" }, select: marcaSelect }),
  ]);
  if (!user) return null;

  const worked = { maxDailyMs: config.jornadaMaximaHoras * HOUR };
  const validas: Marca[] = filas.filter((f) => !f.anuladaEn);
  const ctx: ContextoNovedades = {
    horaInicio: user.horaInicio,
    horaFin: horaFinEfectiva(user),
    toleranciaMin: reglasPara(config, user.tipo).toleranciaLlegadaMin,
  };

  const avance: ReporteRow = buildReporteRow(
    {
      id: user.id, nombre: user.nombre, cedula: user.cedula, activo: user.activo,
      institucion: user.institucion?.nombre ?? null, sede: user.sede?.nombre ?? null,
      horasRequeridas: user.horasRequeridas, horaInicio: user.horaInicio,
      fechaInicio: user.fechaInicio ? dateOnlyToLocal(user.fechaInicio) : null,
      sinRostro: user._count.embeddings === 0,
    },
    validas,
    worked,
  );

  // Una anulada está reemplazada si alguna fila válida la señala; las copias de «reasignar»
  // son de otra persona, por eso se consultan aparte (una sola consulta para todas).
  const anuladasIds = filas.filter((f) => f.anuladaEn).map((f) => f.id);
  const reemplazadas = new Set<string>(
    filas.filter((f) => !f.anuladaEn).map((f) => f.reemplazaAId).filter((id): id is string => id !== null && anuladasIds.includes(id)),
  );
  const sinResolver = anuladasIds.filter((id) => !reemplazadas.has(id));
  if (sinResolver.length > 0) {
    const copias = await prisma.attendanceLog.findMany({
      where: { ...MARCACION_VALIDA, reemplazaAId: { in: sinResolver } },
      select: { reemplazaAId: true },
    });
    for (const c of copias) if (c.reemplazaAId) reemplazadas.add(c.reemplazaAId);
  }

  const todos = [...marcasPorDia(filas).entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const pages = Math.max(1, Math.ceil(todos.length / DIAS_POR_PAGINA));
  const actual = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const dias: DiaHistorial[] = todos.slice((actual - 1) * DIAS_POR_PAGINA, actual * DIAS_POR_PAGINA).map(([, delDia]) => ({
    dia: startOfDay(delDia[0]!.marcadoEn),
    marcas: marcasHistorial(delDia, ctx, reemplazadas),
    jornadaMs: sumWorkedMs(delDia.filter((f) => !f.anuladaEn), worked),
  }));

  return {
    user: {
      id: user.id, nombre: user.nombre, cedula: user.cedula, tipo: user.tipo, activo: user.activo, email: user.email,
      horaInicio: user.horaInicio, horaFin: user.horaFin,
      institucion: user.institucion?.nombre ?? null, sede: user.sede?.nombre ?? null,
    },
    avance,
    jornadaAbierta: jornadaAbiertaHoy(validas, now),
    inconsistencias: findInconsistencias(validas, now),
    sugerencia: { horaFin: horaFinEfectiva(user) },
    dias,
    page: actual,
    pages,
  };
}

export interface Pendiente {
  inconsistencia: Inconsistencia;
  user: { id: string; nombre: string; cedula: string; horaInicio: string | null; horaFin: string | null };
  horaSugerida: string | null;
}

function scopeSql(scope: Scope): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (scope.sede) parts.push(Prisma.sql`AND u.sedeId = ${scope.sede}`);
  if (scope.institucion) parts.push(Prisma.sql`AND u.institucionId = ${scope.institucion}`);
  return parts.length ? Prisma.join(parts, " ") : Prisma.empty;
}

/**
 * Marcas sin pareja, calculadas en SQL con LAG/LEAD por usuario y día local
 * (mismo criterio que `findInconsistencias`). El desfase es el de la hora local
 * del servidor, para que 19:30 en Colombia no caiga en el día siguiente (UTC).
 */
function pendientesCte(scope: Scope, now: Date): Prisma.Sql {
  const offsetMin = -now.getTimezoneOffset();
  return Prisma.sql`
    WITH m AS (
      SELECT a.id, a.tipo, a.marcadoEn,
        CAST(DATEADD(minute, ${offsetMin}, a.marcadoEn) AS date) AS dia,
        LAG(a.tipo) OVER (PARTITION BY a.userId, CAST(DATEADD(minute, ${offsetMin}, a.marcadoEn) AS date) ORDER BY a.marcadoEn, a.id) AS anterior,
        LEAD(a.tipo) OVER (PARTITION BY a.userId, CAST(DATEADD(minute, ${offsetMin}, a.marcadoEn) AS date) ORDER BY a.marcadoEn, a.id) AS siguiente
      FROM [AttendanceLog] a
      JOIN [User] u ON u.id = a.userId
      WHERE a.anuladaEn IS NULL AND u.activo = 1 ${scopeSql(scope)}
    ), p AS (
      SELECT id, dia, marcadoEn FROM m
      WHERE (tipo = 'IN' AND dia < CAST(DATEADD(minute, ${offsetMin}, ${now}) AS date) AND (siguiente IS NULL OR siguiente <> 'OUT'))
         OR (tipo = 'OUT' AND (anterior IS NULL OR anterior <> 'IN'))
    )`;
}

export async function listPendientes(
  scope: Scope,
  opts: { limit: number; offset: number },
  now: Date = new Date(),
): Promise<{ rows: Pendiente[]; total: number }> {
  const cte = pendientesCte(scope, now);
  const offset = Math.max(0, opts.offset);
  const ids = await prisma.$queryRaw<{ id: string; total: number }[]>`${cte}
    SELECT id, COUNT(*) OVER() AS total FROM p ORDER BY dia DESC, marcadoEn ASC, id
    OFFSET ${offset} ROWS FETCH NEXT ${Math.max(1, opts.limit)} ROWS ONLY`;
  let total = Number(ids[0]?.total ?? 0);
  if (ids.length === 0) {
    // Página vacía: con offset 0 no hay nada; más allá del final solo el conteo dice cuántas hay.
    if (offset > 0) {
      const conteo = await prisma.$queryRaw<{ total: number }[]>`${cte} SELECT COUNT(*) AS total FROM p`;
      total = Number(conteo[0]?.total ?? 0);
    }
    return { rows: [], total };
  }

  const filas = await prisma.attendanceLog.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    select: {
      id: true, tipo: true, marcadoEn: true,
      user: { select: { id: true, nombre: true, cedula: true, horaInicio: true, horaFin: true, sede: { select: { horaCierre: true } } } },
    },
  });
  const porId = new Map(filas.map((f) => [f.id, f]));

  const rows: Pendiente[] = [];
  for (const { id } of ids) {
    const f = porId.get(id);
    if (!f) continue;
    const { sede, ...user } = f.user;
    const marca: Marca = { id: f.id, tipo: f.tipo, marcadoEn: f.marcadoEn };
    const sinSalida = f.tipo === "IN";
    rows.push({
      inconsistencia: sinSalida ? { tipo: "sin-salida", marca } : { tipo: "sin-entrada", marca },
      user,
      horaSugerida: sinSalida ? horaSugerida(f.marcadoEn, user.horaFin, sede?.horaCierre ?? null) : null,
    });
  }
  return { rows, total };
}

export interface MarcacionDelDia {
  marca: MarcaHistorial;
  user: { id: string; nombre: string };
}

export async function getMarcacionesDelDia(scope: Scope, now: Date = new Date()) {
  const inicio = startOfDay(now);
  const [config, logs] = await Promise.all([
    getConfig(),
    prisma.attendanceLog.findMany({
      where: {
        ...MARCACION_VALIDA,
        marcadoEn: { gte: inicio, lt: addDays(inicio, 1) },
        user: { activo: true, sedeId: scope.sede, institucionId: scope.institucion },
      },
      orderBy: { marcadoEn: "asc" },
      select: {
        ...marcaSelect,
        user: { select: { id: true, nombre: true, tipo: true, horaInicio: true, horaFin: true, sede: { select: { horaCierre: true } } } },
      },
    }),
  ]);

  const porUsuario = new Map<string, typeof logs>();
  for (const log of logs) {
    const lista = porUsuario.get(log.userId);
    if (lista) lista.push(log);
    else porUsuario.set(log.userId, [log]);
  }

  const resumen = { dentroAhora: 0, yaSalieron: 0, tarde: 0, salidasTempranas: 0 };
  const rows: MarcacionDelDia[] = [];
  for (const delUsuario of porUsuario.values()) {
    const { user } = delUsuario[0]!;
    const marcas = marcasHistorial(delUsuario, {
      horaInicio: user.horaInicio,
      horaFin: horaFinEfectiva(user),
      toleranciaMin: reglasPara(config, user.tipo).toleranciaLlegadaMin,
    });
    if (marcas[marcas.length - 1]!.tipo === "IN") resumen.dentroAhora += 1;
    else resumen.yaSalieron += 1;
    if (marcas.some((m) => m.novedades.some((n) => n.tipo === "tarde"))) resumen.tarde += 1;
    resumen.salidasTempranas += marcas.filter((m) => m.novedades.some((n) => n.tipo === "salida-temprana")).length;
    for (const marca of marcas) rows.push({ marca, user: { id: user.id, nombre: user.nombre } });
  }
  rows.sort((a, b) => b.marca.marcadoEn.getTime() - a.marca.marcadoEn.getTime());
  return { rows, resumen };
}
