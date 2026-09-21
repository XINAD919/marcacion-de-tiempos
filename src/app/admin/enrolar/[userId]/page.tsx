"use client";

import { use, useEffect, useRef, useState } from "react";
import { useFaceGuide } from "@/lib/client/useFaceGuide";

export default function EnrolarPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, error: guideError, captureFrame, hasCaptured, reset } = useFaceGuide(videoRef);
  const [capturas, setCapturas] = useState(0);
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
    if (!hasCaptured || !videoRef.current || capturas >= 5) return;

    let cancelled = false;

    captureFrame(videoRef.current).then((blob) => {
      if (!blob || cancelled) return;

      const formData = new FormData();
      formData.append("foto", blob, "foto.jpg");

      fetch(`/api/usuarios/${userId}/enrolar`, { method: "POST", body: formData })
        .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
        .then(({ ok, body }) => {
          if (cancelled) return;
          if (!ok) {
            setError(body.error);
            // Se permite reintentar la siguiente captura en lugar de dejar el
            // flujo bloqueado hasta recargar la página.
            reset();
            return;
          }
          setCapturas((count) => count + 1);
          reset();
        })
        .catch(() => {
          if (cancelled) return;
          setError("No se pudo conectar con el servidor");
          reset();
        });
    });

    return () => {
      cancelled = true;
    };
  }, [hasCaptured, captureFrame, userId, capturas, reset]);

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <p data-testid="guide-state">{state}</p>
      <p>
        Fotos capturadas: {capturas} / 5
      </p>
      {(error || guideError) && <p role="alert">{error ?? guideError}</p>}
    </div>
  );
}
