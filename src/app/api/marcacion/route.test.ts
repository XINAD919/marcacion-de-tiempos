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
  formData.append("foto", new Blob([photo], { type: "image/jpeg" }), "foto.jpg");
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
    "responde matched:false para un rostro no enrolado",
    async () => {
      const response = await POST(buildRequest(await loadFixture("persona-b-1.jpg"), "kiosko-test"));
      const body = await response.json();

      expect(body.matched).toBe(false);
    },
    20000
  );
});
