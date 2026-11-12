import { REPOSITORY_URL } from "./knowledge.js";

export type ScaffoldRoute = "play-node" | "web-app";

export interface ScaffoldOptions {
  route: ScaffoldRoute;
  /** Reverse-domain id, such as com.example.my-node. */
  id: string;
  /** Human-readable name. */
  name: string;
  description?: string;
}

export interface ScaffoldFile {
  path: string;
  content: string;
}

const REVERSE_DOMAIN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+){2,}$/;

export function scaffoldIssues(options: ScaffoldOptions): string[] {
  const issues: string[] = [];
  if (!REVERSE_DOMAIN_ID.test(options.id)) {
    issues.push(
      `id "${options.id}" must be reverse-domain and lower case, such as com.example.my-node`,
    );
  }
  if (!options.name.trim() || options.name.length > 80) {
    issues.push("name must be 1 to 80 characters");
  }
  if (options.description && options.description.length > 240) {
    issues.push("description must be at most 240 characters");
  }
  return issues;
}

export function scaffoldFiles(options: ScaffoldOptions): ScaffoldFile[] {
  return options.route === "play-node"
    ? playNodeFiles(options)
    : webAppFiles(options);
}

function packageName(id: string) {
  return id
    .split(".")
    .slice(-1)[0]
    .replace(/[^a-z0-9-]/g, "-");
}

function pascalCase(name: string) {
  const words = name.match(/[A-Za-z0-9]+/g) ?? ["Node"];
  const joined = words
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");
  return /^[A-Za-z]/.test(joined) ? joined : `Node${joined}`;
}

