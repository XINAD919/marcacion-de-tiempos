import path from "node:path";
import "@tensorflow/tfjs-node";
import { Canvas, Image, ImageData, loadImage } from "canvas";
import * as faceapi from "face-api.js";

const MODELS_PATH = path.join(process.cwd(), "public", "models");

let modelsLoaded: Promise<void> | null = null;

function loadModels(): Promise<void> {
  if (!modelsLoaded) {
    // monkeyPatch() only auto-detects an environment (via isNodejs()/isBrowser())
    // if none is set yet. That detection checks for require/module as plain CJS
    // globals, which isn't reliable under Turbopack — true both at build time
    // ("Collecting page data" statically imports this module) and at real
    // request-handling time (route handlers also run in a Turbopack-compiled
    // module context). Rather than depend on that detection at all, set the
    // Node environment explicitly first; monkeyPatch() then just overlays
    // Canvas/Image/ImageData onto it without ever calling isNodejs().
    faceapi.env.setEnv(faceapi.env.createNodejsEnv());
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
