import { toast } from "sonner";

export type ResultadoAccion =
  | { ok: true }
  | { ok: false; message?: string; errors?: Partial<Record<string, string>> };

export interface Aviso {
  tipo: "exito" | "error";
  texto: string;
}

export const AVISO_CAMPOS = "Revisa los campos marcados";
export const AVISO_GENERICO = "No pudimos completar la acción. Inténtalo de nuevo.";

/** Decide qué avisar según el resultado de una acción. Pura. */
export function avisoDe(result: ResultadoAccion, exito: string): Aviso {
  if (result.ok) return { tipo: "exito", texto: exito };
  if (Object.values(result.errors ?? {}).some(Boolean)) {
    return { tipo: "error", texto: AVISO_CAMPOS };
  }
  if (result.message) return { tipo: "error", texto: result.message };
  return { tipo: "error", texto: AVISO_GENERICO };
}

/** Muestra el aviso: éxito 4 s; error 8 s con botón de cerrar. */
export function notificar(result: ResultadoAccion, exito: string): void {
  const aviso = avisoDe(result, exito);
  if (aviso.tipo === "exito") toast.success(aviso.texto, { duration: 4000 });
  else toast.error(aviso.texto, { duration: 8000, closeButton: true });
}
