import { NextResponse } from "next/server";
import {
  MultipleFacesDetectedError,
  NoFaceDetectedError,
  getFaceDescriptor,
} from "@/lib/server/faceEngine";
import { matchThresholdFor } from "@/lib/configRules";
import { getConfig } from "@/lib/server/config";
import { findMatch } from "@/lib/server/faceMatcher";
import { earlyExitUntil, lateMinutes } from "@/lib/server/markingRules";
import { prisma } from "@/lib/server/prisma";
import { sumWorkedMs } from "@/lib/server/workedTime";

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

  const config = await getConfig();
  const match = await findMatch(descriptor, matchThresholdFor(config.exigenciaReconocimiento));
  if (!match) {
    console.info(
      `[marcacion] Sin coincidencia: deviceId=${deviceId} en=${new Date().toISOString()}`
    );
    // El kiosko cuenta los fallos seguidos y ofrece el QR al llegar a este número.
    return NextResponse.json({ matched: false, intentosAntesQr: config.intentosAntesQr });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: match.userId } });
  const lastLogToday = await prisma.attendanceLog.findFirst({
    where: { userId: user.id, marcadoEn: { gte: startOfToday() } },
    orderBy: { marcadoEn: "desc" },
  });

  const tipo = lastLogToday?.tipo === "IN" ? "OUT" : "IN";
  const now = new Date();

  // Salida demasiado pronto: casi siempre es alguien que pasó dos veces por
  // el kiosko. No se registra nada; coordinación puede marcarla a mano.
  if (lastLogToday && tipo === "OUT") {
    const disponibleDesde = earlyExitUntil(lastLogToday.marcadoEn, now, config.minMinutosAntesSalida);
    if (disponibleDesde) {
      console.info(`[marcacion] Salida anticipada rechazada: userId=${user.id} deviceId=${deviceId}`);
      return NextResponse.json({
        matched: true,
        bloqueado: "salida-anticipada",
        nombre: user.nombre,
        entrada: lastLogToday.marcadoEn.toISOString(),
        disponibleDesde: disponibleDesde.toISOString(),
      });
    }
  }

  const log = await prisma.attendanceLog.create({
    data: { userId: user.id, tipo, metodo: "face", confianza: match.distance, deviceId, marcadoEn: now },
  });

  console.info(
    `[marcacion] Coincidencia: userId=${user.id} distance=${match.distance} deviceId=${deviceId}`
  );

  const base = {
    matched: true,
    nombre: user.nombre,
    universidad: user.universidad,
    entidad: user.entidad,
    hora: log.marcadoEn.toISOString(),
    tipo,
  };

  if (tipo === "IN") {
    // La llegada tarde se deriva del horario; no se guarda en el registro.
    return NextResponse.json({
      ...base,
      tardeMin: lateMinutes(log.marcadoEn, user.horaInicio, config.toleranciaLlegadaMin),
    });
  }

  // La salida muestra en el kiosko la jornada del día y las horas acumuladas;
  // ambas se derivan de los registros, nunca de un campo guardado.
  const marks = await prisma.attendanceLog.findMany({
    where: { userId: user.id },
    select: { tipo: true, marcadoEn: true },
  });
  const today = startOfToday();
  const options = { maxDailyMs: config.jornadaMaximaHoras * 60 * 60 * 1000 };

  return NextResponse.json({
    ...base,
    jornadaMs: sumWorkedMs(marks.filter((mark) => mark.marcadoEn >= today), options),
    acumuladoMs: sumWorkedMs(marks, options),
  });
}
