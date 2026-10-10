import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { carnetQrContent } from "@/lib/carnetQr";
import { sendMail } from "./mailer";
import { prisma } from "./prisma";

// Los correos no ven las variables de globals.css: estilos inline con los
// valores de la paleta de AGENTS.md.
const COLOR = {
  navy: "#131e3d",
  red: "#cf1f2e",
  bone: "#f6f4ef",
  white: "#ffffff",
  muted: "#5a6176", // rgba(19,30,61,.7) sobre blanco, opaco para clientes de correo
  border: "#dcdee4",
} as const;

const LOGO_PATH = path.join(process.cwd(), "public", "logo-banco-alimentos.png");

/** 18 bytes aleatorios → 24 caracteres base64url: imposible de adivinar y QR pequeño. */
function newToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Token vigente del usuario; lo crea la primera vez. */
export async function ensureCarnetToken(userId: string): Promise<string> {
  const existing = await prisma.carnetVirtual.findUnique({ where: { userId }, select: { token: true } });
  if (existing) return existing.token;
  const created = await prisma.carnetVirtual.create({ data: { userId, token: newToken() }, select: { token: true } });
  return created.token;
}

/** Usuario activo dueño del token, o `null` si el carnet no existe o fue reemplazado. */
export async function findUserByCarnetToken(token: string) {
  const carnet = await prisma.carnetVirtual.findUnique({ where: { token }, include: { user: true } });
  return carnet?.user.activo ? carnet.user : null;
}

/** QR negro sobre blanco con zona silenciosa: es lo que mejor lee una webcam desde un celular. */
export function carnetQrPng(token: string): Promise<Buffer> {
  return QRCode.toBuffer(carnetQrContent(token), {
    errorCorrectionLevel: "M",
    margin: 3,
    width: 480,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface CarnetData {
  nombre: string;
  cedula: string;
  universidad: string;
  entidad: string;
}

/**
 * Tarjeta del carnet en HTML de correo (tablas + estilos inline).
 * `qrSrc` y `logoSrc` son `cid:` en el correo y `data:` en la vista previa.
 */
export function renderCarnetHtml(data: CarnetData, images: { qrSrc: string; logoSrc: string }): string {
  const nombre = escapeHtml(data.nombre);
  const cedula = escapeHtml(data.cedula);
  const detalle = `${escapeHtml(data.universidad)} · ${escapeHtml(data.entidad)}`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Carnet virtual</title>
</head>
<body style="margin:0;padding:24px 12px;background:${COLOR.bone};font-family:Archivo,Arial,Helvetica,sans-serif;color:${COLOR.navy};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;">
    <tr><td style="padding:0 4px 16px;font-size:15px;line-height:1.5;">
      Hola, ${nombre}. Este es tu <strong>carnet virtual</strong> de prácticas. Si el kiosko no
      reconoce tu rostro, muestra este código a la cámara cuando te lo pida.
    </td></tr>
    <tr><td style="background:${COLOR.white};border:1px solid ${COLOR.border};border-radius:12px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:${COLOR.navy};padding:16px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:12px;"><img src="${images.logoSrc}" width="40" height="40" alt="" style="display:block;border-radius:8px;"></td>
            <td style="color:${COLOR.white};font-size:11px;font-weight:700;letter-spacing:.2em;line-height:1.4;">BANCO DE<br>ALIMENTOS</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:20px 20px 6px;">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:.14em;color:${COLOR.red};">CARNET DE PRACTICANTE</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.15;">${nombre}</p>
          <p style="margin:6px 0 0;font-size:14px;color:${COLOR.muted};">${detalle}</p>
          <p style="margin:6px 0 0;font-size:14px;color:${COLOR.muted};font-variant-numeric:tabular-nums;">C.C. ${cedula}</p>
        </td></tr>
        <tr><td align="center" style="padding:14px 20px 8px;">
          <img src="${images.qrSrc}" width="260" height="260" alt="Código QR del carnet" style="display:block;width:260px;height:260px;">
        </td></tr>
        <tr><td style="padding:4px 20px 20px;font-size:13px;line-height:1.5;color:${COLOR.muted};text-align:center;">
          Sube el brillo de la pantalla y acerca el código a la cámara del kiosko.
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 4px 0;font-size:12.5px;line-height:1.5;color:${COLOR.muted};">
      Este código es personal: no lo compartas. Si lo pierdes o crees que alguien más lo tiene,
      pide a coordinación que te envíe uno nuevo; el anterior dejará de funcionar.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function renderCarnetText(data: CarnetData): string {
  return [
    `Hola, ${data.nombre}.`,
    "",
    "Adjunto encuentras tu carnet virtual de prácticas (imagen con un código QR).",
    "Si el kiosko no reconoce tu rostro, muestra ese código a la cámara cuando te lo pida.",
    "",
    "Este código es personal: no lo compartas. Si lo pierdes, pide a coordinación uno nuevo.",
  ].join("\n");
}

async function carnetData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return { user, token: await ensureCarnetToken(userId) };
}

/** Vista previa para el administrador, con las imágenes incrustadas. */
export async function renderCarnetPreview(userId: string): Promise<string | null> {
  const found = await carnetData(userId);
  if (!found) return null;
  const [qr, logo] = await Promise.all([carnetQrPng(found.token), readFile(LOGO_PATH)]);
  return renderCarnetHtml(found.user, {
    qrSrc: `data:image/png;base64,${qr.toString("base64")}`,
    logoSrc: `data:image/png;base64,${logo.toString("base64")}`,
  });
}

export type SendCarnetResult =
  | { ok: true; to: string; enviadoEn: Date }
  | { ok: false; reason: "no-encontrado" | "sin-correo" | "inactivo" };

/**
 * Envía el carnet al correo del practicante. Reutiliza el token vigente;
 * con `renovar` crea uno nuevo y el QR anterior deja de servir.
 * Los errores de SMTP se propagan (ver `describeMailError`).
 */
export async function sendCarnet(userId: string, { renovar = false } = {}): Promise<SendCarnetResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, reason: "no-encontrado" };
  if (!user.activo) return { ok: false, reason: "inactivo" };
  if (!user.email) return { ok: false, reason: "sin-correo" };

  const token = renovar
    ? (
        await prisma.carnetVirtual.upsert({
          where: { userId },
          create: { userId, token: newToken() },
          update: { token: newToken(), creadoEn: new Date() },
          select: { token: true },
        })
      ).token
    : await ensureCarnetToken(userId);

  const [qr, logo] = await Promise.all([carnetQrPng(token), readFile(LOGO_PATH)]);

  await sendMail({
    to: user.email,
    subject: "Tu carnet virtual de prácticas",
    html: renderCarnetHtml(user, { qrSrc: "cid:carnet-qr", logoSrc: "cid:logo" }),
    text: renderCarnetText(user),
    attachments: [
      // Inline para la tarjeta del correo…
      { filename: "logo.png", content: logo, cid: "logo", contentDisposition: "inline" },
      { filename: "carnet-qr.png", content: qr, cid: "carnet-qr", contentDisposition: "inline" },
      // …y como archivo para guardarlo en el celular y mostrarlo sin conexión.
      { filename: `carnet-virtual-${user.cedula}.png`, content: qr },
    ],
  });

  const enviadoEn = new Date();
  await prisma.carnetVirtual.update({ where: { userId }, data: { enviadoEn, enviadoA: user.email } });
  return { ok: true, to: user.email, enviadoEn };
}
