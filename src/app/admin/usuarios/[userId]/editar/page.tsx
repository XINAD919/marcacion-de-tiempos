import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listCatalogo } from "@/lib/server/catalogoService";
import { dbDateToIso, getUsuario } from "@/lib/server/usuarioService";
import { UsuarioForm } from "../../_form/usuario-form";

export const metadata: Metadata = { title: "Editar usuario" };

export default async function EditarUsuarioPage({ params }: PageProps<"/admin/usuarios/[userId]/editar">) {
  const { userId } = await params;
  const [user, { instituciones, sedes }] = await Promise.all([getUsuario(userId), listCatalogo()]);
  if (!user) notFound();

  return (
    <UsuarioForm
      userId={user.id}
      fotos={user.fotos}
      carnet={{
        enviadoEn: user.carnet?.enviadoEn?.toISOString() ?? null,
        enviadoA: user.carnet?.enviadoA ?? null,
      }}
      instituciones={instituciones}
      sedes={sedes}
      defaults={{
        tipo: user.tipo === "natural" ? "natural" : "practicante",
        nombre: user.nombre,
        cedula: user.cedula,
        email: user.email ?? "",
        institucionId: user.institucionId ? String(user.institucionId) : "",
        sedeId: user.sedeId ? String(user.sedeId) : "",
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
