import { defineConfig } from "@playwright/test";
import fs from "node:fs";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 30000,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:4173",
    browserName: "chromium",
    locale: "ar",
    serviceWorkers: "block",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
    trace: "retain-on-failure",
  },
  projects: [360, 390, 768, 1024, 1440].map((width) => ({
    name: `rtl-${width}`,
    use: { viewport: { width, height: 900 } },
  })),
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command:
          "npm --prefix ../../web-src run preview -- --host 127.0.0.1 --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});
