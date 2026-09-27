import { type ConfigValues, DEFAULT_CONFIG, isExigencia } from "@/lib/configRules";
import { prisma } from "./prisma";

const CONFIG_ID = 1;

/** Reglas vigentes; si nadie ha guardado Configuración todavía, los valores por defecto. */
export async function getConfig(): Promise<ConfigValues> {
  const row = await prisma.configuracion.findUnique({ where: { id: CONFIG_ID } });
  if (!row) return DEFAULT_CONFIG;

  return {
    toleranciaLlegadaMin: row.toleranciaLlegadaMin,
    minMinutosAntesSalida: row.minMinutosAntesSalida,
    // Una columna de texto podría traer un valor viejo o editado a mano.
    exigenciaReconocimiento: isExigencia(row.exigenciaReconocimiento)
      ? row.exigenciaReconocimiento
      : DEFAULT_CONFIG.exigenciaReconocimiento,
    intentosAntesQr: row.intentosAntesQr,
    jornadaMaximaHoras: row.jornadaMaximaHoras,
  };
}

export async function saveConfig(values: ConfigValues, actualizadoPor: string): Promise<void> {
  await prisma.configuracion.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...values, actualizadoPor },
    update: { ...values, actualizadoPor },
  });
}
