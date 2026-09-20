"use client";

import * as faceapi from "face-api.js";

let modelPromise: Promise<void> | null = null;

export function loadDetectionModel(modelUrl = "/models"): Promise<void> {
  if (!modelPromise) {
    modelPromise = faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
  }
  return modelPromise;
}

export async function detectFace(video: HTMLVideoElement): Promise<boolean> {
  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
  return Boolean(detection);
}
