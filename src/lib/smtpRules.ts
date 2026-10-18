/**
 * Correo de salida (SMTP) de Configuración. Módulo puro (sin Prisma ni
 * nodemailer) para validar igual en el formulario y en el servidor.
 */

export const SEGURIDADES = ["starttls", "tls", "ninguna"] as const;
export type Seguridad = (typeof SEGURIDADES)[number];

export const SEGURIDAD_LABEL: Record<Seguridad, string> = {
  starttls: "STARTTLS",
  tls: "SSL/TLS",
  ninguna: "Ninguna",
};

/** Puerto habitual de cada modo, para sugerirlo al cambiar la seguridad. */
export const PUERTO_SUGERIDO: Record<Seguridad, number> = {
  starttls: 587,
  tls: 465,
  ninguna: 25,
};

export function isSeguridad(value: unknown): value is Seguridad {
  return typeof value === "string" && (SEGURIDADES as readonly string[]).includes(value);
}

export interface SmtpValues {
  host: string;
  puerto: number;
  seguridad: Seguridad;
  usuario: string | null;
  remitenteNombre: string;
  remitenteEmail: string;
}

export type SmtpField =
  | "host"
  | "puerto"
  | "seguridad"
  | "usuario"
  | "password"
  | "remitenteNombre"
  | "remitenteEmail";

export type SmtpParseResult =
  | {
      ok: true;
      value: SmtpValues;
      /** `null` = dejar la contraseña guardada como está. */
      password: string | null;
    }
  | { ok: false; errors: Partial<Record<SmtpField, string>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Nombre de equipo o IP; sin protocolo ni puerto (van en sus propios campos).
const HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * @param hasSavedPassword Si ya hay una contraseña guardada, el campo vacío
 *   significa "no cambiarla"; si no la hay y se escribe usuario, es obligatoria.
 */
export function parseSmtpForm(
  input: Partial<Record<SmtpField, unknown>>,
  hasSavedPassword: boolean
): SmtpParseResult {
  const errors: Partial<Record<SmtpField, string>> = {};

  const host = text(input.host);
  if (!host) errors.host = "Escribe el servidor de correo, por ejemplo smtp.office365.com.";
  else if (!HOST_RE.test(host)) {
    errors.host = "Escribe solo el nombre del servidor, sin «https://» ni el puerto.";
  }

  const puertoRaw = text(input.puerto);
  const puerto = Number(puertoRaw);
  if (!/^\d+$/.test(puertoRaw) || puerto < 1 || puerto > 65535) {
    errors.puerto = "Escribe un puerto entre 1 y 65535 (suele ser 587, 465 o 25).";
  }

  const seguridad = input.seguridad;
  if (!isSeguridad(seguridad)) errors.seguridad = "Elige STARTTLS, SSL/TLS o Ninguna.";

  const usuario = text(input.usuario) || null;
  // La contraseña no se recorta: un espacio puede ser parte de ella.
  const passwordRaw = typeof input.password === "string" ? input.password : "";
  const password = passwordRaw === "" ? null : passwordRaw;
  if (usuario && password === null && !hasSavedPassword) {
    errors.password = "Escribe la contraseña de la cuenta de correo.";
  }

  const remitenteNombre = text(input.remitenteNombre);
  if (!remitenteNombre) errors.remitenteNombre = "Escribe el nombre que verán quienes reciban el correo.";

  const remitenteEmail = text(input.remitenteEmail);
  if (!EMAIL_RE.test(remitenteEmail)) {
    errors.remitenteEmail = "Escribe un correo válido, por ejemplo practicas@fundacion.org.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      host,
      puerto,
      seguridad: seguridad as Seguridad,
      usuario,
      remitenteNombre,
      remitenteEmail,
    },
    password,
  };
}
