// Cómo correr: este spec cambia datos reales de la base y necesita un servidor que NO envíe correos.
// Detén tu `next dev` y deja que Playwright arranque el suyo (ya trae MAIL_TRANSPORT=json), o
// arranca el tuyo con MAIL_TRANSPORT=json. Si el servidor no está en ese modo, la prueba falla al
// empezar, antes de tocar nada.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

process.loadEnvFile(".env");

const SUFIJO = `${Date.now()}`.slice(-7);
const CEDULAS = [`9700${SUFIJO}1`, `9700${SUFIJO}2`];

test.use({ viewport: { width: 1366, height: 768 } });

// Ids desactivados por la prueba, en disco: si el proceso muere, la siguiente corrida los reactiva.
const ARCHIVO_APARTADOS = path.join(tmpdir(), "medicion-tiempos-carnets-apartados.json");

async function reactivarApartados() {
  if (!existsSync(ARCHIVO_APARTADOS)) return;
  const ids: string[] = JSON.parse(readFileSync(ARCHIVO_APARTADOS, "utf8"));
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { activo: true } });
  unlinkSync(ARCHIVO_APARTADOS);
}

const prisma = new PrismaClient();
// Fila de configuración tal como estaba: se restaura aunque la prueba falle.
let configOriginal: Awaited<ReturnType<PrismaClient["configuracion"]["findUnique"]>> = null;
// Usuarios ajenos con carnet pendiente: se apartan para que el lote sea solo de la prueba.
let apartados: string[] = [];

async function limpiar() {
  const usuarios = await prisma.user.findMany({ where: { cedula: { in: CEDULAS } }, select: { id: true } });
  const ids = usuarios.map((u) => u.id);
  const envios = await prisma.envioCarnetItem.findMany({ where: { userId: { in: ids } }, select: { envioId: true } });
  const envioIds = [...new Set(envios.map((e) => e.envioId))];
  await prisma.envioCarnetItem.deleteMany({ where: { envioId: { in: envioIds } } });
  await prisma.envioCarnets.deleteMany({ where: { id: { in: envioIds } } });
  await prisma.carnetVirtual.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

test.beforeAll(async ({ browser, baseURL }) => {
  // Falla rápido, sin tocar datos, si el servidor enviaría correos de verdad.
  const contexto = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  const pagina = await contexto.newPage();
  await pagina.goto("/login");
  await pagina.locator('input[name="email"]').fill(process.env.SEED_ADMIN_EMAIL!);
  await pagina.locator('input[name="password"]').fill(process.env.SEED_ADMIN_PASSWORD!);
  await pagina.locator('button[type="submit"]').click();
  await pagina.waitForURL(/\/admin/);
  const respuesta = await pagina.request.get("/api/dev/mail-mode");
  const enModoPrueba = respuesta.ok() && (await respuesta.json()).json === true;
  await contexto.close();
  if (!enModoPrueba) {
    throw new Error(
      "El servidor no está en modo de correo de prueba (MAIL_TRANSPORT=json): enviaría correos reales. " +
        "Detén tu next dev para que Playwright arranque el suyo, o inícialo con MAIL_TRANSPORT=json."
    );
  }

  await reactivarApartados();
  await limpiar();
  configOriginal = await prisma.configuracion.findUnique({ where: { id: 1 } });
  // Ritmo alto: el trabajador de segundo plano del servidor de pruebas termina el lote en segundos.
  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: { carnetsPorHora: 10000 },
    create: { id: 1, carnetsPorHora: 10000 },
  });
  const ajenos = await prisma.user.findMany({
    where: {
      activo: true,
      email: { not: null },
      NOT: { email: "" },
      OR: [{ carnet: { is: null } }, { carnet: { is: { enviadoEn: null } } }],
    },
    select: { id: true },
  });
  apartados = ajenos.map((u) => u.id);
  writeFileSync(ARCHIVO_APARTADOS, JSON.stringify(apartados));
  await prisma.user.updateMany({ where: { id: { in: apartados } }, data: { activo: false } });
  for (const [i, cedula] of CEDULAS.entries()) {
    await prisma.user.create({
      data: {
        cedula,
        nombre: `Carnet Prueba ${SUFIJO} ${i + 1}`,
        email: `carnet-${SUFIJO}-${i + 1}@example.com`,
        tipo: "natural",
        horaInicio: "08:00",
        horaFin: "12:00",
      },
    });
  }
});

test.afterAll(async () => {
  await limpiar();
  await reactivarApartados();
  if (configOriginal) {
    const { id, actualizadoEn, ...datos } = configOriginal;
    void actualizadoEn;
    await prisma.configuracion.update({ where: { id }, data: datos });
  } else {
    await prisma.configuracion.deleteMany({ where: { id: 1 } });
  }
  await prisma.$disconnect();
});

test("el envío masivo de carnets se inicia, avanza solo y termina", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(process.env.SEED_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/admin/);

  await page.goto("/admin/usuarios");
  await page.getByRole("button", { name: /Enviar carnets pendientes \(/ }).click();
  await expect(page.getByRole("heading", { name: "Enviar carnets pendientes" })).toBeVisible();
  await expect(page.getByText(/Se enviarán 2 carnets, a unos 10\.?000 por hora/)).toBeVisible();
  await page.getByRole("button", { name: "Empezar envío" }).click();
  await expect(page.getByText("Envío de carnets iniciado", { exact: true })).toBeVisible();

  await page.waitForURL(/\/admin\/usuarios\/carnets$/);
  await expect(page.getByRole("heading", { name: "Envío de carnets" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();

  // El trabajador del servidor (procesarSiguiente real, transporte JSON) avanza solo.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Envío terminado")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 90000, intervals: [3000] });

  const carnets = await prisma.carnetVirtual.findMany({ where: { user: { cedula: { in: CEDULAS } } } });
  expect(carnets).toHaveLength(2);
  for (const carnet of carnets) expect(carnet.enviadoEn).not.toBeNull();

  // Sin pendientes, el botón de Usuarios queda deshabilitado.
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("button", { name: "Todos tienen su carnet" })).toBeDisabled();
});
