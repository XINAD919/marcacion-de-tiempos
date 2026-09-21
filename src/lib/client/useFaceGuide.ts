"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectFace, loadDetectionModel } from "./faceDetection";
import { type GuideState, nextGuideState } from "./guideState";

const FRAMES_REQUIRED_TO_CAPTURE = 8;

export function useFaceGuide(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<GuideState>("esperando");
  const [error, setError] = useState<string | null>(null);
  const stableFrameCount = useRef(0);
  const capturedRef = useRef(false);

  const reset = useCallback(() => {
    capturedRef.current = false;
    stableFrameCount.current = 0;
    setState("esperando");
  }, []);

  const captureFrame = useCallback((video: HTMLVideoElement): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg");
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frameHandle: number;

    loadDetectionModel()
      .then(function loop() {
        if (cancelled) return;

        const video = videoRef.current;
        if (!video || video.readyState < 2 || capturedRef.current) {
          frameHandle = requestAnimationFrame(loop);
          return;
        }

        detectFace(video)
          .then((faceDetected) => {
            if (cancelled) return;

            const result = nextGuideState({
              currentState: state,
              faceDetected,
              stableFrameCount: stableFrameCount.current,
              framesRequiredToCapture: FRAMES_REQUIRED_TO_CAPTURE,
            });

            stableFrameCount.current = result.nextStableFrameCount;
            setState(result.nextState);

            if (result.shouldCapture) {
              capturedRef.current = true;
            }

            frameHandle = requestAnimationFrame(loop);
          })
          .catch((detectionError) => {
            // Transient errors (e.g. a frame not ready yet) shouldn't be fatal:
            // log and keep the loop alive so it can recover on the next frame.
            console.error("Error detectando rostro:", detectionError);
            if (!cancelled) frameHandle = requestAnimationFrame(loop);
          });
      })
      .catch((modelError) => {
        // The model failing to load is fundamental — there's no frame to retry,
        // so surface it instead of silently spinning forever.
        console.error("Error cargando el modelo de detección facial:", modelError);
        if (!cancelled) setError("No se pudo cargar el modelo de reconocimiento facial");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  return { state, error, captureFrame, hasCaptured: capturedRef.current, reset };
}
