import { readFile } from "node:fs/promises";
import path from "node:path";
import * as faceapi from "face-api.js";
import { describe, expect, it } from "vitest";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "./faceEngine";

const fixturesDir = path.join(process.cwd(), "test", "fixtures", "faces");

async function loadFixture(filename: string): Promise<Buffer> {
  return readFile(path.join(fixturesDir, filename));
}

describe("getFaceDescriptor", () => {
  it(
    "returns a 128-length descriptor for a photo with exactly one face",
    async () => {
      const descriptor = await getFaceDescriptor(await loadFixture("persona-a-1.jpg"));
      expect(descriptor).toBeInstanceOf(Float32Array);
      expect(descriptor.length).toBe(128);
    },
    20000
  );

  it(
    "produces a descriptor closer to the same person than to a different one",
    async () => {
      const a1 = await getFaceDescriptor(await loadFixture("persona-a-1.jpg"));
      const a2 = await getFaceDescriptor(await loadFixture("persona-a-2.jpg"));
      const b1 = await getFaceDescriptor(await loadFixture("persona-b-1.jpg"));

      const distanceSamePerson = faceapi.euclideanDistance(a1, a2);
      const distanceDifferentPerson = faceapi.euclideanDistance(a1, b1);

      expect(distanceSamePerson).toBeLessThan(distanceDifferentPerson);
    },
    20000
  );

  it(
    "throws NoFaceDetectedError when the photo has no face",
    async () => {
      await expect(getFaceDescriptor(await loadFixture("sin-rostro.jpg"))).rejects.toBeInstanceOf(
        NoFaceDetectedError
      );
    },
    20000
  );

  it(
    "throws MultipleFacesDetectedError when the photo has more than one face",
    async () => {
      await expect(
        getFaceDescriptor(await loadFixture("varios-rostros.jpg"))
      ).rejects.toBeInstanceOf(MultipleFacesDetectedError);
    },
    20000
  );
});
