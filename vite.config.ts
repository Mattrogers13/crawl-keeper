import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { buildLabel, manifestForBranch } from "./src/devManifest";

// Renames dist/manifest.json on non-main Cloudflare builds (see devManifest.ts).
const devManifest = (): Plugin => ({
  name: "dev-manifest",
  apply: "build",
  closeBundle() {
    const path = resolve("dist/manifest.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    const out = manifestForBranch(manifest, process.env.WORKERS_CI_BRANCH);
    if (out !== manifest) writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), devManifest()],
  build: {
    rollupOptions: {
      // Every extra page (background.html, an embedded menu, a modal) must be
      // listed here or Vite won't build it. See docs/obr/patterns.md.
      input: {
        main: resolve("index.html"),
      },
    },
  },
  define: {
    "import.meta.env.VITE_BUILD_LABEL": JSON.stringify(
      buildLabel(process.env.WORKERS_CI_BRANCH, process.env.WORKERS_CI_COMMIT_SHA),
    ),
  },
  server: {
    // Owlbear loads the dev server's manifest and pages cross-origin.
    cors: true,
  },
});
