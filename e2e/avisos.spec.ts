import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

process.loadEnvFile(".env");

const SEDE = `Sede avisos ${Date.now()}`;

test.use({ viewport: { width: 1366, height: 768 } });

test.afterAll(async () => {
  const prisma = new PrismaClient();
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
});
