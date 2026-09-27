import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/server/prisma";

const auth = vi.fn();
vi.mock("@/lib/server/auth", () => ({ auth: () => auth() }));

import { descriptorToBuffer } from "@/lib/server/faceMatcher";
import { DELETE, POST, PUT } from "./route";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "faces");

async function loadFixture(filename: string): Promise<Buffer> {
  return readFile(path.join(fixturesDir, filename));
}

function buildRequest(photo: Buffer): Request {
  const formData = new FormData();
  // `photo` is always backed by a real ArrayBuffer (it comes from fs readFile / Buffer.from
  // in this codebase, never a SharedArrayBuffer). TypeScript's declared `Buffer` type is
  // generic over the wider ArrayBufferLike, but the DOM `BlobPart` type requires the
  // concrete ArrayBuffer-backed form, so assert the narrower, always-true type here.
  formData.append("foto", new Blob([photo as Buffer<ArrayBuffer>], { type: "image/jpeg" }), "foto.jpg");
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
  beforeEach(() => {
    auth.mockReset();
    auth.mockResolvedValue({ user: { id: "test-admin" } });
  });

  it("responde 401 sin sesión", async () => {
    auth.mockResolvedValue(null);

    const response = await POST(buildRequest(await loadFixture("persona-a-1.jpg")), {
      params: Promise.resolve({ userId: "cualquier-id" }),
    });

    expect(response.status).toBe(401);
  });

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
      // Devuelve el id (para repetir o cancelar la foto) y la calidad de la captura.
      const body = await response.json();
      expect(body.id).toBe(embeddings[0]!.id);
      expect(["buena", "baja"]).toContain(body.calidad);

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

  describe("DELETE y PUT (repetir, cancelar y confirmar)", () => {
    async function withEmbeddings(cedula: string, count: number) {
      const user = await createTestUser(cedula);
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const embedding = await prisma.faceEmbedding.create({
          data: { userId: user.id, embedding: descriptorToBuffer(new Float32Array(128)), modelo: "test" },
        });
        ids.push(embedding.id);
      }
      return { user, ids };
    }

    async function remove(userId: string) {
      await prisma.faceEmbedding.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }

    const json = (method: string, body: unknown) =>
      new Request("http://localhost/api/usuarios/x/enrolar", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("DELETE borra solo las fotos indicadas de ese usuario", async () => {
      const { user, ids } = await withEmbeddings("TEST-0004", 3);
      const other = await withEmbeddings("TEST-0005", 1);

      const response = await DELETE(json("DELETE", { ids: [ids[0], other.ids[0]] }), {
        params: Promise.resolve({ userId: user.id }),
      });

      expect(await response.json()).toEqual({ eliminadas: 1 });
      expect(await prisma.faceEmbedding.count({ where: { userId: user.id } })).toBe(2);
      expect(await prisma.faceEmbedding.count({ where: { userId: other.user.id } })).toBe(1);

      await remove(user.id);
      await remove(other.user.id);
    });

    it("PUT conserva las fotos de la sesión y reemplaza las anteriores", async () => {
      const { user, ids } = await withEmbeddings("TEST-0006", 5);

      const response = await PUT(json("PUT", { conservar: ids.slice(2) }), {
        params: Promise.resolve({ userId: user.id }),
      });

      expect(await response.json()).toEqual({ eliminadas: 2 });
      const left = await prisma.faceEmbedding.findMany({ where: { userId: user.id }, select: { id: true } });
      expect(left.map((row) => row.id).sort()).toEqual(ids.slice(2).sort());

      await remove(user.id);
    });

    it("PUT sin fotos que conservar no borra nada y responde 400", async () => {
      const { user } = await withEmbeddings("TEST-0007", 2);

      const response = await PUT(json("PUT", { conservar: [] }), { params: Promise.resolve({ userId: user.id }) });

      expect(response.status).toBe(400);
      expect(await prisma.faceEmbedding.count({ where: { userId: user.id } })).toBe(2);
      await remove(user.id);
    });

    it("DELETE y PUT exigen sesión", async () => {
      auth.mockResolvedValue(null);
      const params = { params: Promise.resolve({ userId: "x" }) };
      expect((await DELETE(json("DELETE", { ids: [] }), params)).status).toBe(401);
      expect((await PUT(json("PUT", { conservar: ["a"] }), params)).status).toBe(401);
    });
  });
});
