import { describe, expect, it } from "vitest";
import { precargar } from "./precarga";

describe("precargar", () => {
  it("llena un campo vacío", () => {
    expect(precargar("", null, "240")).toBe("240");
  });

  it("reemplaza lo que se había propuesto antes y nadie tocó", () => {
    expect(precargar("240", "240", "80")).toBe("80");
  });

  it("nunca pisa lo que se escribió a mano", () => {
    expect(precargar("300", "240", "80")).toBe("300");
    expect(precargar("300", null, "80")).toBe("300");
  });

  it("sin propuesta deja el campo como está", () => {
    expect(precargar("240", "240", null)).toBe("240");
    expect(precargar("", null, "")).toBe("");
  });
});
