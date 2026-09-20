export type GuideState = "esperando" | "detectando" | "listo";

export interface GuideTransitionInput {
  currentState: GuideState;
  faceDetected: boolean;
  stableFrameCount: number;
  framesRequiredToCapture: number;
}

export interface GuideTransitionResult {
  nextState: GuideState;
  nextStableFrameCount: number;
  shouldCapture: boolean;
}

export function nextGuideState({
  faceDetected,
  stableFrameCount,
  framesRequiredToCapture,
}: GuideTransitionInput): GuideTransitionResult {
  if (!faceDetected) {
    return { nextState: "esperando", nextStableFrameCount: 0, shouldCapture: false };
  }

  const nextStableFrameCount = stableFrameCount + 1;

  if (nextStableFrameCount >= framesRequiredToCapture) {
    return { nextState: "listo", nextStableFrameCount, shouldCapture: true };
  }

  return { nextState: "detectando", nextStableFrameCount, shouldCapture: false };
}
