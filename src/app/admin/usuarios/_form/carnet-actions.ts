"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/server/auth";
import { sendCarnet } from "@/lib/server/carnet";
import { describeMailError } from "@/lib/server/mailer";

export type EnviarCarnetResult =
  | { ok: true; to: string; enviadoEn: string }
  | { ok: false; message: string };

const MOTIVO: Record<"no-encontrado" | "sin-correo" | "inactivo", string> = {
  "no-encontrado": "No encontramos a este usuario. Recarga la página.",
  "sin-correo": "Este usuario no tiene correo. Agrégalo y guarda antes de enviar el carnet.",
  inactivo: "Este usuario está inactivo: actívalo antes de enviarle el carnet.",
};

/** @param renovar Crea un QR nuevo; el anterior deja de servir en el kiosko. */
export async function enviarCarnet(userId: string, renovar: boolean): Promise<EnviarCarnetResult> {
  // Las server actions son endpoints públicos: se verifica la sesión aquí.
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Tu sesión terminó. Vuelve a iniciar sesión." };

  try {
    const result = await sendCarnet(userId, { renovar });
    if (!result.ok) return { ok: false, message: MOTIVO[result.reason] };
    revalidatePath(`/admin/usuarios/${userId}/editar`);
    return { ok: true, to: result.to, enviadoEn: result.enviadoEn.toISOString() };
  } catch (error) {
    console.error(`[carnet] No se pudo enviar el carnet de userId=${userId}`, error);
    return { ok: false, message: describeMailError(error) };
  }
}
