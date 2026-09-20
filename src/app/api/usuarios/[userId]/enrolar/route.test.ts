import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/server/prisma";
import { POST } from "./route";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "faces");

async function loadFixture(filename: string): Promise<Buffer> {
  return readFile(path.join(fixturesDir, filename));
}

function buildRequest(photo: Buffer): Request {
  const formData = new FormData();
  formData.append("foto", new Blob([photo], { type: "image/jpeg" }), "foto.jpg");
  return new Request("http://localhost/api/usuarios/x/enrolar", { method: "POST", body: formData });
}

async function createTestUser(cedula: string) {
  return prisma.user.create({
    data: {
      cedula,
      nombre: "Persona de Prueba",
      email: `${cedula}@example.com`,
      universidad: "Universidad de Prueba",
      entidad: "Entidad de Prueba",
    },
  });
}

describe("POST /api/usuarios/[userId]/enrolar", () => {
  it(
    "guarda un embedding cuando la foto tiene exactamente un rostro",
    async () => {
      const user = await createTestUser("TEST-0002");

      const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg")), {
        params: Promise.resolve({ userId: user.id }),
      });

      expect(response.status).toBe(201);
      const embeddings = await prisma.faceEmbedding.findMany({ where: { userId: user.id } });
      expect(embeddings).toHaveLength(1);

      await prisma.faceEmbedding.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    },
    20000
  );

  it(
    "responde 422 cuando la foto no tiene rostro",
    async () => {
      const user = await createTestUser("TEST-0003");

      const response = await POST(buildRequest(await loadFixture("sin-rostro.jpg")), {
        params: Promise.resolve({ userId: user.id }),
      });

      expect(response.status).toBe(422);

      await prisma.user.delete({ where: { id: user.id } });
    },
    20000
  );
});
