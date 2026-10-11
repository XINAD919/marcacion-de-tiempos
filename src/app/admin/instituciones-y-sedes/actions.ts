"use server";

import { revalidatePath } from "next/cache";
import { validateInstitucionInput } from "@/lib/catalogo/institucion";
import { validateSedeInput } from "@/lib/catalogo/sede";
import { auth } from "@/lib/server/auth";
import { guardarInstitucion, guardarSede } from "@/lib/server/catalogoService";

export type CatalogoActionResult =
  | { ok: true }
  | { ok: false; errors?: Partial<Record<string, string>>; message?: string };

const SESION_TERMINADA = "Tu sesión terminó. Vuelve a iniciar sesión para guardar.";

function parseId(formData: FormData): number | null {
  const id = Number(formData.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function revalidar() {
  revalidatePath("/admin/instituciones-y-sedes");
  revalidatePath("/admin/usuarios");
}

// Las server actions son endpoints públicos: se verifica la sesión en cada una.
export async function guardarInstitucionAction(formData: FormData): Promise<CatalogoActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: SESION_TERMINADA };

  const parsed = validateInstitucionInput({
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo"),
    horasExigidas: formData.get("horasExigidas"),
    activa: formData.get("activa") ?? "true",
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const result = await guardarInstitucion(parseId(formData), parsed.value);
  if (!result.ok) {
    return result.reason === "duplicado"
      ? { ok: false, errors: { nombre: "Ya existe una institución con ese nombre" } }
      : { ok: false, message: "Esa institución ya no existe. Recarga la página." };
  }
  revalidar();
  return { ok: true };
}

export async function guardarSedeAction(formData: FormData): Promise<CatalogoActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: SESION_TERMINADA };

  const parsed = validateSedeInput({
    nombre: formData.get("nombre"),
    direccion: formData.get("direccion"),
    horaApertura: formData.get("horaApertura"),
    horaCierre: formData.get("horaCierre"),
    activa: formData.get("activa") ?? "true",
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const result = await guardarSede(parseId(formData), parsed.value);
  if (!result.ok) {
    return result.reason === "duplicado"
      ? { ok: false, errors: { nombre: "Ya existe una sede con ese nombre" } }
      : { ok: false, message: "Esa sede ya no existe. Recarga la página." };
  }
  revalidar();
  return { ok: true };
}
