import {
  type AsistenciaRow, buildAsistenciaRow, incluirEnAsistencia, matchesEstadoAsistencia, summarizeAsistencia,
} from "@/lib/reportes/attendance";
import { type AsistenciaFilters, resolveDay } from "@/lib/reportes/asistenciaFilters";
import { riesgoUmbral, splitCumplimiento } from "@/lib/reportes/cumplimiento";
import { dateOnlyToLocal } from "@/lib/reportes/dates";
import type { CumplimientoFilters } from "@/lib/reportes/filters";
import { type ReporteRow, type ReporteUser, buildReporteRow, sortByNombre } from "@/lib/reportes/rows";
import { getConfig } from "./config";
import { MARCACION_VALIDA } from "./marcacionValida";
import { prisma } from "./prisma";
import { PAGE_SIZE, type UsuarioFilters, whereFor } from "./usuarioService";
import type { AttendanceMark, WorkedTimeOptions } from "./workedTime";

type Scope = Pick<UsuarioFilters, "q" | "tipo" | "institucion" | "sede">;

interface Loaded {
  users: ReporteUser[];
  marksByUser: Map<string, AttendanceMark[]>;
  worked: WorkedTimeOptions;
  toleranciaMin: number;
}

async function load(scope: Scope): Promise<Loaded> {
  const where = whereFor({ q: scope.q, tipo: scope.tipo, institucion: scope.institucion, sede: scope.sede });

  const [config, users, logs] = await Promise.all([
    getConfig(),
    prisma.user.findMany({
      where,
      select: {
        id: true, nombre: true, cedula: true,
        institucion: { select: { nombre: true } }, sede: { select: { nombre: true } },
        activo: true, horasRequeridas: true, horaInicio: true, fechaInicio: true,
        _count: { select: { embeddings: true } },
      },
    }),
    prisma.attendanceLog.findMany({
      where: { user: where, ...MARCACION_VALIDA },
      select: { userId: true, tipo: true, marcadoEn: true },
    }),
  ]);

  const marksByUser = new Map<string, AttendanceMark[]>();
  for (const { userId, tipo, marcadoEn } of logs) {
    const list = marksByUser.get(userId);
    if (list) list.push({ tipo, marcadoEn });
    else marksByUser.set(userId, [{ tipo, marcadoEn }]);
  }

  return {
    users: users.map(({ _count, fechaInicio, institucion, sede, ...user }) => ({
      ...user,
      institucion: institucion?.nombre ?? null,
      sede: sede?.nombre ?? null,
      fechaInicio: fechaInicio ? dateOnlyToLocal(fechaInicio) : null,
      sinRostro: _count.embeddings === 0,
    })),
    marksByUser,
    worked: { maxDailyMs: config.jornadaMaximaHoras * 60 * 60 * 1000 },
    toleranciaMin: config.toleranciaLlegadaMin,
  };
}

function paginate<T>(rows: T[], requested: number | undefined) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, requested ?? 1), pages);
  return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pages };
}

async function cumplimientoRows(scope: Scope): Promise<ReporteRow[]> {
  const { users, marksByUser, worked } = await load(scope);
  return users.map((user) => buildReporteRow(user, marksByUser.get(user.id) ?? [], worked));
}

export async function getCumplimiento(filters: CumplimientoFilters) {
  const all = await cumplimientoRows(filters);
  const { enRiesgo, anillos, resto } = splitCumplimiento(all, riesgoUmbral(filters.riesgo));
  return { total: all.length, enRiesgo: enRiesgo.length, anillos, ...paginate(resto, filters.page), restoTotal: resto.length };
}

export async function listCumplimientoForExport(scope: Scope): Promise<ReporteRow[]> {
  return sortByNombre(await cumplimientoRows(scope));
}

async function asistenciaRows(filters: AsistenciaFilters, now: Date): Promise<AsistenciaRow[]> {
  const day = resolveDay(filters, now);
  const { users, marksByUser, worked, toleranciaMin } = await load(filters);
  return users
    .map((user) => buildAsistenciaRow(user, marksByUser.get(user.id) ?? [], day, { worked, toleranciaMin }))
    .filter(incluirEnAsistencia);
}

export async function getAsistencia(filters: AsistenciaFilters, now: Date = new Date()) {
  const all = await asistenciaRows(filters, now);
  const filtered = sortByNombre(all.filter((row) => matchesEstadoAsistencia(row, filters.estado)));
  return { summary: summarizeAsistencia(all), total: filtered.length, ...paginate(filtered, filters.page) };
}

export async function listAsistenciaForExport(filters: AsistenciaFilters, now: Date = new Date()): Promise<AsistenciaRow[]> {
  const all = await asistenciaRows(filters, now);
  return sortByNombre(all.filter((row) => matchesEstadoAsistencia(row, filters.estado)));
}