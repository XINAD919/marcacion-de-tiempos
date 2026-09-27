import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getFaceDescriptor } from "@/lib/server/faceEngine";
import { descriptorToBuffer } from "@/lib/server/faceMatcher";
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

beforeAll(async () => {
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
});

afterAll(async () => {
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
    "responde matched:false para un rostro no enrolado",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-b-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.matched).toBe(false);
    },
    20000
  );
});
