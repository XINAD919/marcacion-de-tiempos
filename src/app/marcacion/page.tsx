import type { Metadata } from "next";
import { connection } from "next/server";
import { getConfig } from "@/lib/server/config";
import { Kiosko } from "./kiosko";

export const metadata: Metadata = { title: "Marcación" };

export default async function MarcacionPage() {
  // La configuración se lee en cada carga, no al compilar.
  await connection();
  const config = await getConfig();

  // Valor inicial: el kiosko queda abierto días enteros, así que cada respuesta
  // de /api/marcacion trae el valor vigente y lo actualiza.
  return <Kiosko initialIntentosAntesQr={config.intentosAntesQr} />;
}
