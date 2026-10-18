import type { Metadata } from "next";
import { listCatalogo } from "@/lib/server/catalogoService";
import { UsuarioForm } from "../_form/usuario-form";

export const metadata: Metadata = { title: "Crear usuario" };

export default async function NuevoUsuarioPage() {
  const { instituciones, sedes } = await listCatalogo();

  return (
    <UsuarioForm
      fotos={0}
      instituciones={instituciones}
      sedes={sedes}
      defaults={{
        tipo: "practicante",
        nombre: "",
        cedula: "",
        email: "",
        institucionId: "",
        sedeId: "",
        horasRequeridas: "",
        fechaInicio: "",
        horaInicio: "",
        horaFin: "",
        activo: "true",
      }}
    />
  );
}
