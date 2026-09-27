import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { MultipleFacesDetectedError, NoFaceDetectedError, analyzeFace } from "@/lib/server/faceEngine";
import {
  deleteEnrollmentDescriptors,
  replaceEnrollment,
  saveEnrollmentDescriptor,
} from "@/lib/server/faceMatcher";
import { prisma } from "@/lib/server/prisma";

const MODEL_VERSION = "face-api-recognition-v1";
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;
// Por debajo de esta confianza del detector la foto suele estar movida, con
// poca luz o de perfil: se guarda, pero se sugiere repetirla.
const GOOD_QUALITY_SCORE = 0.75;

type Context = { params: Promise<{ userId: string }> };

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

/** Agrega una foto al enrolamiento. Responde su id y si la calidad es buena. */
export async function POST(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user) return unauthorized();

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
    const { descriptor, score } = await analyzeFace(buffer);
    const id = await saveEnrollmentDescriptor(userId, descriptor, MODEL_VERSION);
    return NextResponse.json(
      { id, calidad: score >= GOOD_QUALITY_SCORE ? "buena" : "baja" },
      { status: 201 }
    );
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
}

/** Borra fotos de esta sesión de enrolamiento ("Repetir" y "Cancelar"). */
export async function DELETE(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const { userId } = await params;
  const ids = stringList((await request.json().catch(() => null))?.ids);
  if (!ids) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  return NextResponse.json({ eliminadas: await deleteEnrollmentDescriptors(userId, ids) });
}

/** "Guardar rostro": conserva las fotos de esta sesión y reemplaza las anteriores. */
export async function PUT(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const { userId } = await params;
  const conservar = stringList((await request.json().catch(() => null))?.conservar);
  // Sin fotos que conservar esto borraría el rostro completo: nunca es lo que se quiere.
  if (!conservar || conservar.length === 0) {
    return NextResponse.json({ error: "No hay fotos para guardar" }, { status: 400 });
  }

  return NextResponse.json({ eliminadas: await replaceEnrollment(userId, conservar) });
}
