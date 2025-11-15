import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_IMMICH_PROXY_TARGET || "http://localhost:3000",
          changeOrigin: true,
          secure: false,
          // Rewrite to remove /api prefix if needed
          // rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      },
    },
  };
});
