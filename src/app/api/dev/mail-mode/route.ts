import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { usaTransporteJson } from "@/lib/server/mailer";

/**
 * Solo para las pruebas e2e: dice si este servidor arma los correos sin
 * enviarlos (MAIL_TRANSPORT=json). Responde 404 en producción y sin sesión.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  if (!(await auth())?.user) return new NextResponse(null, { status: 401 });
  return NextResponse.json({ json: usaTransporteJson() });
}
