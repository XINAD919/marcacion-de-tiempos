import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateAdmin } from "@/lib/server/adminCredentials";
import { isPublicPath } from "@/lib/server/publicPaths";
import { prisma } from "@/lib/server/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: (credentials) => authenticateAdmin(credentials?.email, credentials?.password),
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Self-hosted on a PC inside the fundación's network (not a platform Auth.js
  // auto-trusts like Vercel) — without this, sign-in fails outside localhost.
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        return token;
      }

      // No fresh `user` means this is a refresh of an already-issued token,
      // not the initial sign-in. Re-check the admin is still active so a
      // deactivated admin's existing session stops working on its next
      // refresh instead of staying valid until the JWT naturally expires.
      if (typeof token.id !== "string") return token;

      const admin = await prisma.admin.findUnique({ where: { id: token.id } });
      if (!admin || !admin.activo) {
        delete token.id;
        return token;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        return session;
      }

      // Token lost its id (admin deactivated/removed) — don't hand back a
      // session that looks authenticated with a stale/missing user. The
      // callback param type claims `session.user` is always present (an
      // artifact of @auth/core's database + jwt strategy types being
      // intersected instead of unioned), but `Session["user"]` is genuinely
      // optional, so this is a safe escape hatch, not a real type violation.
      session.user = undefined as unknown as typeof session.user;
      return session;
    },
    authorized({ request, auth }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
});
