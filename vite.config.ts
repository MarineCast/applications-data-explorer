import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localData } from "./scripts/localDataPlugin";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  plugins: [react(), localData({ python: env.MARINECAST_DATA_PYTHON || env.METEOROLOGY_PYTHON, data: env.MARINECAST_DATA_ROOT, weather: env.METEOROLOGY_SOURCE, pilot: env.VIEWSHED_PILOT, components: env.VIEWSHED_COMPONENTS })],
  server: { proxy: { "/api/relationships": { target: "http://127.0.0.1:8001", changeOrigin: false } } },
  preview: { proxy: { "/api/relationships": { target: "http://127.0.0.1:8001", changeOrigin: false } } },
  optimizeDeps: { exclude: ["maplibre-gl"] },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", css: false },
  };
});
