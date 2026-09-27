import { redirect } from "next/navigation";

// La raíz no tiene contenido propio: el proxy manda a /login a quien no tenga
// sesión, así que aquí basta con llevar al panel de administración.
export default function Home() {
  redirect("/admin/administradores");
}
