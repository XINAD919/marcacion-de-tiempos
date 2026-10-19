"use server";

import { revalidatePath } from "next/cache";
import { horaEnDia, MENSAJE, parseMotivo } from "@/lib/marcaciones/correcciones";
import { auth } from "@/lib/server/auth";
import { anular, type CorreccionResult, corregirHora, reasignar, registrarEntrada, registrarSalida, restaurar } from "@/lib/server/correccionService";
import { prisma } from "@/lib/server/prisma";
import { listUsuarios } from "@/lib/server/usuarioService";

export type CorreccionActionResult =
  | { ok: true }
  | { ok: false; errors?: Partial<Record<"hora" | "motivo" | "destino", string>>; message?: string };

const SESION_TERMINADA = "Tu sesión terminó. Vuelve a iniciar sesión.";
const ERROR_INESPERADO = "No pudimos guardar la corrección. Inténtalo de nuevo.";

function texto(fd: FormData, nombre: string): string {
  const value = fd.get(nombre);
  return typeof value === "string" ? value : "";
}

function aResultado(result: CorreccionResult): CorreccionActionResult {
  if (result.ok) {
    revalidatePath("/admin", "layout");
    return { ok: true };
  }
  return result.field ? { ok: false, errors: { [result.field]: result.message } } : { ok: false, message: result.message };
}

interface Contexto {
  adminId: string;
  marcaId: string;
  motivo: string;
  fd: FormData;
}

/**
 * Las server actions son endpoints públicos: se verifica la sesión en cada una.
 * Cualquier error inesperado se registra y se traduce a un mensaje en español llano.
 */
async function ejecutar(
  fd: FormData,
  fn: (ctx: Contexto) => Promise<CorreccionActionResult>,
): Promise<CorreccionActionResult> {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId) return { ok: false, message: SESION_TERMINADA };
  const marcaId = texto(fd, "marcaId");
  try {
    return await fn({ adminId, marcaId, motivo: texto(fd, "motivo"), fd });
  } catch (error) {
    console.error("Corrección de marcación fallida", { marcaId, adminId }, error);
    return { ok: false, message: ERROR_INESPERADO };
  }
}

/**
 * Acciones que piden una hora: valida hora y motivo antes de tocar la BD y arma la fecha
 * con el día de la marca (leído en el servidor, nunca del cliente).
 */
function conHora(
  fd: FormData,
  llamar: (ctx: Contexto & { hora: Date }) => Promise<CorreccionResult>,
): Promise<CorreccionActionResult> {
  return ejecutar(fd, async (ctx) => {
      const horaTexto = texto(fd, "hora");
      const errors: Partial<Record<"hora" | "motivo", string>> = {};
      if (!horaEnDia(new Date(), horaTexto)) errors.hora = MENSAJE.horaInvalida;
      const motivo = parseMotivo(ctx.motivo);
      if (!motivo.ok) errors.motivo = motivo.error;
      if (errors.hora || errors.motivo) return { ok: false, errors };

      const marca = await prisma.attendanceLog.findUnique({ where: { id: ctx.marcaId }, select: { marcadoEn: true } });
      if (!marca) return { ok: false, message: MENSAJE.noExiste };
      const hora = horaEnDia(marca.marcadoEn, horaTexto);
      if (!hora) return { ok: false, errors: { hora: MENSAJE.horaInvalida } };
      return aResultado(await llamar({ ...ctx, hora }));
  });
}

export async function registrarSalidaAction(fd: FormData): Promise<CorreccionActionResult> {
  return conHora(fd, ({ adminId, marcaId, motivo, hora }) =>
    registrarSalida({ adminId, entradaId: marcaId, motivo, hora }),
  );
}

export async function registrarEntradaAction(fd: FormData): Promise<CorreccionActionResult> {
  return conHora(fd, ({ adminId, marcaId, motivo, hora }) =>
    registrarEntrada({ adminId, salidaId: marcaId, motivo, hora }),
  );
}

export async function corregirHoraAction(fd: FormData): Promise<CorreccionActionResult> {
  return conHora(fd, ({ adminId, marcaId, motivo, hora }) => corregirHora({ adminId, marcaId, motivo, hora }));
}

export async function anularAction(fd: FormData): Promise<CorreccionActionResult> {
  return ejecutar(fd, async ({ adminId, marcaId, motivo }) =>
    aResultado(await anular({ adminId, marcaId, motivo, incluirPareja: texto(fd, "incluirPareja") === "true" })),
  );
}

export async function restaurarAction(fd: FormData): Promise<CorreccionActionResult> {
  return ejecutar(fd, async ({ adminId, marcaId, motivo }) =>
    aResultado(await restaurar({ adminId, marcaId, motivo })),
  );
}

export async function reasignarAction(fd: FormData): Promise<CorreccionActionResult> {
  return ejecutar(fd, async ({ adminId, marcaId, motivo }) => {
    const destinoUserId = texto(fd, "destinoUserId");
    if (!destinoUserId) {
      return { ok: false, errors: { destino: "Elige al practicante que hizo esta marcación." } };
    }
    return aResultado(await reasignar({ adminId, marcaId, motivo, destinoUserId }));
  });
}

/** Practicantes activos que coinciden con el texto (nombre o cédula), máximo 8. */
export async function buscarPracticantesAction(q: string): Promise<{ id: string; nombre: string; cedula: string }[]> {
  const session = await auth();
  if (!session?.user) return [];
  const texto = typeof q === "string" ? q.trim() : "";
  if (texto.length < 2) return [];
  try {
    const { rows } = await listUsuarios({ q: texto, estado: "activo" });
    return rows.slice(0, 8).map(({ id, nombre, cedula }) => ({ id, nombre, cedula }));
  } catch (error) {
    console.error("Búsqueda de practicantes fallida", error);
    return [];
  }
}
