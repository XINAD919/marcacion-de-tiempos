import type { Prisma } from "@prisma/client";
import { esperarHasta, estimadoRestanteMs } from "@/lib/carnets/ritmo";
import { type SendCarnetResult, sendCarnet } from "./carnet";
import { getConfig } from "./config";
import { clasificarMailError, describeMailError } from "./mailer";
import { prisma } from "./prisma";

/** Quién espera su carnet virtual: activo, con correo y sin carnet enviado. */
export const PENDIENTE_WHERE: Prisma.UserWhereInput = {
  activo: true,
  email: { not: null },
  NOT: { email: "" },
  OR: [{ carnet: { is: null } }, { carnet: { is: { enviadoEn: null } } }],
};

const ACTIVOS = ["en-curso", "pausado"];
const VENTANA_MS = 3_600_000;
const ENVIANDO_VENCIDO_MS = 10 * 60_000;
const MOTIVO_REINICIO = "No sabemos si el correo llegó: el servidor se reinició mientras se enviaba";

export function contarPendientes(): Promise<number> {
  return prisma.user.count({ where: PENDIENTE_WHERE });
}

/** Activos sin correo: no entran al envío y la coordinación debe completarlos. */
export function listarSinCorreo(): Promise<{ id: string; nombre: string; cedula: string }[]> {
  return prisma.user.findMany({
    where: { activo: true, OR: [{ email: null }, { email: "" }] },
    select: { id: true, nombre: true, cedula: true },
    orderBy: { nombre: "asc" },
  });
}

export type IniciarEnvioResult =
  | { ok: true; envioId: string; total: number }
  | { ok: false; reason: "hay-otro"; envioId: string }
  | { ok: false; reason: "sin-pendientes" };

/** Un solo envío a la vez: si la transacción choca con otra igual, se reintenta una vez. */
export async function iniciarEnvio(adminId: string): Promise<IniciarEnvioResult> {
  for (let intento = 0; ; intento++) {
    try {
      return await crearEnvio(adminId);
    } catch (error) {
      const choque = (error as { code?: unknown })?.code === "P2034";
      if (!choque) throw error;
      if (intento >= 1) {
        const otro = await prisma.envioCarnets.findFirst({ where: { estado: { in: ACTIVOS } }, select: { id: true } });
        if (otro) return { ok: false, reason: "hay-otro", envioId: otro.id };
        throw error;
      }
    }
  }
}

async function crearEnvio(adminId: string): Promise<IniciarEnvioResult> {
  return prisma.$transaction(
    async (tx): Promise<IniciarEnvioResult> => {
      const otro = await tx.envioCarnets.findFirst({ where: { estado: { in: ACTIVOS } }, select: { id: true } });
      if (otro) return { ok: false, reason: "hay-otro", envioId: otro.id };

      const users = await tx.user.findMany({ where: PENDIENTE_WHERE, select: { id: true } });
      if (users.length === 0) return { ok: false, reason: "sin-pendientes" };

      const envio = await tx.envioCarnets.create({
        data: { iniciadoPorId: adminId, estado: "en-curso", total: users.length },
        select: { id: true },
      });
      // SQL Server admite 2.100 parámetros por consulta.
      for (let i = 0; i < users.length; i += 500) {
        await tx.envioCarnetItem.createMany({
          data: users.slice(i, i + 500).map((user) => ({ envioId: envio.id, userId: user.id, estado: "pendiente" })),
        });
      }
      return { ok: true, envioId: envio.id, total: users.length };
    },
    // Serializable: dos clics casi simultáneos no crean dos envíos.
    { isolationLevel: "Serializable", timeout: 60_000, maxWait: 10_000 }
  );
}

export async function pausarEnvio(envioId: string): Promise<boolean> {
  const { count } = await prisma.envioCarnets.updateMany({
    where: { id: envioId, estado: "en-curso" },
    data: { estado: "pausado" },
  });
  return count > 0;
}

export async function reanudarEnvio(envioId: string): Promise<boolean> {
  const { count } = await prisma.envioCarnets.updateMany({
    where: { id: envioId, estado: "pausado" },
    data: { estado: "en-curso", motivoPausa: null },
  });
  return count > 0;
}

export interface EnvioResumen {
  id: string;
  estado: string;
  motivoPausa: string | null;
  total: number;
  enviados: number;
  pendientes: number;
  omitidos: number;
  errores: number;
  creadoEn: Date;
  terminadoEn: Date | null;
  estimadoRestanteMs: number;
}

async function resumir(envio: {
  id: string;
  estado: string;
  motivoPausa: string | null;
  total: number;
  creadoEn: Date;
  terminadoEn: Date | null;
}): Promise<EnvioResumen> {
  const [grupos, config] = await Promise.all([
    prisma.envioCarnetItem.groupBy({ by: ["estado"], where: { envioId: envio.id }, _count: { _all: true } }),
    getConfig(),
  ]);
  const cuenta = (estado: string) => grupos.find((g) => g.estado === estado)?._count._all ?? 0;
  // Un item enviando todavía falta por terminar: cuenta como pendiente.
  const pendientes = cuenta("pendiente") + cuenta("enviando");
  return {
    ...envio,
    enviados: cuenta("enviado"),
    pendientes,
    omitidos: cuenta("omitido"),
    errores: cuenta("error"),
    estimadoRestanteMs: estimadoRestanteMs(pendientes, config.carnetsPorHora),
  };
}

/** El envío en curso o pausado, si lo hay. */
export async function envioActivo(): Promise<EnvioResumen | null> {
  const envio = await prisma.envioCarnets.findFirst({
    where: { estado: { in: ACTIVOS } },
    orderBy: { creadoEn: "desc" },
  });
  return envio ? resumir(envio) : null;
}

