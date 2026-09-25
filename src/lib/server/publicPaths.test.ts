import { describe, expect, it } from "vitest";
import { isPublicPath } from "./publicPaths";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/marcacion",
    "/marcacion/",
    "/api/marcacion",
    "/api/marcacion/",
    "/api/auth/callback/credentials",
    "/api/auth/session",
    "/models",
    "/models/tiny_face_detector_model-weights_manifest.json",
    "/models/face_recognition_model-shard1",
  ])("trata %s como pública", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/admin",
    "/admin/administradores",
    "/admin/enrolar/abc-123",
    "/api/usuarios",
    "/api/usuarios/abc-123/enrolar",
    "/api/administradores",
    "/loginfake",
    "/modelsfake",
  ])("trata %s como protegida", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
