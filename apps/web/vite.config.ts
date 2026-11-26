import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  // "@/" is src/, for imports across its folders (ADR 0025).
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The API dev server (apps/api) stands in for API Gateway locally. The browser tests point
  // API_URL at their own API, which serves made-up data (playwright.config.ts).
  server: { proxy: { "/api": process.env.API_URL ?? "http://127.0.0.1:3000" } },
  // Imported only when the image viewer first opens, so Vite would find it then and reload the
  // page under the click; bundled at start instead.
  optimizeDeps: { include: ["photoswipe"] },
  test: { environment: "happy-dom", setupFiles: ["src/test-setup.ts"] },
});
