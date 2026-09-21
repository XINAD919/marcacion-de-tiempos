import { NextResponse } from "next/server";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "@/lib/server/faceEngine";
import { saveEnrollmentDescriptor } from "@/lib/server/faceMatcher";
import { prisma } from "@/lib/server/prisma";

const MODEL_VERSION = "face-api-recognition-v1";
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const formData = await request.formData();
  const foto = formData.get("foto");

  if (!(foto instanceof Blob)) {
    return NextResponse.json({ error: "Falta la foto" }, { status: 400 });
  }

  if (!ALLOWED_PHOTO_TYPES.has(foto.type)) {
    return NextResponse.json({ error: "Formato de imagen no soportado" }, { status: 400 });
  }

  if (foto.size > MAX_PHOTO_SIZE_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande" }, { status: 400 });
  }

  const buffer = Buffer.from(await foto.arrayBuffer());

  try {
    const descriptor = await getFaceDescriptor(buffer);
    await saveEnrollmentDescriptor(userId, descriptor, MODEL_VERSION);
  } catch (error) {
    if (error instanceof NoFaceDetectedError) {
      return NextResponse.json({ error: "No se detectó ningún rostro" }, { status: 422 });
    }
    if (error instanceof MultipleFacesDetectedError) {
      return NextResponse.json(
        { error: "Se detectaron varios rostros, asegúrate de estar solo frente a la cámara" },
        { status: 422 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
