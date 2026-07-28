// Post-build step: rewrite the emitted index.d.ts into kody.d.ts so
// the public type entry matches the bundle names (kody.js,
// kody.esm.js, kody.umd.js). The re-export in kody.ts pulls the
// public API surface (KodyWidget, KodyPublicAPI, mount) so consumers
// can import everything from "@kody/widget".
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("./dist");
const src = path.join(distDir, "index.d.ts");
const dst = path.join(distDir, "kody.d.ts");

if (!fs.existsSync(src)) {
  console.error("[stamp-types] no index.d.ts found");
  process.exit(1);
}

let content = fs.readFileSync(src, "utf8");

// Rewrite the relative imports so they resolve to the actual files
// in dist/ (which mirror the src/ layout).
const replacements = [
  [/\.\/kody\.js/g, "./kody.js"],
  [/\.\/utils\/emitter\.js/g, "./utils/emitter.js"],
  [/\.\/utils\/embed-config\.js/g, "./utils/embed-config.js"],
  [/\.\/utils\/focus-trap\.js/g, "./utils/focus-trap.js"],
  [/\.\/utils\/keyboard\.js/g, "./utils/keyboard.js"],
  [/\.\/utils\/session\.js/g, "./utils/session.js"],
  [/\.\/i18n\/en\.js/g, "./i18n/en.js"],
];
for (const [re, replacement] of replacements) {
  content = content.replace(re, replacement);
}

fs.writeFileSync(dst, content);
console.log("[stamp-types] wrote dist/kody.d.ts");
