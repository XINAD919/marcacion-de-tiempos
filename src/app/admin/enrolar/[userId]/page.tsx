import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUsuario } from "@/lib/server/usuarioService";
import { formatCedula } from "@/lib/usuarios/userInput";
import { Enrolamiento } from "./enrolamiento";

export const metadata: Metadata = { title: "Enrolamiento facial" };

export default async function EnrolarPage({ params }: PageProps<"/admin/enrolar/[userId]">) {
  const { userId } = await params;
  const user = await getUsuario(userId);
  if (!user) notFound();

  return (
    <Enrolamiento
      userId={user.id}
      nombre={user.nombre}
      detalle={`C.C. ${formatCedula(user.cedula)} · ${user.universidad}`}
      fotosPrevias={user.fotos}
    />
  );
}
