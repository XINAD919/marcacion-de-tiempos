import { expect, test } from "@playwright/test";

test("la página de marcación carga la cámara y muestra el estado del óvalo", async ({ page }) => {
  await page.goto("/marcacion");

  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByTestId("kiosko")).toHaveAttribute(
    "data-guide-state",
    /esperando|detectando|listo/
  );
});

test("el kiosko no muestra ningún control de administración", async ({ page }) => {
  await page.goto("/marcacion");

  // Se acota al kiosko: en desarrollo Next añade su propio botón de Dev Tools.
  const kiosko = page.getByTestId("kiosko");
  await expect(kiosko).toBeVisible();
  await expect(kiosko.getByRole("link")).toHaveCount(0);
  await expect(kiosko.getByRole("button")).toHaveCount(0);
});
