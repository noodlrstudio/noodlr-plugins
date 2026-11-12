import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

export interface SourceFile {
  path: string;
  content: string;
}

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "target",
  ".git",
  ".svelte-kit",
  "coverage",
]);
const SOURCE_EXTENSIONS = [".ts", ".js", ".mjs", ".svelte", ".css"];
const MAX_FILES = 500;
const MAX_FILE_BYTES = 512 * 1024;

/** Reads a plugin's source files, skipping dependencies, build output and tests. */
export async function readSourceFiles(
  directory: string,
  options: { includeTests?: boolean } = {},
): Promise<SourceFile[]> {
  const root = resolve(directory);
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }
  const files: SourceFile[] = [];
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (files.length >= MAX_FILES) return;
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) {
          await walk(full);
        }
        continue;
      }
      if (!SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      if (!options.includeTests && /\.(test|spec)\.[a-z]+$/.test(entry.name)) {
        continue;
      }
      const size = (await stat(full)).size;
      if (size > MAX_FILE_BYTES) continue;
      files.push({
        path: relative(root, full),
        content: await readFile(full, "utf8"),
      });
    }
  }
  await walk(root);
  return files;
}
