import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { anular, corregirHora, reasignar } from "./correccionService";
import { getMarcacionesDelDia, getPerfil, listPendientes } from "./marcacionesQuery";
import { prisma } from "./prisma";

// Prefijo propio para no chocar con datos reales del entorno de desarrollo.
const PREFIX = "990090";
const HOUR = 60 * 60 * 1000;
const SEDE_A = "Zz Sede Consulta A";
const SEDE_B = "Zz Sede Consulta B";
let adminId: string;
let sedeA: number;
let sedeB: number;
let userId: string; // sede A
let inactivoId: string; // sede A, inactivo
let otroId: string; // sede B

/** Hora local de hace `dias` días. */
function dia(dias: number, h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(h, m, 0, 0);
  return d;
}

async function marca(uid: string, tipo: "IN" | "OUT", marcadoEn: Date, metodo = "face") {
  return prisma.attendanceLog.create({ data: { userId: uid, tipo, metodo, deviceId: "t", marcadoEn } });
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { cedula: { startsWith: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.attendanceLog.updateMany({ where: { userId: { in: ids } }, data: { reemplazaAId: null } });
  await prisma.attendanceLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.admin.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.sede.deleteMany({ where: { nombre: { in: [SEDE_A, SEDE_B] } } });
}

beforeAll(async () => {
  await cleanup();
  adminId = (await prisma.admin.create({ data: { email: `${PREFIX}@test.local`, nombre: "Admin Prueba", passwordHash: "x" } })).id;
  sedeA = (await prisma.sede.create({ data: { nombre: SEDE_A } })).id;
  sedeB = (await prisma.sede.create({ data: { nombre: SEDE_B } })).id;
  const base = { tipo: "natural", horaInicio: "08:00", horaFin: "17:00" };
  userId = (await prisma.user.create({ data: { cedula: `${PREFIX}001`, nombre: "Consulta Uno", sedeId: sedeA, ...base } })).id;
  inactivoId = (await prisma.user.create({ data: { cedula: `${PREFIX}002`, nombre: "Consulta Dos", sedeId: sedeA, activo: false, ...base } })).id;
  otroId = (await prisma.user.create({ data: { cedula: `${PREFIX}003`, nombre: "Consulta Tres", sedeId: sedeB, ...base } })).id;
});

beforeEach(async () => {
  const ids = [userId, inactivoId, otroId];
  await prisma.attendanceLog.updateMany({ where: { userId: { in: ids } }, data: { reemplazaAId: null } });
  await prisma.attendanceLog.deleteMany({ where: { userId: { in: ids } } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("getPerfil", () => {
  it("separa pares cerrados, jornada abierta e inconsistencias", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(2, 8));
    await marca(userId, "OUT", dia(2, 12));
    const abiertaAyer = await marca(userId, "IN", dia(1, 8));
    const hoy = await marca(userId, "IN", dia(0, 9));

    const perfil = await getPerfil(userId, 1, now);
    expect(perfil).not.toBeNull();
    expect(perfil!.inconsistencias).toHaveLength(1);
    expect(perfil!.inconsistencias[0]).toMatchObject({ tipo: "sin-salida", marca: { id: abiertaAyer.id } });
    expect(perfil!.jornadaAbierta?.id).toBe(hoy.id);
    expect(perfil!.avance.workedMs).toBe(4 * HOUR);
    expect(perfil!.dias[0]!.marcas.map((m) => m.id)).toEqual([hoy.id]);
    expect(perfil!.user).toMatchObject({ nombre: "Consulta Uno", horaFin: "17:00", sede: SEDE_A });
    expect(perfil!.sugerencia.horaFin).toBe("17:00");
    expect(perfil!.pages).toBe(1);
  });

  it("incluye las anuladas en dias pero no en avance", async () => {
    const now = dia(0, 15);
    const entrada = await marca(userId, "IN", dia(2, 8));
    await marca(userId, "OUT", dia(2, 12));
    await anular({ adminId, motivo: "Marcada por error", marcaId: entrada.id, incluirPareja: false, now });

    const perfil = await getPerfil(userId, 1, now);
    const marcas = perfil!.dias.flatMap((d) => d.marcas);
    expect(marcas).toHaveLength(2);
    const anulada = marcas.find((m) => m.id === entrada.id)!;
    expect(anulada).toMatchObject({ anuladaPor: "Admin Prueba", motivoAnulacion: "Marcada por error" });
    expect(anulada.anuladaEn).not.toBeNull();
    expect(perfil!.avance.workedMs).toBe(0);
    expect(perfil!.inconsistencias.map((i) => i.tipo)).toEqual(["sin-entrada"]);
  });

  it("las horas del avance son la suma de las jornadas de dias (sin tope)", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(3, 8));
    await marca(userId, "OUT", dia(3, 11));
    await marca(userId, "IN", dia(2, 9));
    await marca(userId, "OUT", dia(2, 14));
    const abierta = await marca(userId, "IN", dia(1, 8)); // sin salida
    await marca(userId, "OUT", dia(0, 10)); // salida huérfana de hoy: no se empareja con la de ayer
    expect(abierta.id).toBeTruthy();

    const perfil = await getPerfil(userId, 1, now);
    expect(perfil!.dias.reduce((n, d) => n + d.jornadaMs, 0)).toBe(8 * HOUR);
    expect(perfil!.avance.workedMs).toBe(perfil!.dias.reduce((n, d) => n + d.jornadaMs, 0));
  });

  it("marca como reemplazada la anulada que ya tiene una corrección válida", async () => {
    const now = dia(0, 15);
    const entrada = await marca(userId, "IN", dia(2, 8));
    await marca(userId, "OUT", dia(2, 12));
    const suelta = await marca(userId, "IN", dia(1, 8));
    await marca(userId, "OUT", dia(1, 12));
    await corregirHora({ adminId, motivo: "Hora mal marcada", marcaId: entrada.id, hora: dia(2, 8, 30), now });
    const reasignada = await marca(userId, "IN", dia(3, 8));
    await reasignar({ adminId, motivo: "Era otra persona", marcaId: reasignada.id, destinoUserId: otroId, now });
    await anular({ adminId, motivo: "Marcada por error", marcaId: suelta.id, incluirPareja: false, now });

    const perfil = await getPerfil(userId, 1, now);
    const marcas = perfil!.dias.flatMap((d) => d.marcas);
    const por = (id: string) => marcas.find((m) => m.id === id)!;
    expect(por(entrada.id)).toMatchObject({ anuladaEn: expect.any(Date), reemplazada: true });
    expect(por(reasignada.id)).toMatchObject({ anuladaEn: expect.any(Date), reemplazada: true });
    expect(por(suelta.id)).toMatchObject({ anuladaEn: expect.any(Date), reemplazada: false });
    expect(marcas.filter((m) => !m.anuladaEn).every((m) => !m.reemplazada)).toBe(true);
  });

  it("devuelve null si el usuario no existe", async () => {
    expect(await getPerfil("no-existe", 1)).toBeNull();
  });
});

describe("listPendientes", () => {
  it("coincide con findInconsistencias y excluye usuarios inactivos", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(1, 8));
    await marca(userId, "IN", dia(3, 8));
    await marca(userId, "OUT", dia(3, 12));
    await marca(inactivoId, "IN", dia(1, 8));
    await marca(userId, "OUT", dia(5, 10)); // sin entrada

    const perfil = await getPerfil(userId, 1, now);
    const { rows, total } = await listPendientes({ sede: sedeA }, { limit: 50, offset: 0 }, now);

    expect(total).toBe(2);
    expect(rows.map((r) => r.inconsistencia.marca.id).sort()).toEqual(
      perfil!.inconsistencias.map((i) => i.marca.id).sort(),
    );
    expect(rows.every((r) => r.user.id === userId)).toBe(true);
    const salida = rows.find((r) => r.inconsistencia.tipo === "sin-salida")!;
    expect(salida.horaSugerida).toBe("17:00");
    expect(rows.find((r) => r.inconsistencia.tipo === "sin-entrada")!.horaSugerida).toBeNull();
  });

  it("pagina", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(1, 8));
    await marca(userId, "IN", dia(2, 8));
    await marca(userId, "IN", dia(3, 8));
    const p1 = await listPendientes({ sede: sedeA }, { limit: 2, offset: 0 }, now);
    const p2 = await listPendientes({ sede: sedeA }, { limit: 2, offset: 2 }, now);
    expect(p1.total).toBe(3);
    expect(p1.rows).toHaveLength(2);
    expect(p2.rows).toHaveLength(1);
  });

  it("agrupa por día local: 18:00 y 20:00 de ayer son un par, aunque crucen medianoche UTC", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(1, 18));
    await marca(userId, "OUT", dia(1, 20));
    const { rows, total } = await listPendientes({ sede: sedeA }, { limit: 50, offset: 0 }, now);
    expect(total).toBe(0);
    expect(rows).toEqual([]);
  });

  it("no cuenta las anuladas y filtra por sede", async () => {
    const now = dia(0, 15);
    const entrada = await marca(userId, "IN", dia(1, 8));
    await marca(otroId, "IN", dia(1, 8));
    await anular({ adminId, motivo: "Error de marca", marcaId: entrada.id, incluirPareja: false, now });
    expect((await listPendientes({ sede: sedeA }, { limit: 50, offset: 0 }, now)).total).toBe(0);
    const b = await listPendientes({ sede: sedeB }, { limit: 50, offset: 0 }, now);
    expect(b.rows.map((r) => r.user.id)).toEqual([otroId]);
  });

  it("una entrada de hoy sin salida no es pendiente, una salida de hoy sin entrada sí", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(0, 8));
    await marca(otroId, "OUT", dia(0, 9));
    expect((await listPendientes({ sede: sedeA }, { limit: 50, offset: 0 }, now)).total).toBe(0);
    expect((await listPendientes({ sede: sedeB }, { limit: 50, offset: 0 }, now)).total).toBe(1);
  });
});

