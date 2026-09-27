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
  | ({ kind: "entrada" } & Recognized)
  | ({ kind: "salida"; jornadaMs: number; acumuladoMs: number } & Recognized)
  | { kind: "fallo"; reason: FailureReason };

const fail = (reason: FailureReason): MarcacionResult => ({ kind: "fallo", reason });

/** Traduce la respuesta de POST /api/marcacion al estado que pinta el kiosko. */
export function interpretMarcacionResponse(status: number, body: unknown): MarcacionResult {
  if (status === 422) return fail("rostro-no-legible");
  if (status !== 200 || typeof body !== "object" || body === null) return fail("error");

  const data = body as Record<string, unknown>;
  if (data.matched === false) return fail("no-reconocido");

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

  if (tipo === "IN") return { kind: "entrada", ...recognized };

  if (tipo === "OUT" && typeof data.jornadaMs === "number" && typeof data.acumuladoMs === "number") {
    return { kind: "salida", ...recognized, jornadaMs: data.jornadaMs, acumuladoMs: data.acumuladoMs };
  }

  return fail("error");
}
