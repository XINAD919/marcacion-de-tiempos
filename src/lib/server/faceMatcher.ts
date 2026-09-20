import * as faceapi from "face-api.js";
import { prisma } from "./prisma";

export const DEFAULT_MATCH_THRESHOLD = 0.5;

function getMatchThreshold(): number {
  const raw = process.env.FACE_MATCH_THRESHOLD;
  return raw ? Number(raw) : DEFAULT_MATCH_THRESHOLD;
}

export function descriptorToBuffer(descriptor: Float32Array): Buffer<ArrayBuffer> {
  // Face descriptors are always plain Float32Arrays backed by a real ArrayBuffer at
  // runtime (this project never uses worker_threads/SharedArrayBuffer). TypeScript's
  // lib types only know Float32Array as generic over ArrayBufferLike (which includes
  // SharedArrayBuffer), so Buffer.from() infers the wider Buffer<ArrayBufferLike> here.
  // Prisma's generated type for the `embedding Bytes` column requires the concrete
  // Buffer<ArrayBuffer> form, so we assert the narrower, always-true type.
  return Buffer.from(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength) as Buffer<ArrayBuffer>;
}

export function bufferToDescriptor(buffer: Buffer): Float32Array {
  return new Float32Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
}

export interface MatchResult {
  userId: string;
  distance: number;
}

export async function findMatch(descriptor: Float32Array): Promise<MatchResult | null> {
  const rows = await prisma.faceEmbedding.findMany({
    where: { user: { activo: true } },
    select: { userId: true, embedding: true },
  });

  if (rows.length === 0) return null;

  const byUser = new Map<string, Float32Array[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(bufferToDescriptor(row.embedding as Buffer));
    byUser.set(row.userId, list);
  }

  const labeled = Array.from(byUser.entries()).map(
    ([userId, descriptors]) => new faceapi.LabeledFaceDescriptors(userId, descriptors)
  );

  const matcher = new faceapi.FaceMatcher(labeled, getMatchThreshold());
  const best = matcher.findBestMatch(descriptor);

  if (best.label === "unknown") return null;
  return { userId: best.label, distance: best.distance };
}

export async function saveEnrollmentDescriptor(
  userId: string,
  descriptor: Float32Array,
  modelo: string
): Promise<void> {
  await prisma.faceEmbedding.create({
    data: { userId, embedding: descriptorToBuffer(descriptor), modelo },
  });
}
