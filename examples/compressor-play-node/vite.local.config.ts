// npm run build:local writes dist-local/com.example.compressor/: one ES module
// plus noodlr-plugin.json, ready to copy into the Noodlr Mac app's plugins
// folder (Developer › Show Plugins Folder).
import { readFileSync, writeFileSync } from "node:fs";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Must match manifest.id in src/index.ts; Noodlr refuses a mismatch.
const id = "com.example.compressor";
const outDir = `dist-local/${id}`;
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

export default defineConfig({
  plugins: [
    // Styles go into the JavaScript so the plugin is a single file.
    svelte({ compilerOptions: { css: "injected" } }),
    {
      name: "noodlr-plugin-descriptor",
      closeBundle() {
        const descriptor = {
          schemaVersion: 1,
          id,
          name: "Compressor",
          version,
          kind: "play-node",
          entry: "index.js",
        };
        writeFileSync(
          `${outDir}/noodlr-plugin.json`,
          `${JSON.stringify(descriptor, null, 2)}\n`,
        );
      },
    },
  ],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir,
    emptyOutDir: true,
    lib: {
      entry: "src/local-plugin.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
  },
});
