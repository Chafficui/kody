import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Build three bundles:
 *   - kody.js       IIFE  (drop-in <script> use; sets window.Kody)
 *   - kody.esm.js   ESM   (named exports: mount, KodyWidget, types)
 *   - kody.umd.js   UMD   (CommonJS / AMD / global)
 *
 * IIFE is the smallest because Rollup can elide the side effects that
 * are only needed by the module-form builds (mount() export,
 * EventEmitter class name preservation, etc.).
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Kody",
      formats: ["iife", "es", "umd"],
      fileName: (format) => {
        if (format === "es") return "kody.esm.js";
        if (format === "umd") return "kody.umd.js";
        return "kody.js";
      },
    },
    outDir: "dist",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 2,
        pure_getters: true,
        unsafe_arrows: true,
      },
      mangle: true,
      format: { comments: false },
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
