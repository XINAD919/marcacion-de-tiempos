import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { findInconsistencias } from "@/lib/marcaciones/dias";
import { MENSAJE } from "@/lib/marcaciones/correcciones";
import { MARCACION_VALIDA } from "./marcacionValida";
import { anular, corregirHora, parejaDe, reasignar, registrarEntrada, registrarSalida, restaurar } from "./correccionService";
import { prisma } from "./prisma";
import { sumWorkedMs } from "./workedTime";

// Prefijo propio para no chocar con datos reales del entorno de desarrollo.
const PREFIX = "990089";
const HOUR = 60 * 60 * 1000;
let adminId: string;
let userId: string;
let otroId: string;
let inactivoId: string;

/** Hora local de ayer. */
function ayer(h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(h, m, 0, 0);
  return d;
}

async function marca(uid: string, tipo: "IN" | "OUT", marcadoEn: Date) {
  return prisma.attendanceLog.create({ data: { userId: uid, tipo, metodo: "face", deviceId: "t", marcadoEn } });
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { cedula: { startsWith: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  // Las copias apuntan a las originales: primero se suelta el vínculo.
  await prisma.attendanceLog.updateMany({ where: { userId: { in: ids } }, data: { reemplazaAId: null } });
  await prisma.attendanceLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.admin.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

beforeAll(async () => {
  await cleanup();
  const admin = await prisma.admin.create({ data: { email: `${PREFIX}@test.local`, nombre: "Admin Prueba", passwordHash: "x" } });
  adminId = admin.id;
  const base = { tipo: "natural", horaInicio: "08:00", horaFin: "12:00" };
  userId = (await prisma.user.create({ data: { cedula: `${PREFIX}001`, nombre: "Prueba Uno", ...base } })).id;
  otroId = (await prisma.user.create({ data: { cedula: `${PREFIX}002`, nombre: "Prueba Dos", ...base } })).id;
  inactivoId = (await prisma.user.create({ data: { cedula: `${PREFIX}003`, nombre: "Prueba Tres", activo: false, ...base } })).id;
});

beforeEach(async () => {
  const ids = [userId, otroId, inactivoId];
  await prisma.attendanceLog.updateMany({ where: { userId: { in: ids } }, data: { reemplazaAId: null } });
  await prisma.attendanceLog.deleteMany({ where: { userId: { in: ids } } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const base = () => ({ adminId, motivo: "Se olvidó marcar" });
const validas = (uid: string) => prisma.attendanceLog.findMany({ where: { userId: uid, ...MARCACION_VALIDA }, orderBy: { marcadoEn: "asc" } });

describe("registrarSalida", () => {
  it("cierra una entrada abierta de ayer y suma el tramo", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    const r = await registrarSalida({ ...base(), entradaId: entrada.id, hora: ayer(12) });
    expect(r).toEqual({ ok: true });
    const lista = await validas(userId);
    expect(sumWorkedMs(lista, { maxDailyMs: 10 * HOUR })).toBe(4 * HOUR);
    expect(lista[1]).toMatchObject({ tipo: "OUT", metodo: "manual", deviceId: "coordinacion", registradoPorId: adminId, motivo: "Se olvidó marcar" });
  });

  it("rechaza una hora anterior a la entrada", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    const r = await registrarSalida({ ...base(), entradaId: entrada.id, hora: ayer(7) });
    expect(r).toEqual({ ok: false, field: "hora", message: MENSAJE.salidaAntesDeEntrada });
  });

  it("rechaza una hora futura", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    const r = await registrarSalida({ ...base(), entradaId: entrada.id, hora: new Date(Date.now() + HOUR) });
    expect(r).toEqual({ ok: false, field: "hora", message: MENSAJE.futuro });
  });

  it("rechaza un motivo corto", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    const r = await registrarSalida({ adminId, motivo: "a", entradaId: entrada.id, hora: ayer(12) });
    expect(r).toEqual({ ok: false, field: "motivo", message: MENSAJE.motivoCorto });
  });
});

describe("registrarEntrada", () => {
  it("agrega la entrada que falta antes de una salida", async () => {
    const salida = await marca(userId, "OUT", ayer(12));
    const r = await registrarEntrada({ ...base(), salidaId: salida.id, hora: ayer(8) });
    expect(r).toEqual({ ok: true });
    expect(findInconsistencias(await validas(userId), new Date())).toEqual([]);
  });
});

describe("corregirHora", () => {
  it("anula la original y crea una copia que la reemplaza", async () => {
    await marca(userId, "IN", ayer(8));
    const salida = await marca(userId, "OUT", ayer(12));
    const r = await corregirHora({ ...base(), marcaId: salida.id, hora: ayer(11) });
    expect(r).toEqual({ ok: true });
    const original = await prisma.attendanceLog.findUniqueOrThrow({ where: { id: salida.id } });
    expect(original.anuladaEn).not.toBeNull();
    expect(original.anuladaPorId).toBe(adminId);
    const nueva = (await validas(userId))[1];
    expect(nueva).toMatchObject({ tipo: "OUT", metodo: "manual", reemplazaAId: salida.id });
    expect(nueva.marcadoEn.getTime()).toBe(ayer(11).getTime());
  });

  it("rechaza una hora que rompe la alternancia", async () => {
    await marca(userId, "IN", ayer(8));
    await marca(userId, "OUT", ayer(12));
    const entrada2 = await marca(userId, "IN", ayer(14));
    const r = await corregirHora({ ...base(), marcaId: entrada2.id, hora: ayer(10) });
    expect(r).toEqual({ ok: false, field: "hora", message: MENSAJE.desorden });
  });
});

describe("concurrencia", () => {
  it("dos correcciones simultáneas de la misma marca dejan una sola copia válida", async () => {
    await marca(userId, "IN", ayer(8));
    const salida = await marca(userId, "OUT", ayer(12));
    const [a, b] = await Promise.all([
      corregirHora({ ...base(), marcaId: salida.id, hora: ayer(11) }),
      corregirHora({ ...base(), marcaId: salida.id, hora: ayer(10) }),
    ]);
    expect([a, b].filter((r) => r.ok)).toHaveLength(1);
    const fallo = [a, b].find((r) => !r.ok);
    expect(fallo).toMatchObject({ ok: false });
    expect((await validas(userId)).filter((m) => m.tipo === "OUT")).toHaveLength(1);
    const reemplazos = await prisma.attendanceLog.count({ where: { reemplazaAId: salida.id } });
    expect(reemplazos).toBe(1);
  });

  it("anular dos veces la misma marca no pisa la primera anulación", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    await anular({ adminId, motivo: "Primer motivo", marcaId: entrada.id, incluirPareja: false });
    const r = await anular({ adminId, motivo: "Segundo motivo", marcaId: entrada.id, incluirPareja: false });
    expect(r).toEqual({ ok: false, message: MENSAJE.noExiste });
    const fila = await prisma.attendanceLog.findUniqueOrThrow({ where: { id: entrada.id } });
    expect(fila.motivoAnulacion).toBe("Primer motivo");
  });
});

describe("anular", () => {
  it("sin pareja deja la salida sin entrada", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    await marca(userId, "OUT", ayer(12));
    expect(await anular({ ...base(), marcaId: entrada.id, incluirPareja: false })).toEqual({ ok: true });
    const inc = findInconsistencias(await validas(userId), new Date());
    expect(inc.map((i) => i.tipo)).toEqual(["sin-entrada"]);
  });

  it("con pareja anula ambas", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    await marca(userId, "OUT", ayer(12));
    expect(await anular({ ...base(), marcaId: entrada.id, incluirPareja: true })).toEqual({ ok: true });
    expect(await validas(userId)).toHaveLength(0);
  });

  it("parejaDe devuelve la otra mitad de la jornada", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    const salida = await marca(userId, "OUT", ayer(12));
    expect((await parejaDe(entrada.id))?.id).toBe(salida.id);
    expect((await parejaDe(salida.id))?.id).toBe(entrada.id);
  });
});

