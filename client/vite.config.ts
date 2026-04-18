import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const apiBaseUrl = env.VITE_API_BASE_URL;

  const port = env.VITE_PORT ? parseInt(env.VITE_PORT, 10) : 5173;

  return {
    plugins: [react(), tailwindcss()],
    build: {
      chunkSizeWarningLimit: 800,
    },
    server: {
      port,
      proxy: {
        "/api": apiBaseUrl,
        "/socket.io": {
          target: apiBaseUrl,
          ws: true,
        },
      },
    },
  };
});
