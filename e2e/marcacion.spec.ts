import { expect, test } from "@playwright/test";

test("la página de marcación carga la cámara y muestra el estado del óvalo", async ({ page }) => {
  await page.goto("/marcacion");

  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByTestId("guide-state")).toHaveText(/esperando|detectando|listo/);
});
