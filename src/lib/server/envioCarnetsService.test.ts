import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SendCarnetResult } from "./carnet";

// El tope por hora no depende de lo que haya guardado en Configuración.
const config = vi.hoisted(() => ({ porHora: 100 }));
vi.mock("./config", () => ({ getConfig: async () => ({ carnetsPorHora: config.porHora }) }));

import {
  PENDIENTE_WHERE,
  contarPendientes,
  envioActivo,
  getEnvio,
  iniciarEnvio,
  pausarEnvio,
  procesarSiguiente,
  reanudarEnvio,
  recuperarAlArrancar,
} from "./envioCarnetsService";
import { prisma } from "./prisma";

// Prefijo propio para no chocar con datos reales del entorno de desarrollo.
const PREFIX = "990091";
const ADMIN_EMAIL = `${PREFIX}@envio-carnets.test`;
let adminId: string;
const ids: Record<string, string> = {};

async function crearUsuario(clave: string, extra: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: { cedula: `${PREFIX}${clave}`, nombre: `Prueba ${clave}`, email: `${PREFIX}${clave}@correo.test`, ...extra },
  });
  ids[clave] = user.id;
  return user;
}

async function limpiarEnvios() {
  const envios = await prisma.envioCarnets.findMany({
    where: { OR: [{ iniciadoPorId: adminId }, { items: { some: { user: { cedula: { startsWith: PREFIX } } } } }] },
    select: { id: true },
  });
  const envioIds = envios.map((envio) => envio.id);
  await prisma.envioCarnetItem.deleteMany({ where: { envioId: { in: envioIds } } });
  await prisma.envioCarnets.deleteMany({ where: { id: { in: envioIds } } });
}

