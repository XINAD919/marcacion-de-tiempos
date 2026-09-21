"use client";

import { use, useEffect, useRef, useState } from "react";
import { useFaceGuide } from "@/lib/client/useFaceGuide";

export default function EnrolarPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, captureFrame, hasCaptured } = useFaceGuide(videoRef);
  const [capturas, setCapturas] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  useEffect(() => {
    if (!hasCaptured || !videoRef.current || capturas >= 5) return;
    captureFrame(videoRef.current).then((blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append("foto", blob, "foto.jpg");

      fetch(`/api/usuarios/${userId}/enrolar`, { method: "POST", body: formData })
        .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
        .then(({ ok, body }) => {
          if (!ok) {
            setError(body.error);
            return;
          }
          setCapturas((count) => count + 1);
        });
    });
  }, [hasCaptured, captureFrame, userId, capturas]);

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <p data-testid="guide-state">{state}</p>
      <p>
        Fotos capturadas: {capturas} / 5
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