function camelCase(name: string) {
  const pascal = pascalCase(name);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function playNodeFiles(options: ScaffoldOptions): ScaffoldFile[] {
  const component = pascalCase(options.name);
  const exportName = camelCase(options.name);
  const description = options.description ?? `${options.name} for Noodlr Board`;
  return [
    {
      path: "package.json",
      content: json({
        name: packageName(options.id),
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite",
          test: "vitest run",
          validate: "svelte-check --tsconfig ./tsconfig.json && vitest run",
          "build:local": "vite build --config vite.local.config.ts",
        },
        dependencies: {
          "@noodlr/play-api": "^0.3.0",
          "@noodlr/ui": "^0.1.0",
          svelte: "^5.41.3",
        },
        devDependencies: {
          "@sveltejs/vite-plugin-svelte": "^6.2.1",
          "svelte-check": "^4.3.3",
          typescript: "^5.9.3",
          vite: "^7.2.2",
          vitest: "^4.1.9",
        },
      }),
    },
    {
      path: "tsconfig.json",
      content: json({
        compilerOptions: {
          allowJs: true,
          isolatedModules: true,
          lib: ["ES2022", "DOM"],
          module: "ESNext",
          moduleResolution: "bundler",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src/**/*.ts", "src/**/*.svelte"],
      }),
    },
    {
      path: "vite.config.ts",
      content: `import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
});
`,
    },
    {
      path: "vite.local.config.ts",
      content: localBuildConfig(options),
    },
    {
      path: "src/local-plugin.ts",
      content: `// Entry for the Noodlr Mac app's local plugins folder (npm run build:local).
// The bundle carries its own Svelte runtime, so it mounts its own view into
// the element the host gives it.
import { mount, unmount } from "svelte";
import { ${exportName} } from "./index";

const { view, ...definition } = ${exportName};

export default {
  definition,
  mount(target: HTMLElement, props: Record<string, unknown>) {
    const app = mount(view, { target, props: props as never });
    return { destroy: () => unmount(app) };
  },
};
`,
    },
    {
      path: ".gitignore",
      content: "node_modules\ndist\ndist-local\n",
    },
    {
      path: "src/index.ts",
      content: `import { definePlayNode } from "@noodlr/play-api";
import ${component} from "./${component}.svelte";

export const ${exportName} = definePlayNode({
  manifest: {
    id: ${JSON.stringify(options.id)},
    name: ${JSON.stringify(options.name)},
    version: "0.1.0",
    apiVersion: "0",
    description: ${JSON.stringify(description.slice(0, 240))},
    icon: "Activity",
    // Declare every capability the node uses, and nothing else.
    capabilities: ["collaboration.shared-state", "transport.read"],
    minimumSize: { width: 220, height: 160 },
    preferredSize: { width: 280, height: 200 },
  },
  state: {
    version: 1,
    fields: {
      level: {
        type: "number",
        integer: true,
        minimum: 0,
        maximum: 127,
        default: 96,
        scope: "shared-persisted",
        label: "Level",
      },
    },
  },
  view: ${component},
});
`,
    },
    {
      path: `src/${component}.svelte`,
      content: `<script lang="ts">
  import type { PlayJsonObject, PlayNodeViewProps } from "@noodlr/play-api";
  import { Knob, NodeSurface } from "@noodlr/ui/play-node";

  export let context: PlayNodeViewProps<PlayJsonObject>["context"];
  export let readOnly = false;

  let level = 96;
  let bpm = 120;

  context.lifecycle.onDispose(
    context.state.subscribe((state) => {
      level = typeof state.level === "number" ? state.level : 96;
    }),
  );
  context.lifecycle.onDispose(
    context.transport.subscribe((snapshot) => (bpm = snapshot.bpm)),
  );
</script>

<NodeSurface label=${JSON.stringify(options.name)} description=${JSON.stringify(description.slice(0, 240))}>
  <p class="tempo">Space tempo {bpm} BPM</p>
  <Knob
    label="Level"
    value={level}
    minimum={0}
    maximum={127}
    disabled={readOnly}
    onPreview={(value) => context.state.preview("level", value)}
    onCommit={(value) =>
      context.state.commit("level", value, { historyLabel: "Change Level" })}
  />
</NodeSurface>

<style>
  /* Colours come from --noodlr-* tokens only. */
  .tempo {
    margin: 0;
    color: var(--noodlr-text-secondary);
    font-size: 0.75rem;
  }
</style>
`,
    },
    {
      path: "src/index.test.ts",
      content: `import { describe, expect, it } from "vitest";
import {
  PLAY_API_VERSION,
  createMockPlayNodeContext,
  createPlayNodeSharedDefaults,
} from "@noodlr/play-api";
import { ${exportName} } from "./index";

describe(${JSON.stringify(options.name)}, () => {
  it("targets the current Play API", () => {
    expect(${exportName}.manifest.apiVersion).toBe(PLAY_API_VERSION);
  });

  it("has valid defaults", () => {
    expect(createPlayNodeSharedDefaults(${exportName}.state.fields)).toEqual({
      level: 96,
    });
  });

  it("follows the transport", () => {
    const mock = createMockPlayNodeContext(
      createPlayNodeSharedDefaults(${exportName}.state.fields),
      ["transport.read"],
    );
    const tempos: number[] = [];
    mock.context.transport.subscribe(({ bpm }) => tempos.push(bpm));
    mock.setClock({ playing: true, bpm: 96 });
    expect(tempos).toEqual([120, 96]);
  });
});
`,
    },
    {
      path: "README.md",
      content: `# ${options.name}

A Noodlr Board Play node.

\`\`\`sh
npm install
npm run validate
\`\`\`

## Run it in the Noodlr Mac app

\`\`\`sh
npm run build:local
\`\`\`

${localPluginSteps(options.id)}

Play nodes are reviewed before they ship. See ${REPOSITORY_URL} for the
contract and the submission process.
`,
    },
  ];
}

/** The plugins folder of the App Store build and of a development build. */
export const LOCAL_PLUGIN_FOLDERS = {
  app: "~/Library/Containers/com.5of12.noodlr/Data/Library/Application Support/Noodlr/Plugins",
  development: "~/Library/Application Support/Noodlr/Plugins",
} as const;

/** How to load a `build:local` bundle into the Mac app, for docs and prompts. */
export function localPluginSteps(id: string) {
  return `This writes \`dist-local/${id}/\`: one JavaScript file and a
\`noodlr-plugin.json\`. To run it in the Noodlr Mac app:

1. Choose **Developer › Show Plugins Folder** and copy \`dist-local/${id}\`
   into it. That folder is \`${LOCAL_PLUGIN_FOLDERS.app}\`, or
   \`${LOCAL_PLUGIN_FOLDERS.development}\` for a development build.
2. Turn on **Developer › Load Local Plugins**.
3. Choose **Developer › Open Node Lab**. The node is put on the stage and
   listed under **Local plugins**. If it can't load, the reason is shown there.

Local plugins are unreviewed and run with the board's access, so they only
load in Node Lab. Rebuild and reopen Node Lab after each change.`;
}

function localBuildConfig(options: ScaffoldOptions) {
  return `// npm run build:local writes dist-local/${options.id}/: one ES module plus
// noodlr-plugin.json, ready to copy into the Noodlr Mac app's plugins folder.
import { readFileSync, writeFileSync } from "node:fs";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Must match manifest.id in src/index.ts; Noodlr refuses a mismatch.
const id = ${JSON.stringify(options.id)};
const outDir = \`dist-local/\${id}\`;
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
          name: ${JSON.stringify(options.name)},
          version,
          kind: "play-node",
          entry: "index.js",
        };
        writeFileSync(
          \`\${outDir}/noodlr-plugin.json\`,
          \`\${JSON.stringify(descriptor, null, 2)}\\n\`,
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
`;
}

function webAppFiles(options: ScaffoldOptions): ScaffoldFile[] {
  return [
    {
      path: "package.json",
      content: json({
        name: packageName(options.id),
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
          test: "vitest run",
        },
        dependencies: {
          "@noodlr/plugin-sdk": "^0.1.0",
        },
        devDependencies: {
          typescript: "^5.9.3",
          vite: "^7.2.2",
          vitest: "^4.1.9",
        },
      }),
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${options.name.replace(/[<&]/g, "")}</title>
  </head>
  <body>
    <main>
      <h1>${options.name.replace(/[<&]/g, "")}</h1>
      <p id="status">Waiting for Noodlr…</p>
      <button id="note" type="button">Send middle C</button>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    },
    {
      path: "src/bridge.ts",
      content: `import { createNoodlrWebAppBridge } from "@noodlr/plugin-sdk/web-app";

export interface AppState {
  lastNote: number | null;
}

export const state: AppState = { lastNote: null };

export const bridge = createNoodlrWebAppBridge({
  manifest: {
    id: ${JSON.stringify(options.id)},
    name: ${JSON.stringify(options.name)},
    version: "0.1.0",
    ports: [
      { id: "midi-in", label: "MIDI In", type: "midi", direction: "in" },
      { id: "midi-out", label: "MIDI Out", type: "midi", direction: "out" },
    ],
    features: { runtimeControl: true, state: true },
  },
  onMidiMessage: ({ data }) => {
    const [status, note, velocity] = data;
    if ((status & 0xf0) === 0x90 && velocity > 0) {
      state.lastNote = note;
      bridge.updateState({ ...state });
    }
  },
  onRestoreState: (restored) => {
    if (restored && typeof restored === "object" && !Array.isArray(restored)) {
      const note = (restored as Record<string, unknown>).lastNote;
      state.lastNote = typeof note === "number" ? note : null;
    }
  },
  onAppearanceChange: ({ theme, tokens }) => {
    document.documentElement.dataset.theme = theme;
    for (const [name, value] of Object.entries(tokens)) {
      document.documentElement.style.setProperty(\`--noodlr-\${name}\`, value);
    }
  },
});

export function sendNote(note: number, velocity = 100) {
  bridge.sendMidi("midi-out", [0x90, note, velocity]);
  setTimeout(() => bridge.sendMidi("midi-out", [0x80, note, 0]), 250);
}
`,
    },
    {
      path: "src/main.ts",
      content: `import { sendNote } from "./bridge";

document.getElementById("status")!.textContent = "Connected when loaded in a Noodlr web app node.";
document.getElementById("note")!.addEventListener("click", () => sendNote(60));
`,
    },
    {
      path: "README.md",
      content: `# ${options.name}

A web app that connects to Noodlr Board through \`@noodlr/plugin-sdk\`. It
needs no review: host it anywhere and add it to a board as a web app node.

\`\`\`sh
npm install
npm run dev
\`\`\`

The bridge carries MIDI and JSON state (at most 32 KB). It does not carry
audio. See ${REPOSITORY_URL}.
`,
    },
  ];
}
