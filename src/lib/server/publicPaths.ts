const PUBLIC_PATH_PREFIXES = ["/login", "/marcacion", "/api/marcacion", "/api/auth"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
