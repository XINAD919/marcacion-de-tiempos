import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "https://localhost:3000",
    ignoreHTTPSErrors: true,
    permissions: ["camera"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-video-capture=${process.cwd()}/test/fixtures/fake-camera.y4m`,
      ],
    },
  },
  webServer: {
    command: "pnpm exec next dev --experimental-https",
    url: "https://localhost:3000",
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    // Without this, `next dev --experimental-https` shells out to
    // `mkcert -install`, which tries to add the dev CA to the system-wide
    // trust store and needs sudo. That fails non-interactively, and Next
    // silently falls back to plain HTTP — which then makes this webServer's
    // own https:// health check time out after 60s with no obvious cause.
    // TRUST_STORES=nss tells mkcert to only install into the current
    // user's NSS database (no root needed), which is what Chromium reads
    // on Linux anyway.
    env: { TRUST_STORES: "nss" },
  },
});
