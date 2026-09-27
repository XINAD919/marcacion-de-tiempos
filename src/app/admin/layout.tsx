import { redirect } from "next/navigation";
import { Sidebar } from "@/components/admin/sidebar";
import { auth, signOut } from "@/lib/server/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-dvh bg-bone">
      <Sidebar
        nombre={session.user.name ?? "Administrador"}
        email={session.user.email ?? ""}
        logoutAction={logout}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
