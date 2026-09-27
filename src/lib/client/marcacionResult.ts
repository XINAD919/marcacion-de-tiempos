interface Recognized {
  nombre: string;
  universidad: string;
  entidad: string;
  hora: Date;
}

export type FailureReason =
  /** Hay un rostro pero no coincide con nadie enrolado. */
  | "no-reconocido"
  /** El servidor no encontró un rostro claro, o encontró varios. */
  | "rostro-no-legible"
  /** Error de red o del servidor: no es culpa del practicante. */
  | "error";

export type MarcacionResult =
  /** `tardeMin`: minutos de retraso si superó la tolerancia de llegada. */
  | ({ kind: "entrada"; tardeMin: number | null } & Recognized)
  | ({ kind: "salida"; jornadaMs: number; acumuladoMs: number } & Recognized)
  /** Reconocido, pero aún no cumple el mínimo entre entrada y salida: no se registró nada. */
  | { kind: "salida-anticipada"; nombre: string; entrada: Date; disponibleDesde: Date }
  /** `intentosAntesQr` solo viene cuando el servidor pudo leer la configuración. */
  | { kind: "fallo"; reason: FailureReason; intentosAntesQr?: number };

const fail = (reason: FailureReason): MarcacionResult => ({ kind: "fallo", reason });

/** Traduce la respuesta de POST /api/marcacion al estado que pinta el kiosko. */
export function interpretMarcacionResponse(status: number, body: unknown): MarcacionResult {
  if (status === 422) return fail("rostro-no-legible");
  if (status !== 200 || typeof body !== "object" || body === null) return fail("error");

  const data = body as Record<string, unknown>;
  if (data.matched === false) {
    return typeof data.intentosAntesQr === "number"
      ? { kind: "fallo", reason: "no-reconocido", intentosAntesQr: data.intentosAntesQr }
      : fail("no-reconocido");
  }

  if (
    data.matched === true &&
    data.bloqueado === "salida-anticipada" &&
    typeof data.nombre === "string" &&
    typeof data.entrada === "string" &&
    typeof data.disponibleDesde === "string"
  ) {
    return {
      kind: "salida-anticipada",
      nombre: data.nombre,
      entrada: new Date(data.entrada),
      disponibleDesde: new Date(data.disponibleDesde),
    };
  }

  const { nombre, universidad, entidad, hora, tipo } = data;
  if (
    data.matched !== true ||
    typeof nombre !== "string" ||
    typeof universidad !== "string" ||
    typeof entidad !== "string" ||
    typeof hora !== "string"
  ) {
    return fail("error");
  }

  const recognized: Recognized = { nombre, universidad, entidad, hora: new Date(hora) };

  if (tipo === "IN") {
    const tardeMin = typeof data.tardeMin === "number" ? data.tardeMin : null;
    return { kind: "entrada", ...recognized, tardeMin };
  }

  if (tipo === "OUT" && typeof data.jornadaMs === "number" && typeof data.acumuladoMs === "number") {
    return { kind: "salida", ...recognized, jornadaMs: data.jornadaMs, acumuladoMs: data.acumuladoMs };
  }

  return fail("error");
}
