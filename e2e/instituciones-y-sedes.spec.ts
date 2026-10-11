import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

process.loadEnvFile(".env");

const SUFIJO = `E2E ${Date.now()}`;
const SEDE = `Sede ${SUFIJO}`;
const INSTITUCION = `Universidad ${SUFIJO}`;
const CEDULA = `9900${String(Date.now()).slice(-6)}`;

test.use({ viewport: { width: 1366, height: 768 } });

test.afterAll(async () => {
  const prisma = new PrismaClient();
  await prisma.user.deleteMany({ where: { cedula: CEDULA } });
  await prisma.institucion.deleteMany({ where: { nombre: INSTITUCION } });
  await prisma.sede.deleteMany({ where: { nombre: SEDE } });
  await prisma.$disconnect();
});

test("instituciones y sedes de punta a punta", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(process.env.SEED_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin/);

  // 4f: crear sede e institución.
  await page.getByRole("link", { name: "Instituciones y sedes" }).click();
  await page.getByRole("button", { name: "+ Agregar sede" }).click();
  await page.locator("#sede-nombre").fill(SEDE);
  await page.locator("#sede-apertura").fill("07:00");
  await page.getByLabel("Hora de cierre").fill("17:00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: SEDE })).toBeVisible();

  await page.getByRole("button", { name: "+ Agregar institución" }).click();
  await page.locator("#institucion-nombre").fill(INSTITUCION);
  await page.locator("#institucion-horas").fill("240");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("cell", { name: INSTITUCION })).toBeVisible();

  // Nombre repetido con otras mayúsculas: error, sin perder lo escrito.
  await page.getByRole("button", { name: "+ Agregar sede" }).click();
  await page.locator("#sede-nombre").fill(SEDE.toLowerCase());
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Ya existe una sede con ese nombre")).toBeVisible();
  await expect(page.locator("#sede-nombre")).toHaveValue(SEDE.toLowerCase());
  await page.keyboard.press("Escape");

  // 4c: crear practicante eligiendo del catálogo, con precarga.
  await page.goto("/admin/usuarios/nuevo");
  await page.locator("#nombre").fill(`Practicante ${SUFIJO}`);
  await page.locator("#cedula").fill(CEDULA);
  await page.locator("#institucionId").fill(SUFIJO);
  await page.getByRole("option", { name: INSTITUCION }).click();
  await expect(page.locator("#horasRequeridas")).toHaveValue("240");
  await page.locator("#sedeId").selectOption({ label: SEDE });
  await expect(page.locator("#horaInicio")).toHaveValue("07:00");
  await expect(page.locator("#horaFin")).toHaveValue("17:00");
  await page.locator("#fechaInicio").fill("2026-08-01");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.waitForURL(/\/admin\/usuarios$/);

  // 2a: filtrar por sede.
  await page.locator('select[aria-label="Sede"]').selectOption({ label: SEDE });
  await expect(page.getByRole("link", { name: `Quitar filtro Sede: ${SEDE}` })).toBeVisible();
  const fila = page.getByRole("row", { name: new RegExp(`Practicante ${SUFIJO}`) });
  await expect(fila).toContainText(INSTITUCION);
  await expect(fila).toContainText(SEDE);
  await expect(fila).toContainText("Universidad");
});
