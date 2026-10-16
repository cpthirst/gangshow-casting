import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  // The API dev server (apps/api) stands in for API Gateway locally. The browser tests point
  // API_URL at their own API, which serves made-up data (playwright.config.ts).
  server: { proxy: { "/api": process.env.API_URL ?? "http://127.0.0.1:3000" } },
  test: { environment: "happy-dom" },
});
