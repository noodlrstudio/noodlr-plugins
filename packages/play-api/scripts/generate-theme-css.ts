import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPlayAppearanceCss } from "../src/appearance";

const output = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../ui/src/theme/tokens.css",
);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, renderPlayAppearanceCss());
console.log(`Wrote ${output}`);
