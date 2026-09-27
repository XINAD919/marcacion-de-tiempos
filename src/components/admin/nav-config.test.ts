import { describe, expect, it } from "vitest";
import { isNavItemActive, type NavItem } from "./nav-config";

describe("isNavItemActive", () => {
  const configuracion: NavItem = { id: "c", label: "Configuración", href: "/admin/administradores" };

  it("marca activo el ítem en su propia ruta y en sus subrutas", () => {
    expect(isNavItemActive(configuracion, "/admin/administradores")).toBe(true);
    expect(isNavItemActive(configuracion, "/admin/administradores/123")).toBe(true);
  });

  it("no confunde rutas que solo comparten el prefijo de texto", () => {
    expect(isNavItemActive(configuracion, "/admin/administradores-antiguos")).toBe(false);
  });

  it("usa `match` cuando el ítem aún no tiene pantalla propia", () => {
    const enrolamiento: NavItem = { id: "e", label: "Enrolamiento", href: null, match: ["/admin/enrolar"] };
    expect(isNavItemActive(enrolamiento, "/admin/enrolar/abc")).toBe(true);
    expect(isNavItemActive(enrolamiento, "/admin/administradores")).toBe(false);
  });

  it("un ítem sin ruta ni `match` nunca está activo", () => {
    expect(isNavItemActive({ id: "r", label: "Reportes", href: null }, "/admin")).toBe(false);
  });
});
