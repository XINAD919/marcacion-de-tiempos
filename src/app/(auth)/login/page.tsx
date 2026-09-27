import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, signIn } from "@/lib/server/auth";

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
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm px-3 py-8">
        <CardHeader>
          <CardTitle className="text-2xl font-medium">Iniciar sesión</CardTitle>
          <CardDescription className="text-[#131E3D9E]">
            Usa el usuario que te asignó sistemas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-4 text-[#131E3D]">
            {error && <p className="text-sm text-red-600">Correo o contraseña incorrectos</p>}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Usuario o correo</Label>
              <Input id="email" name="email" type="email" required/>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button className='rounded-md bg-red-600 hover:bg-red-800 cursor-pointer ' type="submit">Ingresar</Button>
            <span className="text-gray-500 text-center">
              ¿Olvidaste tu contraseña? <span className="text-red-800 font-semibold">Pide a sistemas que la restablezcan</span>
            </span>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
