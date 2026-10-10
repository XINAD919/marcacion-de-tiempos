"use server";

import { revalidatePath } from "next/cache";
import { type ConfigField, parseConfigForm } from "@/lib/configRules";
import { auth } from "@/lib/server/auth";
import { saveConfig } from "@/lib/server/config";
import { describeMailError, getSmtpSettings, saveSmtpSettings, sendTestMail } from "@/lib/server/mailer";
import { type SmtpField, parseSmtpForm } from "@/lib/smtpRules";

export type ConfigFormState =
  | { status: "idle" }
  | { status: "saved"; savedAt: number }
  // `values` devuelve lo escrito: React 19 reinicia el formulario tras la
  // acción y, sin esto, el campo con error volvería al valor anterior.
  | {
      status: "invalid";
      errors: Partial<Record<ConfigField, string>>;
      values: Partial<Record<ConfigField, string>>;
    }
  | { status: "error"; message: string };

const FIELDS: ConfigField[] = [
  "toleranciaLlegadaMin",
  "minHorasAntesSalida",
  "exigenciaReconocimiento",
  "intentosAntesQr",
  "jornadaMaximaHoras",
];

export async function guardarConfiguracion(
  _previous: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  // Las server actions son endpoints públicos: se verifica la sesión aquí,
  // no solo en el layout.
  const session = await auth();
  if (!session?.user) {
    return { status: "error", message: "Tu sesión terminó. Vuelve a iniciar sesión para guardar." };
  }

  const values = Object.fromEntries(
    FIELDS.map((field) => [field, String(formData.get(field) ?? "")])
  ) as Record<ConfigField, string>;
  const parsed = parseConfigForm(values);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values };

  await saveConfig(parsed.value, session.user.name ?? session.user.email ?? "administrador");
  revalidatePath("/admin/configuracion");
  return { status: "saved", savedAt: Date.now() };
}

export type SmtpFormState =
  | { status: "idle" }
  | { status: "saved"; savedAt: number }
  | {
      status: "invalid";
      errors: Partial<Record<SmtpField, string>>;
      values: Partial<Record<SmtpField, string>>;
    }
  | { status: "error"; message: string; values: Partial<Record<SmtpField, string>> };

// La contraseña no se devuelve en `values`: no debe viajar de vuelta al navegador.
const SMTP_FIELDS: Exclude<SmtpField, "password">[] = [
  "host",
  "puerto",
  "seguridad",
  "usuario",
  "remitenteNombre",
  "remitenteEmail",
];

/** Guarda el correo de salida. */
export async function guardarSmtp(_previous: SmtpFormState, formData: FormData): Promise<SmtpFormState> {
  const values = Object.fromEntries(
    SMTP_FIELDS.map((field) => [field, String(formData.get(field) ?? "")])
  ) as Record<Exclude<SmtpField, "password">, string>;

  const session = await auth();
  if (!session?.user) {
    return { status: "error", message: "Tu sesión terminó. Vuelve a iniciar sesión para guardar.", values };
  }

  const saved = await getSmtpSettings();
  const parsed = parseSmtpForm({ ...values, password: formData.get("password") }, Boolean(saved?.hasPassword));
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values };

  await saveSmtpSettings(parsed.value, parsed.password, session.user.name ?? session.user.email ?? "administrador");
  revalidatePath("/admin/configuracion");
  return { status: "saved", savedAt: Date.now() };
}

export type PruebaCorreoState =
  | { status: "idle" }
  | { status: "sent"; to: string }
  | { status: "error"; message: string; to: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Envía un correo de prueba con la configuración ya guardada. */
export async function enviarCorreoPrueba(
  _previous: PruebaCorreoState,
  formData: FormData
): Promise<PruebaCorreoState> {
  const to = String(formData.get("to") ?? "").trim();

  const session = await auth();
  if (!session?.user) return { status: "error", message: "Tu sesión terminó. Vuelve a iniciar sesión.", to };
  if (!EMAIL_RE.test(to)) {
    return { status: "error", message: "Escribe un correo válido para recibir la prueba.", to };
  }

  try {
    await sendTestMail(to);
  } catch (error) {
    console.error("[smtp] Falló el correo de prueba", error);
    return { status: "error", message: describeMailError(error), to };
  }
  return { status: "sent", to };
}
