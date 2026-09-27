export interface FailureStreak {
  count: number;
  lastAt: number;
}

export interface FailureOutcome {
  /** Estado a guardar para el próximo fallo. */
  streak: FailureStreak;
  /** Número de este intento (1, 2, …) para mostrar "Intento 2 de 3". */
  attempt: number;
  /** Se llegó a "Intentos antes de pedir el QR" (maqueta 4g). */
  offerFallback: boolean;
}

/**
 * Registra un fallo de reconocimiento seguido en el kiosko. Si el anterior fue
 * hace más de `resetMs`, probablemente es otra persona y la cuenta reinicia.
 * Al ofrecer el respaldo la cuenta vuelve a cero para el siguiente intento.
 */
export function registerFailure(
  previous: FailureStreak | null,
  now: number,
  limit: number,
  resetMs: number
): FailureOutcome {
  const continues = previous !== null && now - previous.lastAt <= resetMs;
  const attempt = (continues ? previous.count : 0) + 1;
  const offerFallback = attempt >= limit;

  return {
    streak: { count: offerFallback ? 0 : attempt, lastAt: now },
    attempt,
    offerFallback,
  };
}
