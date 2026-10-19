import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

process.loadEnvFile(".env");

const SUFIJO = `E2E ${Date.now()}`;
const SEDE = `Sede ${SUFIJO}`;
const INSTITUCION = `Universidad ${SUFIJO}`;
const CEDULA = `9800${String(Date.now()).slice(-6)}`;
const NOMBRE = `Practicante ${SUFIJO}`;

test.use({ viewport: { width: 1366, height: 768 } });

const prisma = new PrismaClient();

test.afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { cedula: CEDULA } });
  if (user) {
    // reemplazaAId es NoAction: se suelta antes de borrar las marcaciones.
    await prisma.attendanceLog.updateMany({ where: { userId: user.id }, data: { reemplazaAId: null } });
    await prisma.attendanceLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.institucion.deleteMany({ where: { nombre: INSTITUCION } });
  await prisma.sede.deleteMany({ where: { nombre: SEDE } });
  await prisma.$disconnect();
});

test("corrige una salida olvidada de punta a punta", async ({ page }) => {
  test.setTimeout(120000);

  const sede = await prisma.sede.create({ data: { nombre: SEDE, horaApertura: "07:00", horaCierre: "17:00" } });
  const institucion = await prisma.institucion.create({
    data: { nombre: INSTITUCION, tipo: "universidad", horasExigidas: 240 },
  });
  const user = await prisma.user.create({
    data: {
      cedula: CEDULA,
      nombre: NOMBRE,
      tipo: "practicante",
      institucionId: institucion.id,
      sedeId: sede.id,
      horasRequeridas: 240,
      horaInicio: "07:00",
      horaFin: "17:00",
      activo: true,
    },
  });
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(7, 0, 0, 0);
  await prisma.attendanceLog.create({
    data: { userId: user.id, tipo: "IN", metodo: "face", deviceId: "e2e", marcadoEn: ayer },
  });

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(process.env.SEED_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin/);

  // Filtrar por la sede propia evita que otros pendientes de la BD empujen la fila fuera del resumen.
  await page.goto(`/admin/marcaciones?sede=${sede.id}`);
  const sinMarcar = page.getByRole("region", { name: /Salidas sin marcar/ });
  const fila = sinMarcar.getByRole("row", { name: new RegExp(NOMBRE) });
  await expect(fila).toBeVisible();

  await fila.getByRole("button", { name: "Registrar salida" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Hora de salida").fill("13:00");
  await dialogo.getByLabel("Motivo").fill("Olvidó marcar");
  await dialogo.getByRole("button", { name: "Registrar salida" }).click();
  await expect(dialogo).toBeHidden();

  await page.reload();
  await expect(sinMarcar.getByRole("row", { name: new RegExp(NOMBRE) })).toHaveCount(0);

  await page.goto(`/admin/usuarios/${user.id}`);
  const historial = page.getByRole("region", { name: "Historial de marcaciones" });
  await expect(historial).toContainText("13:00");
  await expect(historial).toContainText("Manual");
  await expect(page.getByText("6 / 240 h")).toBeVisible();
});
