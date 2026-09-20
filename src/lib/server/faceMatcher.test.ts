import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const create = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    faceEmbedding: {
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import {
  bufferToDescriptor,
  descriptorToBuffer,
  findMatch,
  saveEnrollmentDescriptor,
} from "./faceMatcher";

function fakeDescriptor(fill: number): Float32Array {
  return new Float32Array(128).fill(fill);
}

describe("descriptorToBuffer / bufferToDescriptor", () => {
  it("round-trips a descriptor through a buffer without losing precision", () => {
    const original = fakeDescriptor(0.42);
    const roundTripped = bufferToDescriptor(descriptorToBuffer(original));
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });
});

describe("findMatch", () => {
  beforeEach(() => {
    findMany.mockReset();
    create.mockReset();
    delete process.env.FACE_MATCH_THRESHOLD;
  });

  it("returns the matching userId when a stored descriptor is close enough", async () => {
    const stored = fakeDescriptor(0.1);
    findMany.mockResolvedValue([{ userId: "user-1", embedding: descriptorToBuffer(stored) }]);

    const result = await findMatch(fakeDescriptor(0.1));

    expect(result).toEqual({ userId: "user-1", distance: 0 });
  });

  it("returns null when no stored descriptor is within the threshold", async () => {
    const stored = fakeDescriptor(0.1);
    findMany.mockResolvedValue([{ userId: "user-1", embedding: descriptorToBuffer(stored) }]);

    const result = await findMatch(fakeDescriptor(5));

    expect(result).toBeNull();
  });

  it("returns null when there are no enrolled users", async () => {
    findMany.mockResolvedValue([]);

    const result = await findMatch(fakeDescriptor(0.1));

    expect(result).toBeNull();
  });
});

describe("saveEnrollmentDescriptor", () => {
  it("persists the descriptor as a buffer via prisma", async () => {
    create.mockResolvedValue(undefined);
    const descriptor = fakeDescriptor(0.2);

    await saveEnrollmentDescriptor("user-1", descriptor, "face-api-recognition-v1");

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        embedding: descriptorToBuffer(descriptor),
        modelo: "face-api-recognition-v1",
      },
    });
  });
});
