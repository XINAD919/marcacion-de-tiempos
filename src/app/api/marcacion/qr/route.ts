import { NextResponse } from "next/server";
import { parseCarnetQr } from "@/lib/carnetQr";
import { findUserByCarnetToken } from "@/lib/server/carnet";
import { getConfig } from "@/lib/server/config";
import { registrarMarcacion } from "@/lib/server/marcacionService";

/**
 * Marcación de respaldo con el QR del carnet virtual (maqueta 1e). El kiosko
 * solo la usa después de agotar los intentos de reconocimiento facial.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const qr = typeof body?.qr === "string" ? body.qr : null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : null;

  if (!qr || !deviceId) {
    return NextResponse.json({ error: "Falta el código o el identificador del kiosko" }, { status: 400 });
  }

  const token = parseCarnetQr(qr);
  const user = token ? await findUserByCarnetToken(token) : null;
  if (!user) {
    // Carnet reemplazado, de alguien inactivo o un QR que no es nuestro.
    console.info(`[marcacion] Carnet no válido: deviceId=${deviceId} en=${new Date().toISOString()}`);
    return NextResponse.json({ matched: false, carnet: "invalido" });
  }

  console.info(`[marcacion] Carnet: userId=${user.id} deviceId=${deviceId}`);
  const config = await getConfig();
  return NextResponse.json(await registrarMarcacion(user, config, { metodo: "qr", confianza: null, deviceId }));
}
