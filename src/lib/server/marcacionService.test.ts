import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/configRules";
import { registrarMarcacion, type UsuarioMarcacion } from "./marcacionService";
import { prisma } from "./prisma";

// Prefijo propio para no chocar con datos reales del entorno de desarrollo.
const PREFIX = "990088";
const HOUR = 60 * 60 * 1000;
let userId: string;
let user: UsuarioMarcacion;

async function cleanup() {
  const users = await prisma.user.findMany({ where: { cedula: { startsWith: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.attendanceLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  await cleanup();
  user = await prisma.user.create({
    data: { cedula: `${PREFIX}001`, nombre: "Prueba Marcacion", tipo: "natural", horaInicio: "08:00", horaFin: "12:00" },
    include: { institucion: { select: { nombre: true } }, sede: { select: { nombre: true } } },
  });
  userId = user.id;
});

beforeEach(async () => {
  await prisma.attendanceLog.deleteMany({ where: { userId } });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("registrarMarcacion con marcaciones anuladas", () => {
  it("ignora una entrada anulada al decidir el tipo de la siguiente marcación", async () => {
    await prisma.attendanceLog.create({
      data: { userId, tipo: "IN", metodo: "face", deviceId: "t", marcadoEn: new Date(), anuladaEn: new Date(), motivoAnulacion: "prueba" },
    });
    const result = await registrarMarcacion(user, DEFAULT_CONFIG, { metodo: "qr", confianza: null, deviceId: "t" });
    expect(result).toMatchObject({ matched: true, tipo: "IN" });
  });

  it("no suma horas de una salida anulada en el acumulado del kiosko", async () => {
    // Reloj fijo a las 15:00 de hoy: las horas de la prueba son válidas a cualquier hora real.
    const hoy = (h: number) => new Date(new Date().setHours(h, 0, 0, 0));
    const ahora = hoy(15);
    vi.useFakeTimers({ toFake: ["Date"], now: ahora });
    try {
      // IN válida a las 12:00, OUT anulada a las 14:00.
      await prisma.attendanceLog.create({
        data: { userId, tipo: "IN", metodo: "face", deviceId: "t", marcadoEn: hoy(12) },
      });
      await prisma.attendanceLog.create({
        data: { userId, tipo: "OUT", metodo: "face", deviceId: "t", marcadoEn: hoy(14), anuladaEn: ahora, motivoAnulacion: "prueba" },
      });
      const result = await registrarMarcacion(user, DEFAULT_CONFIG, { metodo: "qr", confianza: null, deviceId: "t" });
      expect(result).toMatchObject({ matched: true, tipo: "OUT" });
      expect((result as { acumuladoMs: number }).acumuladoMs).toBe(3 * HOUR);
    } finally {
      vi.useRealTimers();
    }
  });
});
