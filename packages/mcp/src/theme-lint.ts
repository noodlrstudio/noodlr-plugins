import type { SourceFile } from "./source-files.js";

export interface ThemeFinding {
  file: string;
  line: number;
  value: string;
  message: string;
}

const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX_COLOUR = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i;
const NAMED_COLOUR =
  /(?:^|[\s:,(])(white|black|red|green|blue|yellow|orange|purple|gray|grey|pink|cyan|magenta)(?=[\s;,)!]|$)/i;
const COLOUR_DECLARATION =
  /(?:^|[{;\s])(?:color|background(?:-color)?|border(?:-[a-z]+)?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color|column-rule-color)\s*:([^;}]*)/gi;

/**
 * Finds colour literals in CSS: in .css files and in <style> blocks of Svelte
 * components. Colours belong in --noodlr-* tokens so nodes follow both themes.
 */
export function lintTheme(files: readonly SourceFile[]): ThemeFinding[] {
  const findings: ThemeFinding[] = [];
  for (const file of files) {
    const ranges = styleRanges(file);
    if (!ranges.length) continue;
    const lines = file.content.split("\n");
    for (const [start, end] of ranges) {
      for (let index = start; index < end && index < lines.length; index += 1) {
        const text = lines[index].replace(/\/\*.*?\*\//g, "");
        // Defining a token from another is fine; only flag literal values.
        const withoutVars = text.replace(/var\([^)]*\)/g, "");
        const hex = withoutVars.match(HEX_COLOUR);
        const fn = withoutVars.match(COLOUR_FUNCTION);
        const named = [...withoutVars.matchAll(COLOUR_DECLARATION)]
          .map((declaration) => declaration[1].match(NAMED_COLOUR)?.[1])
          .find(Boolean);
        const value = hex?.[0] ?? fn?.[0] ?? named;
        if (value) {
          findings.push({
            file: file.path,
            line: index + 1,
            value: value.trim(),
            message:
              "Colour literal. Use a --noodlr-* token so the node works in Light and Dark themes.",
          });
        }
      }
    }
  }
  return findings;
}

function styleRanges(file: SourceFile): Array<[number, number]> {
  const lines = file.content.split("\n");
  if (file.path.endsWith(".css")) return [[0, lines.length]];
  if (!file.path.endsWith(".svelte")) return [];
  const ranges: Array<[number, number]> = [];
  let open: number | null = null;
  lines.forEach((text, index) => {
    if (open === null && /<style[\s>]/.test(text)) open = index + 1;
    else if (open !== null && /<\/style>/.test(text)) {
      ranges.push([open, index]);
      open = null;
    }
  });
  return ranges;
}
