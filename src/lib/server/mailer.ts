import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";
import { type Seguridad, type SmtpValues, isSeguridad } from "@/lib/smtpRules";
import { prisma } from "./prisma";
import { decryptSecret, encryptSecret } from "./secretBox";

const SMTP_ID = 1;
const SECRET_PURPOSE = "smtp-password";

/** Lo que ve el formulario: nunca incluye la contraseña, solo si existe. */
export interface SmtpSettings extends SmtpValues {
  hasPassword: boolean;
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const row = await prisma.configuracionSmtp.findUnique({ where: { id: SMTP_ID } });
  if (!row) return null;
  return {
    host: row.host,
    puerto: row.puerto,
    seguridad: isSeguridad(row.seguridad) ? row.seguridad : "starttls",
    usuario: row.usuario,
    remitenteNombre: row.remitenteNombre,
    remitenteEmail: row.remitenteEmail,
    hasPassword: Boolean(row.passwordCifrada),
  };
}

/**
 * @param password `null` conserva la guardada. Sin usuario no se guarda
 *   contraseña: un relay interno no la necesita.
 */
export async function saveSmtpSettings(
  values: SmtpValues,
  password: string | null,
  actualizadoPor: string
): Promise<void> {
  const passwordCifrada = !values.usuario
    ? { passwordCifrada: null }
    : password !== null
      ? { passwordCifrada: encryptSecret(password, SECRET_PURPOSE) }
      : {};

  await prisma.configuracionSmtp.upsert({
    where: { id: SMTP_ID },
    create: { id: SMTP_ID, ...values, ...passwordCifrada, actualizadoPor },
    update: { ...values, ...passwordCifrada, actualizadoPor },
  });
}

export class SmtpNotConfiguredError extends Error {
  constructor() {
    super("El correo de salida no está configurado");
  }
}

interface TransportInput extends SmtpValues {
  password: string | null;
}

function transportOptions(seguridad: Seguridad) {
  switch (seguridad) {
    case "tls":
      return { secure: true };
    case "starttls":
      // Exige el cifrado: sin esto nodemailer seguiría en texto plano si el
      // servidor no ofrece STARTTLS.
      return { secure: false, requireTLS: true };
    case "ninguna":
      return { secure: false, ignoreTLS: true };
  }
}

function createTransport(input: TransportInput) {
  return nodemailer.createTransport({
    host: input.host,
    port: input.puerto,
    ...transportOptions(input.seguridad),
    auth: input.usuario ? { user: input.usuario, pass: input.password ?? "" } : undefined,
    // Que un servidor caído no deje colgada la acción del administrador.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Configuración guardada lista para enviar; lanza si falta o no se puede descifrar. */
async function savedTransportInput(): Promise<TransportInput> {
  const row = await prisma.configuracionSmtp.findUnique({ where: { id: SMTP_ID } });
  if (!row) throw new SmtpNotConfiguredError();

  const password = row.passwordCifrada ? decryptSecret(row.passwordCifrada, SECRET_PURPOSE) : null;
  // Cifrada con otro AUTH_SECRET: hay que volver a escribirla.
  if (row.usuario && password === null) throw new SmtpNotConfiguredError();

  return {
    host: row.host,
    puerto: row.puerto,
    seguridad: isSeguridad(row.seguridad) ? row.seguridad : "starttls",
    usuario: row.usuario,
    remitenteNombre: row.remitenteNombre,
    remitenteEmail: row.remitenteEmail,
    password,
  };
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}

async function send(input: TransportInput, message: MailMessage) {
  const transport = createTransport(input);
  try {
    await transport.sendMail({
      from: { name: input.remitenteNombre, address: input.remitenteEmail },
      ...message,
    });
  } finally {
    transport.close();
  }
}

/** Envía con la configuración guardada en Configuración. */
export async function sendMail(message: MailMessage): Promise<void> {
  await send(await savedTransportInput(), message);
}

/** Correo de prueba con la configuración guardada, para confirmar que funciona. */
export async function sendTestMail(to: string): Promise<void> {
  await sendMail({
    to,
    subject: "Prueba del correo de salida",
    text: "Si recibes este mensaje, el correo de salida del control de tiempos quedó bien configurado.",
    html: "<p>Si recibes este mensaje, el correo de salida del control de tiempos quedó bien configurado.</p>",
  });
}

const CODIGOS_GLOBALES = new Set(["EAUTH", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ETLS"]);

/**
 * Un error global (servidor, credenciales, red) afectará a todos los envíos
 * siguientes: el envío masivo se pausa. Cualquier otro es del destinatario y
 * solo marca ese item.
 */
export function clasificarMailError(error: unknown): "global" | "destinatario" {
  if (error instanceof SmtpNotConfiguredError) return "global";
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && CODIGOS_GLOBALES.has(code) ? "global" : "destinatario";
}

/**
 * Traduce los errores de nodemailer a algo que la coordinadora pueda pasar a
 * sistemas. El error crudo va al log del servidor, nunca a la pantalla.
 */
export function describeMailError(error: unknown): string {
  if (error instanceof SmtpNotConfiguredError) {
    return "Falta configurar el correo de salida en Configuración (o volver a escribir su contraseña).";
  }
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  switch (code) {
    case "EAUTH":
      return "El servidor de correo rechazó el usuario o la contraseña.";
    case "ECONNECTION":
    case "ETIMEDOUT":
    case "ESOCKET":
    case "EDNS":
      return "No se pudo conectar con el servidor de correo. Revisa el servidor, el puerto y la seguridad.";
    case "EENVELOPE":
      return "El servidor de correo rechazó la dirección de destino o del remitente.";
    case "ETLS":
      return "No se pudo establecer la conexión segura. Prueba con otra opción de seguridad.";
    default:
      return "No se pudo enviar el correo. Revisa la configuración del correo de salida.";
  }
}
