"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectFace, loadDetectionModel } from "./faceDetection";
import { type GuideState, nextGuideState } from "./guideState";

const FRAMES_REQUIRED_TO_CAPTURE = 8;

export function useFaceGuide(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<GuideState>("esperando");
  const stableFrameCount = useRef(0);
  const capturedRef = useRef(false);

  const captureFrame = useCallback((video: HTMLVideoElement): Blob | null => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    let result: Blob | null = null;
    canvas.toBlob((blob) => {
      result = blob;
    }, "image/jpeg");
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frameHandle: number;

    loadDetectionModel().then(function loop() {
      if (cancelled) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || capturedRef.current) {
        frameHandle = requestAnimationFrame(loop);
        return;
      }

      detectFace(video).then((faceDetected) => {
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
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  return { state, captureFrame, hasCaptured: capturedRef.current };
}
