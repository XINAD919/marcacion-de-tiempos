"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceGuide } from "@/lib/client/useFaceGuide";

type Feedback = { nombre: string; hora: string; tipo: string } | { matched: false } | null;

export default function MarcacionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, error: guideError, captureFrame, hasCaptured, reset } = useFaceGuide(videoRef);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setError("No se pudo acceder a la cámara");
      });
  }, []);

  useEffect(() => {
    if (!hasCaptured || !videoRef.current) return;

    let cancelled = false;
    let resetTimeout: ReturnType<typeof setTimeout> | undefined;

    captureFrame(videoRef.current).then((blob) => {
      if (!blob || cancelled) return;

      const formData = new FormData();
      formData.append("foto", blob, "foto.jpg");
      formData.append("deviceId", "kiosko-1");

      fetch("/api/marcacion", { method: "POST", body: formData })
        .then((response) => response.json())
        .then((body) => {
          if (cancelled) return;
          if (body.error) {
            setError(body.error);
          } else {
            setFeedback(body);
          }
        })
        .catch(() => {
          if (!cancelled) setError("No se pudo conectar con el servidor");
        })
        .finally(() => {
          if (cancelled) return;
          // Vuelve sola al estado de espera (~3 s) sin interacción del practicante.
          resetTimeout = setTimeout(() => {
            setFeedback(null);
            setError(null);
            reset();
          }, 3000);
        });
    });

    return () => {
      cancelled = true;
      if (resetTimeout) clearTimeout(resetTimeout);
    };
  }, [hasCaptured, captureFrame, reset]);

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <p data-testid="guide-state">{state}</p>
      {(error || guideError) && <p role="alert">{error ?? guideError}</p>}
      {feedback && "nombre" in feedback && (
        <p>
          {feedback.nombre} — {feedback.tipo} — {feedback.hora}
        </p>
      )}
      {feedback && "matched" in feedback && feedback.matched === false && <p>No reconocido</p>}
    </div>
  );
}
