export { auth as proxy } from "@/lib/server/auth";

export const config = {
  // Run on every route except Next's own static/image assets and the favicon —
  // the fine-grained public/protected split happens in callbacks.authorized above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
