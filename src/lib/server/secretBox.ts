import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico para secretos guardados en la base (hoy, la contraseña
 * SMTP). AES-256-GCM con una clave derivada de AUTH_SECRET: quien lea la
 * tabla no ve la contraseña. Si AUTH_SECRET cambia, hay que volver a
 * escribirla en Configuración.
 */

const VERSION = "v1";

function keyFor(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está definido");
  return Buffer.from(hkdfSync("sha256", secret, "medicion-tiempos", purpose, 32));
}

export function encryptSecret(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/** Devuelve `null` si el texto está dañado o se cifró con otro AUTH_SECRET. */
export function decryptSecret(sealed: string, purpose: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFor(purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
