"use client";

import jsQR from "jsqr";
import { type RefObject, useEffect, useRef } from "react";
import { parseCarnetQr } from "@/lib/carnetQr";

const SCAN_EVERY_MS = 150;
// Suficiente para un QR mostrado desde un celular a 20–40 cm; más resolución
// solo gasta CPU que el kiosko necesita para el detector facial.
const MAX_SCAN_WIDTH = 640;

/**
 * Busca el QR del carnet virtual en el video mientras `enabled` sea true.
 * Llama a `onCarnet` una sola vez por activación, con el texto leído.
 */
export function useQrScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onCarnet: (qr: string) => void
) {
  const onCarnetRef = useRef(onCarnet);
  useEffect(() => {
    onCarnetRef.current = onCarnet;
  }, [onCarnet]);

  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    let done = false;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (done || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;

      const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      // Los píxeles del video llegan sin espejar (el espejo es solo CSS): así los necesita jsQR.
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

      // Pantalla de celular = módulos oscuros sobre claro: no hace falta probar invertido.
      const code = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
      if (code && parseCarnetQr(code.data)) {
        done = true;
        clearInterval(interval);
        onCarnetRef.current(code.data);
      }
    }, SCAN_EVERY_MS);

    return () => {
      done = true;
      clearInterval(interval);
    };
  }, [enabled, videoRef]);
}
