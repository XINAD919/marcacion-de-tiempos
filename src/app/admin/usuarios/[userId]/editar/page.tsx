import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dbDateToIso, getUsuario, listFilterOptions } from "@/lib/server/usuarioService";
import { UsuarioForm } from "../../_form/usuario-form";

export const metadata: Metadata = { title: "Editar usuario" };

export default async function EditarUsuarioPage({ params }: PageProps<"/admin/usuarios/[userId]/editar">) {
  const { userId } = await params;
  const [user, { universidades, entidades }] = await Promise.all([getUsuario(userId), listFilterOptions()]);
  if (!user) notFound();

  return (
    <UsuarioForm
      userId={user.id}
      fotos={user.fotos}
      universidades={universidades}
      entidades={entidades}
      defaults={{
        nombre: user.nombre,
        cedula: user.cedula,
        email: user.email ?? "",
        universidad: user.universidad,
        entidad: user.entidad,
        // 0 es el valor por defecto de la migración para usuarios anteriores a 4c.
        horasRequeridas: user.horasRequeridas > 0 ? String(user.horasRequeridas) : "",
        fechaInicio: dbDateToIso(user.fechaInicio),
        horaInicio: user.horaInicio ?? "",
        horaFin: user.horaFin ?? "",
        activo: user.activo ? "true" : "false",
      }}
    />
  );
}
