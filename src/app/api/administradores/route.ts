import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { createAdmin, listAdmins } from "@/lib/server/adminService";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const administradores = await listAdmins();
  return NextResponse.json({ administradores });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const result = await createAdmin({
    email: typeof body.email === "string" ? body.email : "",
    nombre: typeof body.nombre === "string" ? body.nombre : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  return NextResponse.json(result.body, { status: result.status });
}
