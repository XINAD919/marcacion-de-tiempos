import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <span className="text-sm font-medium">{session.user.name}</span>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
