import { beforeEach, describe, expect, it, vi } from "vitest";
import { MENSAJE } from "@/lib/marcaciones/correcciones";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { buscarPracticantesAction, registrarSalidaAction } from "./actions";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("acciones de corrección", () => {
  beforeEach(() => auth.mockReset());

  it("sin sesión devuelve el mensaje de sesión", async () => {
    auth.mockResolvedValue(null);
    const result = await registrarSalidaAction(form({ marcaId: "x", hora: "13:00", motivo: "Olvidó marcar" }));
    expect(result).toEqual({ ok: false, message: "Tu sesión terminó. Vuelve a iniciar sesión." });
  });

  it("con sesión y hora vacía da error de campo sin tocar la BD", async () => {
    auth.mockResolvedValue({ user: { id: "admin" } });
    const result = await registrarSalidaAction(form({ marcaId: "no-existe", hora: "", motivo: "Olvidó marcar" }));
    expect(result).toEqual({ ok: false, errors: { hora: MENSAJE.horaInvalida } });
  });

  it("la búsqueda sin sesión no devuelve nada", async () => {
    auth.mockResolvedValue(null);
    expect(await buscarPracticantesAction("ana")).toEqual([]);
  });
});
