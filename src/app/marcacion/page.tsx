"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceGuide } from "@/lib/client/useFaceGuide";

type Feedback = { nombre: string; hora: string; tipo: string } | { matched: false } | null;

export default function MarcacionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, captureFrame, hasCaptured } = useFaceGuide(videoRef);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  useEffect(() => {
    if (!hasCaptured || !videoRef.current) return;
    const blob = captureFrame(videoRef.current);
    if (!blob) return;

    const formData = new FormData();
    formData.append("foto", blob, "foto.jpg");
    formData.append("deviceId", "kiosko-1");

    fetch("/api/marcacion", { method: "POST", body: formData })
      .then((response) => response.json())
      .then((body) => {
        if (body.error) {
          setError(body.error);
          return;
        }
        setFeedback(body);
      });
  }, [hasCaptured, captureFrame]);

  return (
    <div>
      <video ref={videoRef} autoPlay muted playsInline />
      <p data-testid="guide-state">{state}</p>
      {error && <p role="alert">{error}</p>}
      {feedback && "nombre" in feedback && (
        <p>
          {feedback.nombre} — {feedback.tipo} — {feedback.hora}
        </p>
      )}
      {feedback && "matched" in feedback && feedback.matched === false && <p>No reconocido</p>}
    </div>
  );
}
