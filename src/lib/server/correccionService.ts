import type { Prisma } from "@prisma/client";
import { encaja, type Marca } from "@/lib/marcaciones/dias";
import { MENSAJE, parseMotivo } from "@/lib/marcaciones/correcciones";
import { addDays, isSameDay, startOfDay } from "@/lib/reportes/dates";
import { DEVICE_COORDINACION, MARCACION_VALIDA } from "./marcacionValida";
import { prisma } from "./prisma";

export type CorreccionResult = { ok: true } | { ok: false; field?: "hora" | "motivo" | "destino"; message: string };

interface Base {
  adminId: string;
  motivo: string;
  now?: Date;
}

type Tx = Prisma.TransactionClient;
type Fila = Prisma.AttendanceLogGetPayload<object>;

const OK: CorreccionResult = { ok: true };
const fail = (message: string, field?: "hora" | "motivo" | "destino"): CorreccionResult => ({ ok: false, field, message });
const noExiste = () => fail(MENSAJE.noExiste);

/** Marcas válidas del día local de `ref`, sin las ids excluidas. */
async function marcasDelDia(tx: Tx, userId: string, ref: Date, excluir: string[] = []): Promise<Marca[]> {
  const inicio = startOfDay(ref);
  return tx.attendanceLog.findMany({
    where: { userId, ...MARCACION_VALIDA, id: { notIn: excluir }, marcadoEn: { gte: inicio, lt: addDays(inicio, 1) } },
    orderBy: { marcadoEn: "asc" },
  });
}

/** Marcación manual de coordinación; `reemplazaAId` solo cuando es copia de otra. */
function manual(
  i: Base,
  datos: { userId: string; tipo: string; marcadoEn: Date },
  reemplazaAId: string | null = null,
): Prisma.AttendanceLogUncheckedCreateInput {
  return {
    ...datos,
    metodo: "manual",
    confianza: null,
    deviceId: DEVICE_COORDINACION,
    registradoPorId: i.adminId,
    motivo: i.motivo,
    reemplazaAId,
  };
}

const anularFila = (tx: Tx, id: string, i: Base, now: Date) =>
  tx.attendanceLog.update({ where: { id }, data: { anuladaEn: now, anuladaPorId: i.adminId, motivoAnulacion: i.motivo } });

/** Valida el motivo y corre `fn` en una transacción (solo escribe tras pasar todas las reglas). */
function run(i: Base, fn: (tx: Tx, now: Date, b: Base) => Promise<CorreccionResult>): Promise<CorreccionResult> {
  const motivo = parseMotivo(i.motivo);
  if (!motivo.ok) return Promise.resolve(fail(motivo.error, "motivo"));
  const b = { ...i, motivo: motivo.value };
  return prisma.$transaction((tx) => fn(tx, i.now ?? new Date(), b));
}

export function registrarSalida(i: Base & { entradaId: string; hora: Date }): Promise<CorreccionResult> {
  return run(i, async (tx, now, b) => {
    const entrada = await tx.attendanceLog.findFirst({ where: { id: i.entradaId, tipo: "IN", ...MARCACION_VALIDA } });
    if (!entrada) return noExiste();
    if (i.hora.getTime() > now.getTime()) return fail(MENSAJE.futuro, "hora");
    const dia = await marcasDelDia(tx, entrada.userId, entrada.marcadoEn);
    const nueva = { tipo: "OUT", marcadoEn: i.hora };
    const anterior = [...dia].reverse().find((m) => m.marcadoEn.getTime() <= i.hora.getTime());
    if (
      !isSameDay(i.hora, entrada.marcadoEn) ||
      i.hora.getTime() <= entrada.marcadoEn.getTime() ||
      anterior?.id !== entrada.id ||
      !encaja(dia, nueva)
    ) {
      return fail(MENSAJE.salidaAntesDeEntrada, "hora");
    }
    await tx.attendanceLog.create({ data: manual(b, { userId: entrada.userId, ...nueva }) });
    return OK;
  });
}

export function registrarEntrada(i: Base & { salidaId: string; hora: Date }): Promise<CorreccionResult> {
  return run(i, async (tx, now, b) => {
    const salida = await tx.attendanceLog.findFirst({ where: { id: i.salidaId, tipo: "OUT", ...MARCACION_VALIDA } });
    if (!salida) return noExiste();
    if (i.hora.getTime() > now.getTime()) return fail(MENSAJE.futuro, "hora");
    const dia = await marcasDelDia(tx, salida.userId, salida.marcadoEn);
    const nueva = { tipo: "IN", marcadoEn: i.hora };
    if (!isSameDay(i.hora, salida.marcadoEn) || !encaja(dia, nueva)) return fail(MENSAJE.desorden, "hora");
    await tx.attendanceLog.create({ data: manual(b, { userId: salida.userId, ...nueva }) });
    return OK;
  });
}

