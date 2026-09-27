import { redirect } from "next/navigation";

// La gestión de administradores vive ahora en Configuración (maqueta 4g).
export default function AdministradoresPage() {
  redirect("/admin/configuracion");
}
