import type { Metadata } from "next";
import { listAdmins } from "@/lib/server/adminService";
import { auth } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { AdminsPanel } from "./admins-panel";
import { ConfigForm } from "./config-form";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const [session, config, administradores] = await Promise.all([auth(), getConfig(), listAdmins()]);

  return (
    <ConfigForm
      config={config}
      aside={<AdminsPanel administradores={administradores} currentAdminId={session?.user?.id ?? ""} />}
    />
  );
}