export function corregirHora(i: Base & { marcaId: string; hora: Date }): Promise<CorreccionResult> {
  return run(i, async (tx, now, b) => {
    const marca = await tx.attendanceLog.findFirst({ where: { id: i.marcaId, ...MARCACION_VALIDA } });
    if (!marca) return noExiste();
    if (i.hora.getTime() > now.getTime()) return fail(MENSAJE.futuro, "hora");
    if (!isSameDay(i.hora, marca.marcadoEn)) return fail(MENSAJE.desorden, "hora");
    const dia = await marcasDelDia(tx, marca.userId, marca.marcadoEn, [marca.id]);
    const nueva = { tipo: marca.tipo, marcadoEn: i.hora };
    if (!encaja(dia, nueva)) return fail(MENSAJE.desorden, "hora");
    await anularFila(tx, marca.id, b, now);
    await tx.attendanceLog.create({ data: manual(b, { userId: marca.userId, ...nueva }, marca.id) });
    return OK;
  });
}

/** La OUT que cierra una IN (o la IN de una OUT) en el mismo día. */
async function parejaEn(tx: Tx, marca: Fila) {
  const dia = await marcasDelDia(tx, marca.userId, marca.marcadoEn);
  const pos = dia.findIndex((m) => m.id === marca.id);
  const vecina = marca.tipo === "IN" ? dia[pos + 1] : dia[pos - 1];
  return vecina && vecina.tipo !== marca.tipo ? vecina : null;
}

export async function parejaDe(marcaId: string): Promise<{ id: string; tipo: string; marcadoEn: Date } | null> {
  const marca = await prisma.attendanceLog.findFirst({ where: { id: marcaId, ...MARCACION_VALIDA } });
  if (!marca) return null;
  const p = await parejaEn(prisma, marca);
  return p ? { id: p.id, tipo: p.tipo, marcadoEn: p.marcadoEn } : null;
}

export function anular(i: Base & { marcaId: string; incluirPareja: boolean }): Promise<CorreccionResult> {
  return run(i, async (tx, now, b) => {
    const marca = await tx.attendanceLog.findFirst({ where: { id: i.marcaId, ...MARCACION_VALIDA } });
    if (!marca) return noExiste();
    const pareja = i.incluirPareja ? await parejaEn(tx, marca) : null;
    await anularFila(tx, marca.id, b, now);
    if (pareja) await anularFila(tx, pareja.id, b, now);
    return OK;
  });
}

export function restaurar(i: Base & { marcaId: string }): Promise<CorreccionResult> {
  return run(i, async (tx, _now, b) => {
    const marca = await tx.attendanceLog.findUnique({ where: { id: i.marcaId } });
    if (!marca) return noExiste();
    if (!marca.anuladaEn) return fail(MENSAJE.noAnulada);
    const reemplazo = await tx.attendanceLog.findFirst({ where: { reemplazaAId: marca.id, ...MARCACION_VALIDA } });
    if (reemplazo) return fail(MENSAJE.reemplazada);
    const dia = await marcasDelDia(tx, marca.userId, marca.marcadoEn);
    if (!encaja(dia, marca)) return fail(MENSAJE.desorden);
    await tx.attendanceLog.create({
      data: manual(b, { userId: marca.userId, tipo: marca.tipo, marcadoEn: marca.marcadoEn }, marca.id),
    });
    return OK;
  });
}

export function reasignar(i: Base & { marcaId: string; destinoUserId: string }): Promise<CorreccionResult> {
  return run(i, async (tx, now, b) => {
    const marca = await tx.attendanceLog.findFirst({ where: { id: i.marcaId, ...MARCACION_VALIDA } });
    if (!marca) return noExiste();
    if (marca.userId === i.destinoUserId) return fail(MENSAJE.mismoUsuario, "destino");
    const destino = await tx.user.findUnique({ where: { id: i.destinoUserId }, select: { activo: true } });
    if (!destino) return fail(MENSAJE.noExiste, "destino");
    if (!destino.activo) return fail(MENSAJE.destinoInactivo, "destino");
    const dia = await marcasDelDia(tx, i.destinoUserId, marca.marcadoEn);
    if (!encaja(dia, marca)) return fail(MENSAJE.desorden, "destino");
    await anularFila(tx, marca.id, b, now);
    await tx.attendanceLog.create({
      data: manual(b, { userId: i.destinoUserId, tipo: marca.tipo, marcadoEn: marca.marcadoEn }, marca.id),
    });
    return OK;
  });
}
