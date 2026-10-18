import { describe, expect, it } from "vitest";
import { renderCarnetHtml } from "./carnet";

const images = { qrSrc: "cid:qr", logoSrc: "cid:logo" };

describe("renderCarnetHtml", () => {
  it("muestra institución y sede de un practicante", () => {
    const html = renderCarnetHtml(
      { nombre: "Laura Rodríguez", cedula: "1019442881", tipo: "universidad", institucion: { nombre: "Universidad Nacional" }, sede: { nombre: "Sede Centro" } },
      images
    );
    expect(html).toContain("Universidad Nacional · Sede Centro");
  });

  it("a un voluntario natural lo presenta como tal, sin separadores sueltos", () => {
    const html = renderCarnetHtml(
      { nombre: "Marta Gómez", cedula: "52123456", tipo: "natural", institucion: null, sede: null },
      images
    );
    expect(html).toContain("Voluntario natural");
    expect(html).not.toContain("null");
  });
});
