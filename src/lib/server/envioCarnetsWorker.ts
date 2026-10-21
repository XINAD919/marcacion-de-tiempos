import { type ResultadoPaso, procesarSiguiente } from "./envioCarnetsService";

// En desarrollo el HMR puede volver a ejecutar register(): la guarda vive en
// globalThis para sobrevivir a la recarga del módulo.
const GUARDA = Symbol.for("medicion-tiempos.envioCarnetsWorker");
type GlobalConGuarda = typeof globalThis & { [GUARDA]?: () => void };

/**
 * Procesa el envío masivo de carnets en segundo plano. Devuelve la función
 * que lo detiene. Un solo bucle por proceso, y nunca dos pasos a la vez.
 */
export function iniciarTrabajador(opts: { tickMs?: number; paso?: () => Promise<ResultadoPaso> } = {}): () => void {
  const global = globalThis as GlobalConGuarda;
  const existente = global[GUARDA];
  if (existente) return existente;

  const tickMs = opts.tickMs ?? 5_000;
  const paso = opts.paso ?? (() => procesarSiguiente());
  let enCurso = false;
  // Sin consulta al arrancar: la base puede no estar lista todavía. Cada paso ya
  // recupera los items trabados (`procesarSiguiente`) y sus errores no detienen el bucle.

  const timer = setInterval(async () => {
    if (enCurso) return;
    enCurso = true;
    try {
      await paso();
    } catch (error) {
      console.error("[carnets] Falló un paso del envío masivo", error);
    } finally {
      enCurso = false;
    }
  }, tickMs);

  const detener = () => {
    clearInterval(timer);
    if (global[GUARDA] === detener) delete global[GUARDA];
  };
  global[GUARDA] = detener;
  return detener;
}
