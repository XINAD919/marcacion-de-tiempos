"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type FailureStreak, registerFailure } from "@/lib/client/failureStreak";
import { type MarcacionResult, interpretMarcacionResponse } from "@/lib/client/marcacionResult";
import { useFaceGuide } from "@/lib/client/useFaceGuide";
import { useQrScanner } from "@/lib/client/useQrScanner";
import { FaceOval } from "./_components/face-oval";
import { KioskoHeader } from "./_components/kiosko-header";
import {
  EntradaScreen,
  FalloScreen,
  SalidaAnticipadaScreen,
  SalidaScreen,
} from "./_components/result-screens";
import { DetectingPanel, EquipmentErrorPanel, WaitingPanel } from "./_components/status-panel";

// TODO: identificar cada kiosko (p. ej. por sede/punto) cuando exista el
// módulo de Entidades y sedes (maqueta 4f).
const DEVICE_ID = "kiosko-1";

/** Cuánto se queda cada resultado en pantalla antes de volver a la cámara. */
const RETURN_AFTER_MS = {
  entrada: 3000,
  // La salida muestra tres cifras (hora, jornada, acumulado): un poco más.
  salida: 5000,
  // Hay que leer desde cuándo se puede salir y a quién acudir.
  "salida-anticipada": 7000,
  // Un intento más: vuelve rápido a la cámara.
  reintento: 4000,
  // La maqueta 1e muestra "00:08"; se amplía porque ahora en esta pantalla
  // hay que sacar el celular y buscar el carnet virtual.
  fallo: 15000,
  // Carnet no válido: solo hay que leer a quién acudir.
  carnet: 6000,
} as const;

// Si pasan más de 2 min entre fallos, probablemente es otra persona.
const FAILURE_STREAK_RESET_MS = 2 * 60_000;

export interface FailureInfo {
  attempt: number;
  limit: number;
  offerFallback: boolean;
}

type Phase =
  | { name: "camara" }
  | { name: "enviando" }
  | {
      name: "resultado";
      result: MarcacionResult;
      photoUrl: string | null;
      deadline: number;
      failure: FailureInfo | null;
    };