export async function getEnvio(
  id: string
): Promise<(EnvioResumen & { erroresDetalle: { userId: string; nombre: string; email: string | null; motivo: string }[] }) | null> {
  const envio = await prisma.envioCarnets.findUnique({ where: { id } });
  if (!envio) return null;
  const [resumen, errores] = await Promise.all([
    resumir(envio),
    prisma.envioCarnetItem.findMany({
      where: { envioId: id, estado: "error" },
      include: { user: { select: { nombre: true, email: true } } },
      orderBy: { user: { nombre: "asc" } },
    }),
  ]);
  return {
    ...resumen,
    erroresDetalle: errores.map((item) => ({
      userId: item.userId,
      nombre: item.user.nombre,
      email: item.user.email,
      motivo: item.motivoError ?? "",
    })),
  };
}

export type ResultadoPaso = "enviado" | "omitido" | "error" | "pausado" | "esperando" | "terminado" | "sin-envio";

/**
 * Un paso del envío masivo: reclama un item y lo envía, si el ritmo lo permite.
 * Seguro ante pasos simultáneos: el item se reclama con un UPDATE condicional.
 */
export async function procesarSiguiente(
  deps: { now?: Date; enviar?: (userId: string) => Promise<SendCarnetResult> } = {}
): Promise<ResultadoPaso> {
  const now = deps.now ?? new Date();
  // Un item que quedó enviando (reinicio, fallo al guardar) no debe bloquear el lote.
  await recuperarAlArrancar(now);
  const enviar = deps.enviar ?? ((userId: string) => sendCarnet(userId));

  const envio = await prisma.envioCarnets.findFirst({ where: { estado: "en-curso" }, orderBy: { creadoEn: "asc" } });
  if (!envio) return "sin-envio";

  const { carnetsPorHora } = await getConfig();
  const desde = new Date(now.getTime() - VENTANA_MS);
  const [ultimo, ventana] = await Promise.all([
    prisma.envioCarnetItem.aggregate({
      where: { envioId: envio.id, estado: "enviado" },
      _max: { intentadoEn: true },
    }),
    prisma.carnetVirtual.aggregate({
      where: { enviadoEn: { gt: desde } },
      _count: { _all: true },
      _min: { enviadoEn: true },
    }),
  ]);
  const espera = esperarHasta({
    now,
    ultimoEnvioLote: ultimo._max.intentadoEn,
    enviadosUltimaHora: ventana._count._all,
    masAntiguoUltimaHora: ventana._min.enviadoEn,
    porHora: carnetsPorHora,
  });
  if (espera) return "esperando";

  // Reclamo: solo un paso puede pasar el item de pendiente a enviando.
  let item: { id: string; userId: string } | null = null;
  const descartados: string[] = [];
  for (;;) {
    const candidato = await prisma.envioCarnetItem.findFirst({
      where: { envioId: envio.id, estado: "pendiente", id: { notIn: descartados } },
      orderBy: { id: "asc" },
      select: { id: true, userId: true },
    });
    if (!candidato) break;
    const { count } = await prisma.envioCarnetItem.updateMany({
      where: { id: candidato.id, estado: "pendiente" },
      data: { estado: "enviando", intentadoEn: now },
    });
    if (count === 1) {
      item = candidato;
      break;
    }
    descartados.push(candidato.id);
  }

  if (!item) {
    // Si otro paso aún tiene uno enviando, podría volver a pendiente: no cerrar todavía.
    const enVuelo = await prisma.envioCarnetItem.count({ where: { envioId: envio.id, estado: "enviando" } });
    if (enVuelo > 0) return "esperando";
    await prisma.envioCarnets.updateMany({
      where: { id: envio.id, estado: { in: ACTIVOS } },
      data: { estado: "terminado", terminadoEn: now },
    });
    return "terminado";
  }

  const cerrar = (estado: string, motivoError?: string) =>
    prisma.envioCarnetItem.update({ where: { id: item.id }, data: { estado, motivoError: motivoError ?? null } });

  // Pudo recibir su carnet de forma individual desde que se tomó la instantánea.
  const sigueIgual = await prisma.user.count({ where: { id: item.userId, ...PENDIENTE_WHERE } });
  if (sigueIgual === 0) {
    await cerrar("omitido");
    return "omitido";
  }

  try {
    const resultado = await enviar(item.userId);
    if (resultado.ok) {
      await cerrar("enviado");
      return "enviado";
    }
    await cerrar("omitido");
    return "omitido";
  } catch (error) {
    console.error("[carnets] Falló un envío del lote", error);
    if (clasificarMailError(error) === "global") {
      await cerrar("pendiente");
      await prisma.envioCarnets.updateMany({
        where: { id: envio.id, estado: "en-curso" },
        data: { estado: "pausado", motivoPausa: describeMailError(error) },
      });
      return "pausado";
    }
    await cerrar("error", describeMailError(error));
    return "error";
  }
}

/** Items que quedaron enviando cuando el servidor se detuvo: no se sabe si el correo salió. */
export async function recuperarAlArrancar(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.envioCarnetItem.updateMany({
    where: { estado: "enviando", intentadoEn: { lt: new Date(now.getTime() - ENVIANDO_VENCIDO_MS) } },
    data: { estado: "error", motivoError: MOTIVO_REINICIO },
  });
  return count;
}

/** El envío más reciente (en curso, pausado o terminado), para mostrar su resultado. */
export async function ultimoEnvioId(): Promise<string | null> {
  const envio = await prisma.envioCarnets.findFirst({ orderBy: { creadoEn: "desc" }, select: { id: true } });
  return envio?.id ?? null;
}
