import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget =
  process.env.QA_VITE_API_TARGET?.trim() ||
  `http://127.0.0.1:${process.env.QA_APP_PORT ?? 3001}`;

if (process.env.QA_VITE_API_TARGET || process.env.QA_APP_PORT) {
  console.log(`[vite] /api proxy → ${apiTarget}`);
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: apiTarget,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.url?.includes("stream")) {
              proxyReq.setHeader("Accept-Encoding", "identity");
            }
          });
        },
      },
    },
  },
});