async function limpiar() {
  const admin = await prisma.admin.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } });
  if (admin) adminId = admin.id;
  if (adminId) await limpiarEnvios();
  const users = await prisma.user.findMany({ where: { cedula: { startsWith: PREFIX } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  await prisma.envioCarnetItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.carnetVirtual.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.admin.deleteMany({ where: { email: ADMIN_EMAIL } });
}

beforeAll(async () => {
  await limpiar();
  adminId = (await prisma.admin.create({ data: { email: ADMIN_EMAIL, nombre: "Admin prueba", passwordHash: "x" } })).id;
});

afterEach(async () => {
  config.porHora = 100;
  await limpiarEnvios();
  await prisma.carnetVirtual.deleteMany({ where: { user: { cedula: { startsWith: PREFIX } } } });
  await prisma.user.deleteMany({ where: { cedula: { startsWith: PREFIX } } });
  for (const key of Object.keys(ids)) delete ids[key];
});

afterAll(async () => {
  await limpiar();
  await prisma.$disconnect();
});

const ahora = () => new Date();
const mas = (base: Date, ms: number) => new Date(base.getTime() + ms);

function enviarSimulado(extra?: (userId: string) => Promise<SendCarnetResult> | undefined) {
  const llamadas: string[] = [];
  const enviar = vi.fn(async (userId: string): Promise<SendCarnetResult> => {
    llamadas.push(userId);
    return (await extra?.(userId)) ?? { ok: true, to: "x@y.z", enviadoEn: new Date() };
  });
  return { enviar, llamadas };
}

async function estadoItem(envioId: string, clave: string) {
  return prisma.envioCarnetItem.findUniqueOrThrow({ where: { envioId_userId: { envioId, userId: ids[clave] } } });
}

/** Procesa con el reloj avanzando 40 s por paso hasta que `hasta` se cumpla. */
async function avanzarHasta(deps: Parameters<typeof procesarSiguiente>[0], hasta: () => Promise<boolean>, inicio = ahora()) {
  let now = inicio;
  for (let i = 0; i < 20 && !(await hasta()); i++) {
    await procesarSiguiente({ ...deps, now });
    now = mas(now, 40_000);
  }
  return now;
}

async function iniciar() {
  const r = await iniciarEnvio(adminId);
  if (!r.ok) throw new Error(`No inició: ${r.reason}`);
  return r.envioId;
}

describe("pendientes", () => {
  it("excluye inactivos, sin correo y con carnet ya enviado; incluye carnet sin enviar", async () => {
    const antes = await contarPendientes();
    await crearUsuario("001");
    await crearUsuario("002", { activo: false });
    await crearUsuario("003", { email: null });
    const enviado = await crearUsuario("004");
    await prisma.carnetVirtual.create({ data: { userId: enviado.id, token: `${PREFIX}t4`, enviadoEn: new Date() } });
    const sinEnviar = await crearUsuario("005");
    await prisma.carnetVirtual.create({ data: { userId: sinEnviar.id, token: `${PREFIX}t5`, enviadoEn: null } });
    expect(await contarPendientes()).toBe(antes + 2);
  });
});

describe("iniciarEnvio", () => {
  it("toma una instantánea y rechaza un segundo envío", async () => {
    await crearUsuario("001");
    const envioId = await iniciar();
    await crearUsuario("002"); // creado después: no entra
    const items = await prisma.envioCarnetItem.findMany({ where: { envioId } });
    expect(items.map((i) => i.userId)).toContain(ids["001"]);
    expect(items.map((i) => i.userId)).not.toContain(ids["002"]);
    expect(items.every((i) => i.estado === "pendiente")).toBe(true);
    const envio = await prisma.envioCarnets.findUniqueOrThrow({ where: { id: envioId } });
    expect(envio).toMatchObject({ estado: "en-curso", total: items.length });
    expect(await iniciarEnvio(adminId)).toEqual({ ok: false, reason: "hay-otro", envioId });
    expect((await envioActivo())?.id).toBe(envioId);
  });

  it("sin pendientes no crea nada", async () => {
    // La base de desarrollo puede tener pendientes reales: se acota el filtro a nadie, sin tocar datos.
    PENDIENTE_WHERE.id = "no-existe";
    try {
      expect(await iniciarEnvio(adminId)).toEqual({ ok: false, reason: "sin-pendientes" });
    } finally {
      delete PENDIENTE_WHERE.id;
    }
    expect(await envioActivo()).toBeNull();
  });
});

describe("procesarSiguiente", () => {
  it("sin envío en curso no hace nada", async () => {
    expect(await procesarSiguiente({ enviar: enviarSimulado().enviar })).toBe("sin-envio");
  });

  it("dos pasos en paralelo no envían dos veces el mismo item", async () => {
    await crearUsuario("001");
    await crearUsuario("002");
    await iniciar();
    const { enviar, llamadas } = enviarSimulado();
    const now = ahora();
    const resultados = await Promise.all([procesarSiguiente({ enviar, now }), procesarSiguiente({ enviar, now })]);
    expect(resultados).toEqual(["enviado", "enviado"]);
    expect(new Set(llamadas).size).toBe(llamadas.length);
    expect(llamadas).toHaveLength(2);
  });

  it("un error global pausa el envío y devuelve el item a pendiente", async () => {
    await crearUsuario("001");
    const envioId = await iniciar();
    const { enviar, llamadas } = enviarSimulado(() => Promise.reject({ code: "EAUTH" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await procesarSiguiente({ enviar, now: ahora() })).toBe("pausado");
    const envio = await prisma.envioCarnets.findUniqueOrThrow({ where: { id: envioId } });
    expect(envio.estado).toBe("pausado");
    expect(envio.motivoPausa).toBe("El servidor de correo rechazó el usuario o la contraseña.");
    const reclamado = await prisma.envioCarnetItem.findFirstOrThrow({ where: { envioId, userId: llamadas[0] } });
    expect(reclamado.estado).toBe("pendiente");
    expect(await procesarSiguiente({ enviar, now: mas(ahora(), 3_600_000) })).toBe("sin-envio");
    expect(llamadas).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("un error del destinatario marca ese item y el envío sigue en curso", async () => {
    await crearUsuario("001");
    const envioId = await iniciar();
    const { enviar } = enviarSimulado(() => Promise.reject({ code: "EENVELOPE" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const inicio = ahora();
    const now = await avanzarHasta({ enviar }, async () => (await estadoItem(envioId, "001")).estado === "error", inicio);
    expect(now.getTime()).toBeGreaterThan(inicio.getTime());
    const item = await estadoItem(envioId, "001");
    expect(item.motivoError).toBe("El servidor de correo rechazó la dirección de destino o del remitente.");
    expect((await prisma.envioCarnets.findUniqueOrThrow({ where: { id: envioId } })).estado).toBe("en-curso");
    vi.restoreAllMocks();
  });

  it("omite a quien recibió su carnet por su cuenta, y eso cuenta para el tope de la hora", async () => {
    await crearUsuario("001");
    const envioId = await iniciar();
    const individual = new Date();
    await prisma.carnetVirtual.create({ data: { userId: ids["001"], token: `${PREFIX}t1`, enviadoEn: individual } });
    const { enviar, llamadas } = enviarSimulado();
    await avanzarHasta({ enviar }, async () => (await estadoItem(envioId, "001")).estado === "omitido");
    expect((await estadoItem(envioId, "001")).estado).toBe("omitido");
    expect(llamadas).not.toContain(ids["001"]);

    // Con tope de 1 por hora, ese envío individual llena la ventana: hay que esperar.
    config.porHora = 1;
    await prisma.envioCarnetItem.updateMany({ where: { envioId, estado: { not: "omitido" } }, data: { estado: "pendiente" } });
    expect(await procesarSiguiente({ enviar, now: mas(individual, 10_000) })).toBe("esperando");
  });

  it("al reanudar justo después de pausar respeta el intervalo", async () => {
    await crearUsuario("001");
    await crearUsuario("002");
    const envioId = await iniciar();
    const { enviar } = enviarSimulado();
    const t0 = ahora();
    expect(await procesarSiguiente({ enviar, now: t0 })).toBe("enviado");
    expect(await pausarEnvio(envioId)).toBe(true);
    expect(await pausarEnvio(envioId)).toBe(false);
    expect(await procesarSiguiente({ enviar, now: mas(t0, 10_000) })).toBe("sin-envio");
    expect(await reanudarEnvio(envioId)).toBe(true);
    expect(await reanudarEnvio(envioId)).toBe(false);
    expect(await procesarSiguiente({ enviar, now: mas(t0, 10_000) })).toBe("esperando");
  });

  it("al acabarse los items termina el envío", async () => {
    await crearUsuario("001");
    const envioId = await iniciar();
    const { enviar } = enviarSimulado();
    let now = ahora();
    let ultimo = "";
    for (let i = 0; i < 20 && ultimo !== "terminado"; i++) {
      ultimo = await procesarSiguiente({ enviar, now });
      now = mas(now, 40_000);
    }
    expect(ultimo).toBe("terminado");
    const envio = await prisma.envioCarnets.findUniqueOrThrow({ where: { id: envioId } });
    expect(envio.estado).toBe("terminado");
    expect(envio.terminadoEn).not.toBeNull();
    expect(await envioActivo()).toBeNull();
    const detalle = await getEnvio(envioId);
    expect(detalle?.pendientes).toBe(0);
  });
});

describe("recuperarAlArrancar", () => {
  it("marca como error lo que quedó enviando hace más de 10 minutos", async () => {
    await crearUsuario("001");
    await crearUsuario("002");
    const envioId = await iniciar();
    const now = ahora();
    await prisma.envioCarnetItem.updateMany({
      where: { envioId, userId: ids["001"] },
      data: { estado: "enviando", intentadoEn: mas(now, -11 * 60_000) },
    });
    await prisma.envioCarnetItem.updateMany({
      where: { envioId, userId: ids["002"] },
      data: { estado: "enviando", intentadoEn: mas(now, -5 * 60_000) },
    });
    expect(await recuperarAlArrancar(now)).toBeGreaterThanOrEqual(1);
    const viejo = await estadoItem(envioId, "001");
    expect(viejo.estado).toBe("error");
    expect(viejo.motivoError).toBe("No sabemos si el correo llegó: el servidor se reinició mientras se enviaba");
    expect((await estadoItem(envioId, "002")).estado).toBe("enviando");
  });
});

describe("getEnvio", () => {
  it("lista los errores con nombre y correo", async () => {
    await crearUsuario("001");
    const envioId = await iniciar();
    await prisma.envioCarnetItem.updateMany({
      where: { envioId, userId: ids["001"] },
      data: { estado: "error", motivoError: "Motivo" },
    });
    const detalle = await getEnvio(envioId);
    expect(detalle?.erroresDetalle).toContainEqual({
      userId: ids["001"],
      nombre: "Prueba 001",
      email: `${PREFIX}001@correo.test`,
      motivo: "Motivo",
    });
    expect(await getEnvio("no-existe")).toBeNull();
  });
});
