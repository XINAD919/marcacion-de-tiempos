import { listAdmins } from "@/lib/server/adminService";
import { AdminTable } from "./admin-table";

export default async function AdministradoresPage() {
  const administradores = await listAdmins();

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Administradores</h1>
      <AdminTable administradores={administradores} />
    </div>
  );
}
