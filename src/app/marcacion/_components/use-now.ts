"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

// Segundos enteros: el snapshot no cambia dentro del mismo segundo, así React
// no vuelve a renderizar en cada lectura.
const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
// En el servidor no hay hora que mostrar: evita un desajuste de hidratación.
const getServerSnapshot = () => null;

/** Marca de tiempo actual (ms, redondeada al segundo), o `null` durante SSR. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Segundos que faltan para `deadline` (ms), para las cuentas regresivas. */
export function useSecondsLeft(deadline: number): number {
  const now = useNow();
  // Las pantallas con cuenta regresiva solo existen en el cliente, tras una
  // marcación; `null` (SSR) no ocurre en la práctica.
  if (now === null) return 0;
  // `now` está redondeado hacia abajo al segundo, así que `ceil` sumaría uno
  // de más ("4 s" en una espera de 3 s); `floor` compensa ese redondeo.
  return Math.max(0, Math.floor((deadline - now) / 1000));
}
