import * as faceapi from "face-api.js";
import { DEFAULT_CONFIG, matchThresholdFor } from "@/lib/configRules";
import { prisma } from "./prisma";

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

/**
 * @param threshold Distancia máxima aceptada; sale de "Exigencia del
 *   reconocimiento" en Configuración (4g).
 */
export async function findMatch(
  descriptor: Float32Array,
  threshold = matchThresholdFor(DEFAULT_CONFIG.exigenciaReconocimiento)
): Promise<MatchResult | null> {
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

  const matcher = new faceapi.FaceMatcher(labeled, threshold);
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
