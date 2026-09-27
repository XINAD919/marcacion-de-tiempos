"use server";

import { revalidatePath } from "next/cache";
import { type ConfigField, parseConfigForm } from "@/lib/configRules";
import { auth } from "@/lib/server/auth";
import { saveConfig } from "@/lib/server/config";

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
