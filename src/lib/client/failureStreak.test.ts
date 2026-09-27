import { describe, expect, it } from "vitest";
import { registerFailure } from "./failureStreak";

const RESET_MS = 2 * 60_000;

describe("registerFailure", () => {
  it("cuenta los fallos seguidos y ofrece el respaldo al llegar al límite", () => {
    const first = registerFailure(null, 0, 3, RESET_MS);
    expect(first).toMatchObject({ attempt: 1, offerFallback: false });

    const second = registerFailure(first.streak, 10_000, 3, RESET_MS);
    expect(second).toMatchObject({ attempt: 2, offerFallback: false });

    const third = registerFailure(second.streak, 20_000, 3, RESET_MS);
    expect(third).toMatchObject({ attempt: 3, offerFallback: true });
  });

  it("tras ofrecer el respaldo vuelve a empezar desde cero", () => {
    let result = registerFailure(null, 0, 2, RESET_MS);
    result = registerFailure(result.streak, 1000, 2, RESET_MS);
    expect(result.offerFallback).toBe(true);

    expect(registerFailure(result.streak, 2000, 2, RESET_MS)).toMatchObject({ attempt: 1 });
  });

  it("si pasa mucho tiempo entre fallos, es otra persona: reinicia la cuenta", () => {
    const first = registerFailure(null, 0, 3, RESET_MS);
    expect(registerFailure(first.streak, RESET_MS + 1, 3, RESET_MS)).toMatchObject({ attempt: 1 });
  });

  it("con límite 1 ofrece el respaldo desde el primer fallo", () => {
    expect(registerFailure(null, 0, 1, RESET_MS)).toMatchObject({ attempt: 1, offerFallback: true });
  });
});