describe("getMarcacionesDelDia", () => {
  it("resume dentro, ya salieron y salidas tempranas; filtra por sede", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(0, 8, 30)); // 30 min tarde, dentro
    await marca(otroId, "IN", dia(0, 8));
    await marca(otroId, "OUT", dia(0, 12)); // salió antes de las 17:00
    const sinEntrada = await marca(otroId, "OUT", dia(0, 13)); // anulada abajo
    await anular({ adminId, motivo: "Error de marca", marcaId: sinEntrada.id, incluirPareja: false, now });

    const a = await getMarcacionesDelDia({ sede: sedeA }, now);
    expect(a.rows.map((r) => r.user.id)).toEqual([userId]);
    expect(a.resumen).toMatchObject({ dentroAhora: 1, yaSalieron: 0, tarde: 1, salidasTempranas: 0 });

    const b = await getMarcacionesDelDia({ sede: sedeB }, now);
    expect(b.rows.map((r) => r.marca.tipo)).toEqual(["OUT", "IN"]);
    expect(b.rows.every((r) => r.marca.anuladaEn === null)).toBe(true);
    expect(b.resumen).toMatchObject({ dentroAhora: 0, yaSalieron: 1, tarde: 0, salidasTempranas: 1 });
    expect(b.rows[0]!.marca.novedades).toEqual([{ tipo: "salida-temprana" }]);
  });

  it("cuenta dentro y ya salió en el mismo alcance", async () => {
    const now = dia(0, 15);
    await marca(userId, "IN", dia(0, 8));
    const otroEnA = await prisma.user.create({ data: { cedula: `${PREFIX}004`, nombre: "Consulta Cuatro", sedeId: sedeA, tipo: "natural", horaInicio: "08:00", horaFin: "12:00" } });
    await marca(otroEnA.id, "IN", dia(0, 8));
    await marca(otroEnA.id, "OUT", dia(0, 12));
    const r = await getMarcacionesDelDia({ sede: sedeA }, now);
    expect(r.resumen).toMatchObject({ dentroAhora: 1, yaSalieron: 1, salidasTempranas: 0 });
    expect(r.rows).toHaveLength(3);
  });
});
