import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Los paquetes del monorepo se resuelven a su fuente TypeScript: Vite los
// transpila igual que el código de la app, así que no hace falta un paso de
// build intermedio en desarrollo.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@invlafe/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@invlafe/query": fileURLToPath(
        new URL("../../packages/query/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
});
