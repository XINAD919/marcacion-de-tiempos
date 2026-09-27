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

  it("respeta el umbral recibido: el mismo rostro pasa en flexible y no en estricto", async () => {
    const stored = fakeDescriptor(0.1);
    findMany.mockResolvedValue([{ userId: "user-1", embedding: descriptorToBuffer(stored) }]);
    // Distancia euclidiana entre dos vectores de 128 dimensiones que difieren
    // en 0.042 por componente: 0.042 · √128 ≈ 0.475.
    const probe = fakeDescriptor(0.142);

    expect(await findMatch(probe, 0.55)).toMatchObject({ userId: "user-1" });
    expect(await findMatch(probe, 0.45)).toBeNull();
  });

  it("returns null when there are no enrolled users", async () => {
    findMany.mockResolvedValue([]);

    const result = await findMatch(fakeDescriptor(0.1));

    expect(result).toBeNull();
  });
});

describe("saveEnrollmentDescriptor", () => {
  it("persists the descriptor as a buffer via prisma", async () => {
    create.mockResolvedValue({ id: "embedding-1" });
    const descriptor = fakeDescriptor(0.2);

    const id = await saveEnrollmentDescriptor("user-1", descriptor, "face-api-recognition-v1");

    expect(id).toBe("embedding-1");

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        embedding: descriptorToBuffer(descriptor),
        modelo: "face-api-recognition-v1",
      },
      select: { id: true },
    });
  });
});
