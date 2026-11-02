import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localAssets } from "./scripts/localDataPlugin";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = `http://127.0.0.1:${env.MARINECAST_API_PORT || env.MARINECAST_RELATIONSHIPS_PORT || "8001"}`;
  const proxy = Object.fromEntries(["/local-data", "/api/local-data", "/api/meteorology", "/api/relationships"]
    .map(path => [path, { target, changeOrigin: false, timeout: 600_000, proxyTimeout: 600_000 }]));
  return {
  plugins: [react(), localAssets()],
  server: { proxy },
  preview: { proxy },
  optimizeDeps: { exclude: ["maplibre-gl"] },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", css: false },
  };
});
