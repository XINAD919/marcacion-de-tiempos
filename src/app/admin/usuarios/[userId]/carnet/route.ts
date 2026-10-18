import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { renderCarnetPreview } from "@/lib/server/carnet";

/** Vista previa del carnet tal como llega al correo; sirve también para imprimirlo. */
export async function GET(_request: Request, { params }: RouteContext<"/admin/usuarios/[userId]/carnet">) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { userId } = await params;
  const html = await renderCarnetPreview(userId);
  if (!html) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
