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

async function remitenteDePrueba(): Promise<TransportInput> {
  try {
    return await savedTransportInput();
  } catch {
    return {
      host: "localhost",
      puerto: 25,
      seguridad: "ninguna",
      usuario: "",
      remitenteNombre: "Pruebas",
      remitenteEmail: "pruebas@example.com",
      password: null,
    };
  }
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}

/**
 * Solo para pruebas: `MAIL_TRANSPORT=json` arma el correo pero no lo envía.
 * Nunca en producción, aunque la variable quede puesta.
 */
function usaTransporteJson(): boolean {
  return process.env.MAIL_TRANSPORT === "json" && process.env.NODE_ENV !== "production";
}

async function send(input: TransportInput, message: MailMessage) {
  const transport = usaTransporteJson() ? nodemailer.createTransport({ jsonTransport: true }) : createTransport(input);
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
  // Con el transporte de prueba basta el remitente guardado, o uno de reserva.
  const input = usaTransporteJson() ? await remitenteDePrueba() : await savedTransportInput();
  await send(input, message);
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
  const e = typeof error === "object" && error !== null ? (error as { code?: unknown; responseCode?: unknown; name?: unknown }) : {};
  if (typeof e.code === "string" && CODIGOS_GLOBALES.has(e.code)) return "global";
  // Errores de Prisma (base de datos caída, etc.): afectan a todos los envíos.
  if (typeof e.name === "string" && e.name.startsWith("PrismaClient")) return "global";
  if (typeof e.code === "string" && /^P\d{4}$/.test(e.code)) return "global";
  // Solo un error con forma de respuesta SMTP (code o responseCode) es del
  // destinatario; si no se reconoce, mejor pausar que marcar error uno por uno.
  const esDeCorreo = typeof e.code === "string" || typeof e.responseCode === "number";
  return esDeCorreo ? "destinatario" : "global";
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
