// Post-build step for `npm run build`.
//
// The sources use extensionless relative imports ("./types") and are compiled
// with `moduleResolution: "Bundler"`, so tsc emits those specifiers unchanged.
// Node's ES module loader and TypeScript's NodeNext resolution both require
// the file extension, so this rewrites every relative specifier in the emitted
// .js and .d.ts files to end in ".js".
//
// This can be deleted, and the build switched to NodeNext, once the sources
// carry explicit ".js" extensions.

import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const outputDirectory = resolve(process.argv[2] ?? "dist");
const specifierPattern =
  /(\b(?:from|import)\s*\(?\s*)(["'])(\.{1,2}\/[^"']*)\2/g;

async function* emittedFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* emittedFiles(path);
    else if (/\.(js|d\.ts)$/.test(entry.name)) yield path;
  }
}

function withExtension(file, specifier) {
  if (/\.(js|json)$/.test(specifier)) return specifier;
  const target = resolve(dirname(file), specifier);
  if (existsSync(`${target}.js`)) return `${specifier}.js`;
  if (existsSync(join(target, "index.js"))) return `${specifier}/index.js`;
  throw new Error(`${file}: cannot resolve "${specifier}"`);
}

let rewritten = 0;
for await (const file of emittedFiles(outputDirectory)) {
  const source = await readFile(file, "utf8");
  const output = source.replace(
    specifierPattern,
    (_match, prefix, quote, specifier) =>
      `${prefix}${quote}${withExtension(file, specifier)}${quote}`,
  );
  if (output !== source) {
    await writeFile(file, output, "utf8");
    rewritten += 1;
  }
}

console.log(`Added .js extensions in ${rewritten} files.`);