export function Kiosko({ initialIntentosAntesQr }: { initialIntentosAntesQr: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, error: modelError, progress, captureFrame, hasCaptured, reset } = useFaceGuide(videoRef);
  const [phase, setPhase] = useState<Phase>({ name: "camara" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const failureStreakRef = useRef<FailureStreak | null>(null);
  const intentosAntesQrRef = useRef(initialIntentosAntesQr);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const releasePhoto = useCallback(() => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
  }, []);

  const backToCamera = useCallback(() => {
    releasePhoto();
    setPhase({ name: "camara" });
    reset();
  }, [releasePhoto, reset]);

  // Cámara: se abre una vez y se libera al salir de la página.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      })
      .catch(() => setCameraError("La cámara no está disponible"));

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => releasePhoto, [releasePhoto]);

  /** Pinta un resultado y fija cuándo vuelve sola la cámara. */
  const present = useCallback((result: MarcacionResult, photoUrl: string | null, via: "face" | "qr") => {
    const now = Date.now();
    let failure: FailureInfo | null = null;
    let returnAfter: number;

    if (result.kind === "fallo" && via === "qr") {
      // El QR ya era el respaldo: no suma a la racha, remite a coordinación.
      returnAfter = RETURN_AFTER_MS.carnet;
    } else if (result.kind === "fallo") {
      if (result.intentosAntesQr) intentosAntesQrRef.current = result.intentosAntesQr;
      const limit = intentosAntesQrRef.current;
      const outcome = registerFailure(failureStreakRef.current, now, limit, FAILURE_STREAK_RESET_MS);
      failureStreakRef.current = outcome.streak;
      failure = { attempt: outcome.attempt, limit, offerFallback: outcome.offerFallback };
      returnAfter = outcome.offerFallback ? RETURN_AFTER_MS.fallo : RETURN_AFTER_MS.reintento;
    } else {
      // Cualquier reconocimiento corta la racha de fallos.
      failureStreakRef.current = null;
      returnAfter = RETURN_AFTER_MS[result.kind];
    }

    setPhase({ name: "resultado", result, photoUrl, deadline: now + returnAfter, failure });
  }, []);

  // Captura → envío → resultado.
  useEffect(() => {
    if (!hasCaptured || !videoRef.current) return;

    let cancelled = false;
    const video = videoRef.current;

    async function mark() {
      const blob = await captureFrame(video);
      if (cancelled) return;
      if (!blob) {
        backToCamera();
        return;
      }

      setPhase({ name: "enviando" });
      releasePhoto();
      photoUrlRef.current = URL.createObjectURL(blob);

      const formData = new FormData();
      formData.append("foto", blob, "foto.jpg");
      formData.append("deviceId", DEVICE_ID);

      let result: MarcacionResult;
      try {
        const response = await fetch("/api/marcacion", { method: "POST", body: formData });
        result = interpretMarcacionResponse(response.status, await response.json().catch(() => null));
      } catch {
        result = { kind: "fallo", reason: "error" };
      }
      if (cancelled) return;

      present(result, photoUrlRef.current, "face");
    }

    void mark();
    return () => {
      cancelled = true;
    };
  }, [hasCaptured, captureFrame, backToCamera, releasePhoto, present]);

  // Respaldo (1e): tras agotar los intentos, busca el QR del carnet virtual en la cámara.
  const offeringFallback = phase.name === "resultado" && phase.failure?.offerFallback === true;
  const markWithQr = useCallback(
    async (qr: string) => {
      setPhase({ name: "enviando" });
      releasePhoto();

      let result: MarcacionResult;
      try {
        const response = await fetch("/api/marcacion/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr, deviceId: DEVICE_ID }),
        });
        result = interpretMarcacionResponse(response.status, await response.json().catch(() => null));
      } catch {
        result = { kind: "fallo", reason: "error" };
      }
      present(result, null, "qr");
    },
    [present, releasePhoto]
  );
  useQrScanner(videoRef, offeringFallback, markWithQr);

  // Vuelve sola al estado de espera: nadie tiene que tocar nada.
  useEffect(() => {
    if (phase.name !== "resultado") return;
    const timeout = setTimeout(backToCamera, phase.deadline - Date.now());
    return () => clearTimeout(timeout);
  }, [phase, backToCamera]);

  const equipmentError = cameraError ?? (modelError ? "El reconocimiento no está disponible" : null);
  const detecting = phase.name === "enviando" || state !== "esperando";

  return (
    <div
      data-testid="kiosko"
      data-guide-state={state}
      data-phase={phase.name}
      className="kiosko-canvas fixed inset-0 flex cursor-none flex-col overflow-hidden bg-navy text-white select-none"
    >
      <KioskoHeader />

      <div className="relative min-h-0 flex-1 bg-navy-2">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 size-full -scale-x-100 object-cover"
        />
        {!equipmentError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <FaceOval detecting={detecting} />
          </div>
        )}
      </div>

      <div
        aria-live="polite"
        className="flex min-h-190 flex-none flex-col justify-center bg-navy px-36 py-30 text-center"
      >
        {equipmentError ? (
          <EquipmentErrorPanel message={equipmentError} />
        ) : detecting ? (
          <DetectingPanel progress={phase.name === "enviando" ? 1 : progress} />
        ) : (
          <WaitingPanel />
        )}
      </div>

      {phase.name === "resultado" && <ResultScreen phase={phase} stream={stream} />}
    </div>
  );
}

function ResultScreen({
  phase,
  stream,
}: {
  phase: Extract<Phase, { name: "resultado" }>;
  stream: MediaStream | null;
}) {
  const { result, photoUrl, deadline, failure } = phase;
  switch (result.kind) {
    case "entrada":
      return <EntradaScreen result={result} photoUrl={photoUrl} deadline={deadline} />;
    case "salida":
      return <SalidaScreen result={result} photoUrl={photoUrl} deadline={deadline} />;
    case "salida-anticipada":
      return <SalidaAnticipadaScreen result={result} deadline={deadline} />;
    case "fallo":
      return <FalloScreen reason={result.reason} deadline={deadline} failure={failure} stream={stream} />;
  }
}
