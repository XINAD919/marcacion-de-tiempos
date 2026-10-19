"use server";

import { revalidatePath } from "next/cache";
import type { ResultadoAccion } from "@/lib/client/avisos";
import { auth } from "@/lib/server/auth";
import { iniciarEnvio, pausarEnvio, reanudarEnvio } from "@/lib/server/envioCarnetsService";

const SESION_TERMINADA = "Tu sesión terminó. Vuelve a iniciar sesión para continuar.";

function revalidar() {
  revalidatePath("/admin/usuarios", "layout");
}

// Las server actions son endpoints públicos: se verifica la sesión en cada una.
export async function iniciarEnvioAction(): Promise<ResultadoAccion & { envioId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: SESION_TERMINADA };

  const result = await iniciarEnvio(session.user.id);
  if (result.ok) {
    revalidar();
    return { ok: true, envioId: result.envioId };
  }
  if (result.reason === "hay-otro") {
    revalidar();
    return { ok: false, message: "Ya hay un envío de carnets en curso.", envioId: result.envioId };
  }
  revalidar();
  return { ok: false, message: "No hay carnets pendientes por enviar." };
}

export async function pausarEnvioAction(envioId: string): Promise<ResultadoAccion> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: SESION_TERMINADA };
  const hecho = await pausarEnvio(envioId);
  revalidar();
  return hecho ? { ok: true } : { ok: false, message: "El envío ya no está en curso. Recarga la página." };
}

export async function reanudarEnvioAction(envioId: string): Promise<ResultadoAccion> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: SESION_TERMINADA };
  const hecho = await reanudarEnvio(envioId);
  revalidar();
  return hecho ? { ok: true } : { ok: false, message: "El envío ya no está pausado. Recarga la página." };
}
