import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getFaceDescriptor } from "@/lib/server/faceEngine";
import { descriptorToBuffer } from "@/lib/server/faceMatcher";
import { type ConfigValues, DEFAULT_CONFIG } from "@/lib/configRules";
import { prisma } from "@/lib/server/prisma";
import { POST } from "./route";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "faces");

async function loadFixture(filename: string): Promise<Buffer> {
  return readFile(path.join(fixturesDir, filename));
}

function buildRequest(photo: Buffer, deviceId: string): Request {
  const formData = new FormData();
  // `photo` is always backed by a real ArrayBuffer (it comes from fs readFile / Buffer.from
  // in this codebase, never a SharedArrayBuffer). TypeScript's declared `Buffer` type is
  // generic over the wider ArrayBufferLike, but the DOM `BlobPart` type requires the
  // concrete ArrayBuffer-backed form, so assert the narrower, always-true type here.
  formData.append("foto", new Blob([photo as Buffer<ArrayBuffer>], { type: "image/jpeg" }), "foto.jpg");
  formData.append("deviceId", deviceId);
  return new Request("http://localhost/api/marcacion", { method: "POST", body: formData });
}

let userId = "";
let savedConfig: Awaited<ReturnType<typeof prisma.configuracion.findUnique>> = null;

/** Fija las reglas de 4g para una prueba; afterAll restaura las originales. */
async function setConfig(values: Partial<ConfigValues>) {
  const merged = { ...DEFAULT_CONFIG, ...values };
  await prisma.configuracion.upsert({
    where: { id: 1 },
    create: { id: 1, ...merged },
    update: merged,
  });
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

beforeAll(async () => {
  savedConfig = await prisma.configuracion.findUnique({ where: { id: 1 } });

  const enrollmentDescriptor = await getFaceDescriptor(await loadFixture("persona-a-2.jpg"));

  const user = await prisma.user.create({
    data: {
      cedula: "TEST-0001",
      nombre: "Persona A de Prueba",
      email: "persona-a@example.com",
      universidad: "Universidad de Prueba",
      entidad: "Entidad de Prueba",
    },
  });
  userId = user.id;
  await setConfig({ minMinutosAntesSalida: 0 });

  await prisma.faceEmbedding.create({
    data: {
      userId,
      embedding: descriptorToBuffer(enrollmentDescriptor),
      modelo: "face-api-recognition-v1",
    },
  });
}, 20000);

afterEach(async () => {
  if (!userId) return;
  await prisma.attendanceLog.deleteMany({ where: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { horaInicio: null } });
  // Por defecto sin mínimo antes de salida, para que las pruebas de SALIDA no
  // dependan de la hora a la que corren.
  await setConfig({ minMinutosAntesSalida: 0 });
});

afterAll(async () => {
  if (savedConfig) {
    const { toleranciaLlegadaMin, minMinutosAntesSalida, exigenciaReconocimiento, intentosAntesQr, jornadaMaximaHoras, actualizadoPor } =
      savedConfig;
    await prisma.configuracion.update({
      where: { id: 1 },
      data: { toleranciaLlegadaMin, minMinutosAntesSalida, exigenciaReconocimiento, intentosAntesQr, jornadaMaximaHoras, actualizadoPor },
    });
  } else {
    await prisma.configuracion.deleteMany({ where: { id: 1 } });
  }
  if (!userId) return;
  await prisma.faceEmbedding.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
});

describe("POST /api/marcacion", () => {
  it(
    "marca IN la primera vez que reconoce a un usuario enrolado",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.matched).toBe(true);
      expect(body.nombre).toBe("Persona A de Prueba");
      expect(body.tipo).toBe("IN");
    },
    20000
  );

  it(
    "incluye universidad y entidad para la pantalla de éxito del kiosko",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.universidad).toBe("Universidad de Prueba");
      expect(body.entidad).toBe("Entidad de Prueba");
    },
    20000
  );

  it(
    "en la SALIDA devuelve la jornada de hoy y las horas acumuladas",
    async () => {
      const ahora = new Date();
      const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      // Hace 2 h, pero nunca antes de medianoche: si no, la entrada caería
      // en el día anterior y la marcación sería otra ENTRADA.
      const entradaHoy = new Date(Math.max(ahora.getTime() - 2 * 60 * 60 * 1000, inicioDeHoy.getTime()));
      const jornadaEsperada = ahora.getTime() - entradaHoy.getTime();
      const ayer = new Date(inicioDeHoy.getTime() - 12 * 60 * 60 * 1000);
      await prisma.attendanceLog.createMany({
        data: [
          // Jornada completa de ayer: 3 h que solo cuentan en el acumulado.
          { userId, tipo: "IN", metodo: "face", deviceId: "kiosko-test", marcadoEn: ayer },
          {
            userId,
            tipo: "OUT",
            metodo: "face",
            deviceId: "kiosko-test",
            marcadoEn: new Date(ayer.getTime() + 3 * 60 * 60 * 1000),
          },
          // Entrada de hoy, todavía abierta.
          { userId, tipo: "IN", metodo: "face", deviceId: "kiosko-test", marcadoEn: entradaHoy },
        ],
      });

      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.tipo).toBe("OUT");
      const tresHoras = 3 * 60 * 60 * 1000;
      expect(body.jornadaMs).toBeGreaterThanOrEqual(jornadaEsperada);
      expect(body.jornadaMs).toBeLessThan(jornadaEsperada + 60_000);
      expect(body.acumuladoMs).toBeGreaterThanOrEqual(jornadaEsperada + tresHoras);
      expect(body.acumuladoMs).toBeLessThan(jornadaEsperada + tresHoras + 60_000);
    },
    20000
  );

  it(
    "no registra la SALIDA antes del mínimo configurado y dice desde cuándo se puede",
    async () => {
      await setConfig({ minMinutosAntesSalida: 60 });
      const entrada = new Date();
      await prisma.attendanceLog.create({
        data: { userId, tipo: "IN", metodo: "face", deviceId: "kiosko-test", marcadoEn: entrada },
      });

      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.bloqueado).toBe("salida-anticipada");
      expect(body.entrada).toBe(entrada.toISOString());
      expect(new Date(body.disponibleDesde).getTime()).toBe(entrada.getTime() + 60 * 60_000);
      expect(await prisma.attendanceLog.count({ where: { userId } })).toBe(1);
    },
    20000
  );

  it(
    "marca la ENTRADA como tarde cuando se pasa de la tolerancia",
    async () => {
      await setConfig({ toleranciaLlegadaMin: 10 });
      const ahora = new Date();
      const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      // Hora de inicio hace 30 min (o medianoche si aún no pasan 30 min del día).
      const inicio = new Date(Math.max(ahora.getTime() - 30 * 60_000, inicioDeHoy.getTime()));
      await prisma.user.update({ where: { id: userId }, data: { horaInicio: hhmm(inicio) } });
      const esperado = Math.floor((ahora.getTime() - new Date(inicio).setSeconds(0, 0)) / 60_000);

      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.tipo).toBe("IN");
      if (esperado > 10) {
        expect(body.tardeMin).toBeGreaterThanOrEqual(esperado);
        expect(body.tardeMin).toBeLessThanOrEqual(esperado + 1);
      } else {
        expect(body.tardeMin).toBeNull();
      }
    },
    20000
  );

  it(
    "sin coincidencia informa cuántos intentos hay antes de ofrecer el QR",
    async () => {
      await setConfig({ intentosAntesQr: 5 });
      const response = await POST(buildRequest(await loadFixture("persona-b-1.jpg"), "kiosko-test"));
      expect(await response.json()).toEqual({ matched: false, intentosAntesQr: 5 });
    },
    20000
  );

  it(
    "responde matched:false para un rostro no enrolado",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-b-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.matched).toBe(false);
    },
    20000
  );
});
