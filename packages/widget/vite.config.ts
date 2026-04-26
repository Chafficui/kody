import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Kody",
      formats: ["iife"],
      fileName: () => "kody.js",
    },
    outDir: "dist",
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true },
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
