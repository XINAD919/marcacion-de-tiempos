"use server";

import { revalidatePath } from "next/cache";
import type { ResultadoAccion } from "@/lib/client/avisos";
import { auth } from "@/lib/server/auth";
import { iniciarEnvio, pausarEnvio, reanudarEnvio } from "@/lib/server/envioCarnetsService";

const GENERICO = "No pudimos completar la acción. Inténtalo de nuevo.";
const SESION_TERMINADA = "Tu sesión terminó. Vuelve a iniciar sesión para continuar.";

function revalidar() {
  revalidatePath("/admin/usuarios", "layout");
}

// Las server actions son endpoints públicos: se verifica la sesión en cada una.
export async function iniciarEnvioAction(): Promise<ResultadoAccion & { envioId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: SESION_TERMINADA };

  let result;
  try {
    result = await iniciarEnvio(session.user.id);
  } catch (error) {
    console.error("[carnets] No se pudo iniciar el envío", { adminId: session.user.id }, error);
    return { ok: false, message: GENERICO };
  }
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
  let hecho: boolean;
  try {
    hecho = await pausarEnvio(envioId);
  } catch (error) {
    console.error("[carnets] No se pudo pausar el envío", { envioId }, error);
    return { ok: false, message: GENERICO };
  }
  revalidar();
  return hecho ? { ok: true } : { ok: false, message: "El envío ya no está en curso. Recarga la página." };
}

export async function reanudarEnvioAction(envioId: string): Promise<ResultadoAccion> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: SESION_TERMINADA };
  let hecho: boolean;
  try {
    hecho = await reanudarEnvio(envioId);
  } catch (error) {
    console.error("[carnets] No se pudo reanudar el envío", { envioId }, error);
    return { ok: false, message: GENERICO };
  }
  revalidar();
  return hecho ? { ok: true } : { ok: false, message: "El envío ya no está pausado. Recarga la página." };
}
