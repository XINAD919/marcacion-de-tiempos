"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { createUsuario, updateUsuario } from "@/lib/server/usuarioService";
import { type UsuarioErrors, type UsuarioField, validateUsuarioInput } from "@/lib/usuarios/userInput";

export type UsuarioFormState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: UsuarioErrors;
      /** Persona que ya tiene la cédula, para enlazar "Ver usuario". */
      duplicate?: { id: string; nombre: string };
      /** Lo escrito: React 19 reinicia el formulario tras la acción. */
      values: Record<string, string>;
    }
  | { status: "error"; message: string; values: Record<string, string> };

const FIELDS: (UsuarioField | "activo")[] = [
  "nombre",
  "cedula",
  "email",
  "universidad",
  "entidad",
  "horasRequeridas",
  "fechaInicio",
  "horaInicio",
  "horaFin",
  "activo",
];

export async function guardarUsuario(
  _previous: UsuarioFormState,
  formData: FormData
): Promise<UsuarioFormState> {
  const values = Object.fromEntries(FIELDS.map((field) => [field, String(formData.get(field) ?? "")]));

  // Las server actions son endpoints públicos: se verifica la sesión aquí.
  const session = await auth();
  if (!session?.user) {
    return { status: "error", message: "Tu sesión terminó. Vuelve a iniciar sesión para guardar.", values };
  }

  const validation = validateUsuarioInput(values);
  if (!validation.ok) return { status: "invalid", errors: validation.errors, values };

  const userId = String(formData.get("userId") ?? "");
  const result = userId
    ? await updateUsuario(userId, validation.value)
    : await createUsuario(validation.value);

  if (!result.ok) {
    return {
      status: "invalid",
      errors: { cedula: `Esta cédula ya está registrada a nombre de ${result.duplicate.nombre}.` },
      duplicate: result.duplicate,
      values,
    };
  }

  revalidatePath("/admin/usuarios");
  redirect(formData.get("intent") === "enrolar" ? `/admin/enrolar/${result.id}` : "/admin/usuarios");
}
