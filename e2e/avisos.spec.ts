import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

process.loadEnvFile(".env");

const SUFIJO = `avisos ${Date.now()}`;
const SEDE = `Sede ${SUFIJO}`;
const INSTITUCION = `Universidad ${SUFIJO}`;
const CEDULA = `9800${String(Date.now()).slice(-6)}`;

test.use({ viewport: { width: 1366, height: 768 } });

// Fila de configuración tal como estaba (null si no existía): se restaura aunque la prueba falle.
let configOriginal: Awaited<ReturnType<PrismaClient["configuracion"]["findUnique"]>> = null;

test.beforeAll(async () => {
  const prisma = new PrismaClient();
  configOriginal = await prisma.configuracion.findUnique({ where: { id: 1 } });
  await prisma.$disconnect();
});

test.afterAll(async () => {
  const prisma = new PrismaClient();
  if (configOriginal) {
    const { id, actualizadoEn, ...datos } = configOriginal;
    void actualizadoEn;
    await prisma.configuracion.update({ where: { id }, data: datos });
  } else {
    await prisma.configuracion.deleteMany({ where: { id: 1 } });
  }
  await prisma.user.deleteMany({ where: { cedula: CEDULA } });
  await prisma.institucion.deleteMany({ where: { nombre: INSTITUCION } });
  await prisma.sede.deleteMany({ where: { nombre: SEDE } });
  await prisma.$disconnect();
});

test("los avisos confirman el éxito y señalan los campos con error", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(process.env.SEED_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin/);

  await page.getByRole("link", { name: "Instituciones y sedes" }).click();
  await page.getByRole("button", { name: "+ Agregar sede" }).click();
  await page.locator("#sede-nombre").fill(SEDE);
  await page.locator("#sede-apertura").fill("07:00");
  await page.getByLabel("Hora de cierre").fill("17:00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Sede guardada", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ Agregar sede" }).click();
  await page.locator("#sede-nombre").fill(SEDE.toLowerCase());
  await page.locator("#sede-apertura").fill("07:00");
  await page.getByLabel("Hora de cierre").fill("17:00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Revisa los campos marcados", { exact: true })).toBeVisible();

  // Usuario nuevo: aviso y redirección (la acción ya no redirige en el servidor).
  const prisma = new PrismaClient();
  await prisma.institucion.create({ data: { nombre: INSTITUCION, tipo: "universidad", horasExigidas: 240 } });
  await prisma.$disconnect();
  await page.goto("/admin/usuarios/nuevo");
  await page.locator("#nombre").fill(`Practicante ${SUFIJO}`);
  await page.locator("#cedula").fill(CEDULA);
  await page.locator("#institucionId").fill(SUFIJO);
  await page.getByRole("option", { name: INSTITUCION }).click();
  await page.locator("#sedeId").selectOption({ label: SEDE });
  await page.locator("#fechaInicio").fill("2026-08-01");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Usuario guardado", { exact: true })).toBeVisible();
  await page.waitForURL(/\/admin\/usuarios$/);

  // Enrolamiento carga (sin cámara en el navegador de prueba, la página igual abre).
  const lectura = new PrismaClient();
  const usuario = await lectura.user.findFirstOrThrow({ where: { cedula: CEDULA } });
  await lectura.$disconnect();
  await page.goto(`/admin/enrolar/${usuario.id}`);
  await expect(page.getByRole("heading", { name: /Enrolamiento facial/ })).toBeVisible();

  // Importar carga.
  await page.goto("/admin/usuarios/importar");
  await expect(page.getByRole("heading", { name: "Sube el Excel de practicantes" })).toBeVisible();

  // Configuración: guardar muestra el aviso y el valor persiste (afterAll restaura el original).
  await page.goto("/admin/configuracion");
  const tolerancia = page.locator("#toleranciaLlegadaMin");
  await expect(tolerancia).toBeVisible();
  const nuevo = String(Number(await tolerancia.inputValue()) + 1);
  await tolerancia.fill(nuevo);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Configuración guardada", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("#toleranciaLlegadaMin")).toHaveValue(nuevo);
});
