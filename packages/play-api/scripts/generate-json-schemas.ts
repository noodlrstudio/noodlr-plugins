import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { playNodeSchemasAsJsonSchema } from "../src/validation";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(
  scriptDirectory,
  "../../../schemas/play-api/v0",
);
const schemas = playNodeSchemasAsJsonSchema();

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  Object.entries(schemas).map(async ([name, schema]) => {
    const output = await format(JSON.stringify(schema), { parser: "json" });
    return writeFile(
      resolve(outputDirectory, `${name}.schema.json`),
      output,
      "utf8",
    );
  }),
);

console.log(`Generated ${Object.keys(schemas).length} Play API schemas.`);
