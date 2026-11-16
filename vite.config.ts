import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3000 },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    tailwindcss(),
    // Must come before the React plugin. Test files can sit next to routes (e.g. __root.test.tsx)
    // without being picked up as routes.
    tanstackStart({ router: { routeFileIgnorePattern: "\\.test\\.tsx?$" } }),
    viteReact(),
  ],
});
