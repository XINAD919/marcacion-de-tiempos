import { describe, expect, it } from "vitest";
import { carnetQrContent, parseCarnetQr } from "./carnetQr";

describe("parseCarnetQr", () => {
  it("recupera el token de un QR generado por la app", () => {
    const token = "aB3_-xYz0123456789abcdEF";
    expect(parseCarnetQr(carnetQrContent(token))).toBe(token);
  });

  it("ignora QR ajenos o con tokens mal formados", () => {
    expect(parseCarnetQr("https://ejemplo.com")).toBeNull();
    expect(parseCarnetQr("1234567890")).toBeNull();
    expect(parseCarnetQr("CARNET:corto")).toBeNull();
    expect(parseCarnetQr("CARNET:con espacios en el token")).toBeNull();
  });
});
