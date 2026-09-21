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
  },
});
