import { NextResponse } from "next/server";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "@/lib/server/faceEngine";
import { findMatch } from "@/lib/server/faceMatcher";
import { prisma } from "@/lib/server/prisma";

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

  return NextResponse.json({ matched: true, nombre: user.nombre, hora: log.marcadoEn.toISOString(), tipo });
}
