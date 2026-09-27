/**
 * Reglas globales de la maqueta 4g. Módulo puro (sin Prisma) para poder
 * usarlo tanto en el formulario de Configuración como en el servidor.
 */

export const EXIGENCIAS = ["flexible", "equilibrado", "estricto"] as const;
export type Exigencia = (typeof EXIGENCIAS)[number];

export const EXIGENCIA_LABEL: Record<Exigencia, string> = {
  flexible: "Flexible",
  equilibrado: "Equilibrado",
  estricto: "Estricto",
};

// Distancia euclidiana máxima entre descriptores de face-api.js para aceptar
// una coincidencia. 0.6 es el valor por defecto de la librería; el proyecto
// usaba 0.5 fijo (FACE_MATCH_THRESHOLD), que queda como "Equilibrado".
const UMBRAL_POR_EXIGENCIA: Record<Exigencia, number> = {
  flexible: 0.55,
  equilibrado: 0.5,
  estricto: 0.45,
};

export function matchThresholdFor(exigencia: Exigencia): number {
  return UMBRAL_POR_EXIGENCIA[exigencia];
}

export interface ConfigValues {
  toleranciaLlegadaMin: number;
  minMinutosAntesSalida: number;
  exigenciaReconocimiento: Exigencia;
  intentosAntesQr: number;
  jornadaMaximaHoras: number;
}

export const DEFAULT_CONFIG: ConfigValues = {
  toleranciaLlegadaMin: 10,
  minMinutosAntesSalida: 60,
  exigenciaReconocimiento: "equilibrado",
  intentosAntesQr: 3,
  jornadaMaximaHoras: 9,
};

export type ConfigField =
  | "toleranciaLlegadaMin"
  | "minHorasAntesSalida"
  | "exigenciaReconocimiento"
  | "intentosAntesQr"
  | "jornadaMaximaHoras";

export type ConfigParseResult =
  | { ok: true; value: ConfigValues }
  | { ok: false; errors: Partial<Record<ConfigField, string>> };

function parseNumber(raw: unknown): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw.trim().replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function intInRange(raw: unknown, min: number, max: number): number | null {
  const value = parseNumber(raw);
  return value !== null && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export function isExigencia(value: unknown): value is Exigencia {
  return typeof value === "string" && (EXIGENCIAS as readonly string[]).includes(value);
}

/** Valida el formulario de Configuración; los mensajes van directo a la coordinadora. */
export function parseConfigForm(input: Partial<Record<ConfigField, unknown>>): ConfigParseResult {
  const errors: Partial<Record<ConfigField, string>> = {};

  const tolerancia = intInRange(input.toleranciaLlegadaMin, 0, 120);
  if (tolerancia === null) errors.toleranciaLlegadaMin = "Escribe un número de minutos entre 0 y 120.";

  const horas = parseNumber(input.minHorasAntesSalida);
  if (horas === null || horas < 0 || horas > 12) {
    errors.minHorasAntesSalida = "Escribe un número de horas entre 0 y 12.";
  }

  const exigencia = input.exigenciaReconocimiento;
  if (!isExigencia(exigencia)) {
    errors.exigenciaReconocimiento = "Elige Flexible, Equilibrado o Estricto.";
  }

  const intentos = intInRange(input.intentosAntesQr, 1, 10);
  if (intentos === null) errors.intentosAntesQr = "Elige entre 1 y 10 intentos.";

  const jornada = intInRange(input.jornadaMaximaHoras, 1, 24);
  if (jornada === null) errors.jornadaMaximaHoras = "Escribe un número de horas entre 1 y 24.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      toleranciaLlegadaMin: tolerancia!,
      minMinutosAntesSalida: Math.round(horas! * 60),
      exigenciaReconocimiento: exigencia as Exigencia,
      intentosAntesQr: intentos!,
      jornadaMaximaHoras: jornada!,
    },
  };
}
