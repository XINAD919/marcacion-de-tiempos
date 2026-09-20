import { describe, expect, it } from "vitest";
import { nextGuideState } from "./guideState";

describe("nextGuideState", () => {
  it("vuelve a esperando y resetea el contador cuando no hay rostro", () => {
    const result = nextGuideState({
      currentState: "detectando",
      faceDetected: false,
      stableFrameCount: 5,
      framesRequiredToCapture: 8,
    });

    expect(result).toEqual({ nextState: "esperando", nextStableFrameCount: 0, shouldCapture: false });
  });

  it("pasa a detectando y suma un frame estable mientras no llega al umbral", () => {
    const result = nextGuideState({
      currentState: "esperando",
      faceDetected: true,
      stableFrameCount: 0,
      framesRequiredToCapture: 8,
    });

    expect(result).toEqual({ nextState: "detectando", nextStableFrameCount: 1, shouldCapture: false });
  });

  it("pasa a listo y marca shouldCapture cuando alcanza el umbral de frames estables", () => {
    const result = nextGuideState({
      currentState: "detectando",
      faceDetected: true,
      stableFrameCount: 7,
      framesRequiredToCapture: 8,
    });

    expect(result).toEqual({ nextState: "listo", nextStableFrameCount: 8, shouldCapture: true });
  });
});
