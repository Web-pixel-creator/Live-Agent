import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

const appShellRoot = path.resolve(__dirname, "app-shell");
const publicDir = path.resolve(__dirname, "public");

export default defineConfig({
  root: appShellRoot,
  base: "/app-shell/",
  plugins: [react()],
  publicDir: path.resolve(appShellRoot, "public"),
  resolve: {
    alias: {
      "@": path.resolve(appShellRoot, "src"),
    },
  },
  build: {
    outDir: path.resolve(publicDir, "app-shell"),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(appShellRoot, "tailwind.config.ts") }),
        autoprefixer(),
      ],
    },
  },
});
