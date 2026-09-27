import type { Metadata } from "next";
import { listFilterOptions } from "@/lib/server/usuarioService";
import { UsuarioForm } from "../_form/usuario-form";

export const metadata: Metadata = { title: "Crear usuario" };

export default async function NuevoUsuarioPage() {
  const { universidades, entidades } = await listFilterOptions();

  return (
    <UsuarioForm
      fotos={0}
      universidades={universidades}
      entidades={entidades}
      defaults={{
        nombre: "",
        cedula: "",
        email: "",
        universidad: "",
        entidad: "",
        horasRequeridas: "",
        fechaInicio: "",
        horaInicio: "",
        horaFin: "",
        activo: "true",
      }}
    />
  );
}
