/**
 * Formato del QR del carnet virtual. Módulo puro: lo usan el servidor (al
 * generarlo y validarlo) y el kiosko (para ignorar QR ajenos sin llamar a la API).
 */

const PREFIX = "CARNET:";
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function carnetQrContent(token: string): string {
  return `${PREFIX}${token}`;
}

/** Token del carnet si el texto leído es un QR nuestro; `null` si no. */
export function parseCarnetQr(content: string): string | null {
  const text = content.trim();
  if (!text.startsWith(PREFIX)) return null;
  const token = text.slice(PREFIX.length);
  return TOKEN_RE.test(token) ? token : null;
}
