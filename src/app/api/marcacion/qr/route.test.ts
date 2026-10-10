import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { carnetQrContent } from "@/lib/carnetQr";
import { ensureCarnetToken } from "@/lib/server/carnet";
import { prisma } from "@/lib/server/prisma";
import { POST } from "./route";

function buildRequest(qr: string): Request {
  return new Request("http://localhost/api/marcacion/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qr, deviceId: "kiosko-test" }),
  });
}

let userId = "";
let token = "";

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      cedula: "TEST-QR-0001",
      nombre: "Persona QR de Prueba",
      universidad: "Universidad de Prueba",
      entidad: "Entidad de Prueba",
    },
  });
  userId = user.id;
  token = await ensureCarnetToken(userId);
});

afterEach(async () => {
  await prisma.attendanceLog.deleteMany({ where: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { activo: true } });
});

afterAll(async () => {
  await prisma.carnetVirtual.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
});

describe("POST /api/marcacion/qr", () => {
  it("registra una ENTRADA por QR con el carnet vigente", async () => {
    const response = await POST(buildRequest(carnetQrContent(token)));
    const body = await response.json();

    expect(body).toMatchObject({ matched: true, tipo: "IN", nombre: "Persona QR de Prueba" });
    const log = await prisma.attendanceLog.findFirstOrThrow({ where: { userId } });
    expect(log).toMatchObject({ metodo: "qr", confianza: null, deviceId: "kiosko-test" });
  });

  it("reutiliza el mismo token al pedirlo otra vez", async () => {
    expect(await ensureCarnetToken(userId)).toBe(token);
  });

  it("rechaza QR ajenos, tokens desconocidos y usuarios inactivos sin registrar nada", async () => {
    for (const qr of ["https://ejemplo.com", carnetQrContent("x".repeat(24))]) {
      const body = await (await POST(buildRequest(qr))).json();
      expect(body).toEqual({ matched: false, carnet: "invalido" });
    }

    await prisma.user.update({ where: { id: userId }, data: { activo: false } });
    const body = await (await POST(buildRequest(carnetQrContent(token)))).json();
    expect(body).toEqual({ matched: false, carnet: "invalido" });
    expect(await prisma.attendanceLog.count({ where: { userId } })).toBe(0);
  });

  it("responde 400 si falta el código", async () => {
    const response = await POST(
      new Request("http://localhost/api/marcacion/qr", { method: "POST", body: "{}" })
    );
    expect(response.status).toBe(400);
  });
});
