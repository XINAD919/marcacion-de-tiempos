import type { Metadata } from "next";
import { listAdmins } from "@/lib/server/adminService";
import { auth } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { getSmtpSettings } from "@/lib/server/mailer";
import { AdminsPanel } from "./admins-panel";
import { ConfigForm } from "./config-form";
import { PruebaCorreo } from "./prueba-correo";
import { SmtpForm } from "./smtp-form";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const [session, config, administradores, smtp] = await Promise.all([
    auth(),
    getConfig(),
    listAdmins(),
    getSmtpSettings(),
  ]);

  return (
    <ConfigForm
      config={config}
      aside={<AdminsPanel administradores={administradores} currentAdminId={session?.user?.id ?? ""} />}
    >
      <SmtpForm smtp={smtp} />
      <PruebaCorreo configured={smtp !== null} defaultTo={session?.user?.email ?? ""} />
    </ConfigForm>
  );
}
