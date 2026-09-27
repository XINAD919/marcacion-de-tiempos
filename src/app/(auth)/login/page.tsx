import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { auth, signIn } from "@/lib/server/auth";
import { SubmitButton } from "./submit-button";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/admin/administradores");
  }

  const { error } = await searchParams;
  const hasError = Boolean(error);

  async function login(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/admin/administradores",
      });
    } catch (authError) {
      if (authError instanceof AuthError) {
        redirect("/login?error=credenciales");
      }
      throw authError;
    }
  }

  return (
    <div className="flex w-full max-w-110 flex-col gap-5.5 rounded-2xl border border-border bg-white p-10">
      <div>
        <h2 className="text-[27px] font-bold tracking-[-0.02em] text-navy">Iniciar sesión</h2>
        <p className="mt-1.5 text-[14.5px] text-muted-foreground">
          Usa el usuario que te asignó sistemas.
        </p>
      </div>

      {hasError && (
        <div
          id="login-error"
          role="alert"
          className="flex flex-col gap-1 rounded-xl border border-brand-red/30 bg-[#f9e8ea] px-4 py-3.5 text-brand-red-ink"
        >
          <p className="text-[14.5px] font-bold">El correo o la contraseña no coinciden</p>
          <p className="text-[13.5px] leading-normal">
            Revisa que no tengas activadas las mayúsculas.
          </p>
        </div>
      )}

      <form action={login} className="flex flex-col gap-5.5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "login-error" : undefined}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "login-error" : undefined}
          />
        </div>
        <SubmitButton />
      </form>

      <p className="text-center text-[13.5px] leading-normal text-muted-foreground">
        ¿Olvidaste tu contraseña?{" "}
        <span className="font-semibold text-brand-red-ink">Pide a sistemas que la restablezca</span>
      </p>
    </div>
  );
}
