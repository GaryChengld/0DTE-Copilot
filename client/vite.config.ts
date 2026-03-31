import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const apiBaseUrl = env.VITE_API_BASE_URL;

  return {
    plugins: [react(), tailwindcss()],
    server: {
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
