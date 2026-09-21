import { NextResponse } from "next/server";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "@/lib/server/faceEngine";
import { findMatch } from "@/lib/server/faceMatcher";
import { prisma } from "@/lib/server/prisma";

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const foto = formData.get("foto");
  const deviceId = formData.get("deviceId");

  if (!(foto instanceof Blob) || typeof deviceId !== "string") {
    return NextResponse.json(
      { error: "Falta la foto o el identificador del kiosko" },
      { status: 400 }
    );
  }

  if (!ALLOWED_PHOTO_TYPES.has(foto.type)) {
    return NextResponse.json({ error: "Formato de imagen no soportado" }, { status: 400 });
  }

  if (foto.size > MAX_PHOTO_SIZE_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande" }, { status: 400 });
  }

  const buffer = Buffer.from(await foto.arrayBuffer());

  let descriptor: Float32Array;
  try {
    descriptor = await getFaceDescriptor(buffer);
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

  const match = await findMatch(descriptor);
  if (!match) {
    console.info(
      `[marcacion] Sin coincidencia: deviceId=${deviceId} en=${new Date().toISOString()}`
    );
    return NextResponse.json({ matched: false });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: match.userId } });
  const lastLogToday = await prisma.attendanceLog.findFirst({
    where: { userId: user.id, marcadoEn: { gte: startOfToday() } },
    orderBy: { marcadoEn: "desc" },
  });

  const tipo = lastLogToday?.tipo === "IN" ? "OUT" : "IN";

  const log = await prisma.attendanceLog.create({
    data: { userId: user.id, tipo, metodo: "face", confianza: match.distance, deviceId },
  });

  console.info(
    `[marcacion] Coincidencia: userId=${user.id} distance=${match.distance} deviceId=${deviceId}`
  );

  return NextResponse.json({ matched: true, nombre: user.nombre, hora: log.marcadoEn.toISOString(), tipo });
}
