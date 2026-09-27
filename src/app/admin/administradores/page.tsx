import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { listAdmins } from "@/lib/server/adminService";
import { AdminTable } from "./admin-table";

export const metadata: Metadata = { title: "Administradores" };

export default async function AdministradoresPage() {
  const administradores = await listAdmins();
  const activos = administradores.filter((admin) => admin.activo).length;

  return (
    <>
      <PageHeader
        title="Administradores"
        description={`${administradores.length} registrados · ${activos} activos · ${administradores.length - activos} inactivos`}
      />
      <div className="p-8">
        <AdminTable administradores={administradores} />
      </div>
    </>
  );
}
