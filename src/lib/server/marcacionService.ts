import type { Prisma } from "@prisma/client";
import { type ConfigValues, reglasPara } from "@/lib/configRules";
import { describeAfiliacion } from "@/lib/usuarios/tipoUsuario";
import { earlyExitUntil, lateMinutes } from "./markingRules";
import { prisma } from "./prisma";
import { AFILIACION_INCLUDE } from "./usuarioService";
import { sumWorkedMs } from "./workedTime";

export type UsuarioMarcacion = Prisma.UserGetPayload<{ include: typeof AFILIACION_INCLUDE }>;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

interface MarkInput {
  metodo: "face" | "qr";
  /** Distancia facial; `null` en marcaciones por QR. */
  confianza: number | null;
  deviceId: string;
}

/**
 * Registra ENTRADA o SALIDA de alguien ya identificado (por rostro o por el
 * QR del carnet) y arma la respuesta que pinta el kiosko.
 */
export async function registrarMarcacion(user: UsuarioMarcacion, config: ConfigValues, { metodo, confianza, deviceId }: MarkInput) {
  // Tolerancia y mínimo antes de la salida dependen del tipo de usuario.
  const reglas = reglasPara(config, user.tipo);
  const lastLogToday = await prisma.attendanceLog.findFirst({
    where: { userId: user.id, marcadoEn: { gte: startOfToday() } },
    orderBy: { marcadoEn: "desc" },
  });

  const tipo = lastLogToday?.tipo === "IN" ? "OUT" : "IN";
  const now = new Date();

  // Salida demasiado pronto: casi siempre es alguien que pasó dos veces por
  // el kiosko. No se registra nada; coordinación puede marcarla a mano.
  if (lastLogToday && tipo === "OUT") {
    const disponibleDesde = earlyExitUntil(lastLogToday.marcadoEn, now, reglas.minMinutosAntesSalida);
    if (disponibleDesde) {
      console.info(`[marcacion] Salida anticipada rechazada: userId=${user.id} deviceId=${deviceId}`);
      return {
        matched: true,
        bloqueado: "salida-anticipada",
        nombre: user.nombre,
        entrada: lastLogToday.marcadoEn.toISOString(),
        disponibleDesde: disponibleDesde.toISOString(),
      };
    }
  }

  const log = await prisma.attendanceLog.create({
    data: { userId: user.id, tipo, metodo, confianza, deviceId, marcadoEn: now },
  });

  const base = {
    matched: true,
    nombre: user.nombre,
    afiliacion: describeAfiliacion(user),
    hora: log.marcadoEn.toISOString(),
    tipo,
  };

  if (tipo === "IN") {
    // La llegada tarde se deriva del horario; no se guarda en el registro.
    return { ...base, tardeMin: lateMinutes(log.marcadoEn, user.horaInicio, reglas.toleranciaLlegadaMin) };
  }

  // La salida muestra en el kiosko la jornada del día y las horas acumuladas;
  // ambas se derivan de los registros, nunca de un campo guardado.
  const marks = await prisma.attendanceLog.findMany({
    where: { userId: user.id },
    select: { tipo: true, marcadoEn: true },
  });
  const today = startOfToday();
  const options = { maxDailyMs: config.jornadaMaximaHoras * 60 * 60 * 1000 };

  return {
    ...base,
    jornadaMs: sumWorkedMs(marks.filter((mark) => mark.marcadoEn >= today), options),
    acumuladoMs: sumWorkedMs(marks, options),
  };
}
