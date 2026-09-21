"use client";

// face-api.js only depends on @tensorflow/tfjs-core (the math/graph engine),
// not on any executable backend, and tfjs-core no longer auto-registers the
// classic chainable Tensor methods (.toFloat(), etc.) that face-api.js's
// code was written against — that registration, plus the CPU/WebGL
// backends, is bundled into the full @tensorflow/tfjs package. Importing it
// registers everything as a side effect. (Server-side, @tensorflow/tfjs-node
// does the equivalent registration itself, which is why this was only ever
// missing client-side.)
import "@tensorflow/tfjs";
import * as faceapi from "face-api.js";

let modelPromise: Promise<void> | null = null;

export function loadDetectionModel(modelUrl = "/models"): Promise<void> {
  if (!modelPromise) {
    modelPromise = faceapi.tf
      .setBackend("webgl")
      .then(() => faceapi.tf.ready())
      .then(() => faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl));
  }
  return modelPromise;
}

export async function detectFace(video: HTMLVideoElement): Promise<boolean> {
  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
  return Boolean(detection);
}
