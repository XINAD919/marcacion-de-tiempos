import { describe, expect, it, vi } from "vitest";

const fila = vi.hoisted(() => ({ carnetsPorHora: 0 }));
vi.mock("./prisma", () => ({
  prisma: {
    configuracion: {
      findUnique: async () => ({
        toleranciaLlegadaMin: 10,
        minMinutosAntesSalida: 60,
        toleranciaLlegadaNaturalMin: 10,
        minMinutosAntesSalidaNatural: 60,
        exigenciaReconocimiento: "equilibrado",
        intentosAntesQr: 3,
        jornadaMaximaHoras: 9,
        carnetsPorHora: fila.carnetsPorHora,
      }),
    },
  },
}));

import { getConfig } from "./config";

describe("getConfig", () => {
  it("nunca devuelve menos de 1 carnet por hora, aunque la base tenga 0", async () => {
    fila.carnetsPorHora = 0;
    expect((await getConfig()).carnetsPorHora).toBe(1);
    fila.carnetsPorHora = 250;
    expect((await getConfig()).carnetsPorHora).toBe(250);
  });
});