describe("restaurar", () => {
  it("rechaza una marca ya reemplazada por una corrección", async () => {
    await marca(userId, "IN", ayer(8));
    const salida = await marca(userId, "OUT", ayer(12));
    await corregirHora({ ...base(), marcaId: salida.id, hora: ayer(11) });
    expect(await restaurar({ ...base(), marcaId: salida.id })).toEqual({ ok: false, message: MENSAJE.reemplazada });
  });

  it("restaura una anulada sin reemplazo", async () => {
    await marca(userId, "IN", ayer(8));
    const salida = await marca(userId, "OUT", ayer(12));
    await anular({ ...base(), marcaId: salida.id, incluirPareja: false });
    expect(await restaurar({ ...base(), marcaId: salida.id })).toEqual({ ok: true });
    const lista = await validas(userId);
    expect(lista).toHaveLength(2);
    expect(lista[1].reemplazaAId).toBe(salida.id);
  });

  it("rechaza una marca que no está anulada", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    expect(await restaurar({ ...base(), marcaId: entrada.id })).toEqual({ ok: false, message: MENSAJE.noAnulada });
  });
});

describe("reasignar", () => {
  it("rechaza el mismo usuario", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    const r = await reasignar({ ...base(), marcaId: entrada.id, destinoUserId: userId });
    expect(r).toEqual({ ok: false, field: "destino", message: MENSAJE.mismoUsuario });
  });

  it("rechaza un destino inactivo", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    const r = await reasignar({ ...base(), marcaId: entrada.id, destinoUserId: inactivoId });
    expect(r).toEqual({ ok: false, field: "destino", message: MENSAJE.destinoInactivo });
  });

  it("rechaza un destino al que no le encaja", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    await marca(otroId, "IN", ayer(7));
    await marca(otroId, "OUT", ayer(9));
    const r = await reasignar({ ...base(), marcaId: entrada.id, destinoUserId: otroId });
    expect(r).toEqual({ ok: false, field: "destino", message: MENSAJE.desorden });
  });

  it("pasa la marca al destino y anula la original", async () => {
    const entrada = await marca(userId, "IN", ayer(8));
    expect(await reasignar({ ...base(), marcaId: entrada.id, destinoUserId: otroId })).toEqual({ ok: true });
    const original = await prisma.attendanceLog.findUniqueOrThrow({ where: { id: entrada.id } });
    expect(original.anuladaEn).not.toBeNull();
    expect((await validas(otroId))[0]).toMatchObject({ tipo: "IN", metodo: "manual", reemplazaAId: entrada.id });
    expect(await validas(userId)).toHaveLength(0);
  });
});
