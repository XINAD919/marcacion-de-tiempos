import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { resetAdminPassword, setAdminActivo } from "@/lib/server/adminService";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ adminId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { adminId } = await params;
  const body = await request.json();

  if (typeof body.activo === "boolean") {
    const result = await setAdminActivo({
      currentAdminId: session.user.id,
      targetAdminId: adminId,
      activo: body.activo,
    });
    return NextResponse.json(result.body, { status: result.status });
  }

  if (typeof body.password === "string") {
    const result = await resetAdminPassword({ targetAdminId: adminId, password: body.password });
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
}
