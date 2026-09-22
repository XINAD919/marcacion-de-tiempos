import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateAdmin } from "@/lib/server/adminCredentials";
import { isPublicPath } from "@/lib/server/publicPaths";

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
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
    authorized({ request, auth }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
});
