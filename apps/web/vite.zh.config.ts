import { defineConfig, mergeConfig } from "vite";
import configuration from "./vite.config.ts";

// Keep the existing chat server and bot bridge running. Only the translated
// frontend is served here; API and realtime use the original local backend.
export default mergeConfig(
  configuration,
  defineConfig({
    preview: {
      host: "127.0.0.1",
      port: 18486,
      strictPort: true,
      proxy: {
        "/api": { target: "http://127.0.0.1:18484", ws: true, changeOrigin: false },
        "/healthz": { target: "http://127.0.0.1:18484", changeOrigin: false },
        "/readyz": { target: "http://127.0.0.1:18484", changeOrigin: false },
      },
    },
  }),
);
