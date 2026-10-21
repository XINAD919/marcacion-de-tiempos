import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recuperar = vi.hoisted(() => vi.fn(async () => 0));
vi.mock("./envioCarnetsService", () => ({
  recuperarAlArrancar: recuperar,
  procesarSiguiente: vi.fn(),
}));

import { iniciarTrabajador } from "./envioCarnetsWorker";

let detener: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  recuperar.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  detener?.();
  detener = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("iniciarTrabajador", () => {
  it("un segundo arranque en el mismo proceso no crea otro bucle", async () => {
    const paso = vi.fn(async () => "esperando" as const);
    detener = iniciarTrabajador({ tickMs: 1000, paso });
    iniciarTrabajador({ tickMs: 1000, paso });
    await vi.advanceTimersByTimeAsync(1000);
    expect(paso).toHaveBeenCalledTimes(1);
  });

  it("arrancar no consulta la base: la recuperación va dentro de cada paso, que tolera errores", async () => {
    // Al levantar `next dev`, SQL Server tarda unos segundos en aceptar conexiones.
    const paso = vi.fn(async () => "sin-envio" as const);
    detener = iniciarTrabajador({ tickMs: 1000, paso });
    await vi.advanceTimersByTimeAsync(0);
    expect(recuperar).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("no solapa un paso lento con el siguiente tick", async () => {
    let terminar!: () => void;
    const paso = vi.fn(() => new Promise<"enviado">((resolve) => (terminar = () => resolve("enviado"))));
    detener = iniciarTrabajador({ tickMs: 1000, paso });
    await vi.advanceTimersByTimeAsync(3500);
    expect(paso).toHaveBeenCalledTimes(1);
    terminar();
    await vi.advanceTimersByTimeAsync(1000);
    expect(paso).toHaveBeenCalledTimes(2);
  });

  it("un paso que lanza no detiene el bucle", async () => {
    const paso = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue("esperando");
    detener = iniciarTrabajador({ tickMs: 1000, paso });
    await vi.advanceTimersByTimeAsync(3000);
    expect(paso).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalled();
  });

  it("la función devuelta lo detiene y permite un nuevo arranque", async () => {
    const paso = vi.fn(async () => "esperando" as const);
    const parar = iniciarTrabajador({ tickMs: 1000, paso });
    await vi.advanceTimersByTimeAsync(1000);
    parar();
    await vi.advanceTimersByTimeAsync(5000);
    expect(paso).toHaveBeenCalledTimes(1);
    detener = iniciarTrabajador({ tickMs: 1000, paso });
    await vi.advanceTimersByTimeAsync(1000);
    expect(paso).toHaveBeenCalledTimes(2);
  });
});
