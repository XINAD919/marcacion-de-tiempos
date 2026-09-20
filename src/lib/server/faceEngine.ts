import path from "node:path";
import "@tensorflow/tfjs-node";
import { Canvas, Image, ImageData, loadImage } from "canvas";
import * as faceapi from "face-api.js";

const MODELS_PATH = path.join(process.cwd(), "public", "models");

let modelsLoaded: Promise<void> | null = null;

function loadModels(): Promise<void> {
  if (!modelsLoaded) {
    // Must run lazily (inside loadModels, not at module top-level): monkeyPatch()
    // calls face-api.js's isNodejs()/isBrowser() auto-detection the first time an
    // environment isn't set, and that detection fails when Next's Turbopack build
    // statically imports this module during "Collecting page data" (a build-worker
    // context where require/module aren't plain CJS globals). Deferring it until a
    // route handler actually calls getFaceDescriptor() means it only ever runs in a
    // real Node.js request process, where isNodejs() correctly returns true.
    faceapi.env.monkeyPatch({
      Canvas: Canvas as unknown as typeof HTMLCanvasElement,
      Image: Image as unknown as typeof HTMLImageElement,
      ImageData: ImageData as unknown as typeof globalThis.ImageData,
    });
    modelsLoaded = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH),
    ]).then(() => undefined);
  }
  return modelsLoaded;
}

export class NoFaceDetectedError extends Error {
  constructor() {
    super("No se detectó ningún rostro");
    this.name = "NoFaceDetectedError";
  }
}

export class MultipleFacesDetectedError extends Error {
  constructor() {
    super("Se detectaron varios rostros");
    this.name = "MultipleFacesDetectedError";
  }
}

export async function getFaceDescriptor(imageBuffer: Buffer): Promise<Float32Array> {
  await loadModels();
  const image = await loadImage(imageBuffer);

  const detections = await faceapi
    .detectAllFaces(image as unknown as HTMLImageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) throw new NoFaceDetectedError();
  if (detections.length > 1) throw new MultipleFacesDetectedError();

  return detections[0].descriptor;
}
