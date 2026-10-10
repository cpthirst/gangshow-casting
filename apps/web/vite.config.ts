import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  // The API dev server (apps/api) stands in for API Gateway locally.
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
  test: { environment: "happy-dom" },
});
