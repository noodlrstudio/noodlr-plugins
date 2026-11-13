import { AUDIFRAME_CLIENT_VERSION } from "./audiframe.js";
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
          "@noodlrstudio/play-api": "^0.3.0",
          "@noodlrstudio/ui": "^0.1.0",
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
    ...playNodePreviewFiles(exportName, options.name),
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
      content: `import { definePlayNode } from "@noodlrstudio/play-api";
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
  import type { PlayJsonObject, PlayNodeViewProps } from "@noodlrstudio/play-api";
  import { Knob, NodeSurface } from "@noodlrstudio/ui/play-node";

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
} from "@noodlrstudio/play-api";
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

/**
 * index.html and src/preview.ts: `npm run dev` shows the node in a browser
 * with the mock host context, the theme tokens and real Web Audio for its
 * audio ports, so it can be tried without the Mac app.
 */
export function playNodePreviewFiles(
  exportName: string,
  name: string,
): ScaffoldFile[] {
  const title = name.replace(/[<&]/g, "");
  return [
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} preview</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        gap: 1rem;
        background: var(--noodlr-surface-canvas);
        color: var(--noodlr-text-primary);
        font-family: system-ui, sans-serif;
      }
      #toolbar {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        font-size: 0.8rem;
        color: var(--noodlr-text-secondary);
      }
      #toolbar button {
        font: inherit;
        padding: 0.35rem 0.7rem;
        border-radius: 0.5rem;
        border: 1px solid var(--noodlr-border-strong);
        background: var(--noodlr-surface-2);
        color: var(--noodlr-text-primary);
        cursor: pointer;
      }
      #node {
        background: var(--noodlr-surface-1);
        border: 1px solid var(--noodlr-border);
        border-radius: 1rem;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div id="toolbar"></div>
    <div id="node"></div>
    <script type="module" src="/src/preview.ts"></script>
  </body>
</html>
`,
    },
    {
      path: "src/preview.ts",
      content: `// npm run dev: the node in a browser, with the mock host context from
// @noodlrstudio/play-api/testing, the noodlr theme tokens, and real Web Audio
// for its audio ports. For a quick look while you build. Use the Mac app's
// Node Lab (npm run build:local) to try it in noodlr itself.
import { mount } from "svelte";
import "@noodlrstudio/ui/theme.css";
import {
  createMockPlayNodeContext,
  createPlayNodeSharedDefaults,
  type PlayNodeCapability,
} from "@noodlrstudio/play-api";
import { ${exportName} as node } from "./index";

const ports = node.ports ?? [];
const mock = createMockPlayNodeContext(
  createPlayNodeSharedDefaults(node.state.fields),
  [...(node.manifest.capabilities ?? [])] as PlayNodeCapability[],
  { frame: { ports, size: node.manifest.preferredSize } },
);

// The mock has no audio; give its audio ports a real AudioContext. Inputs are
// gain nodes the test tone feeds; outputs go to the speakers.
const audio = new AudioContext();
const inputs = new Map<string, GainNode>();
const inputFor = (portId: string) => {
  let gain = inputs.get(portId);
  if (!gain) inputs.set(portId, (gain = audio.createGain()));
  return gain;
};
Object.assign(mock.context.audio, {
  ensureReady: async () => {
    await audio.resume();
    return audio;
  },
  context: () => audio,
  input: (portId: string) => ({ node: inputFor(portId) }),
  output: () => ({
    connect(source: AudioNode) {
      source.connect(audio.destination);
      return () => source.disconnect(audio.destination);
    },
  }),
});

const toolbar = document.getElementById("toolbar")!;
const button = (label: string, onClick: () => void) => {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", onClick);
  toolbar.append(element);
  return element;
};

let theme: "dark" | "light" = "dark";
button("Light / Dark", () => {
  theme = theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.noodlrTheme = theme;
  mock.setTheme(theme);
});

if (ports.some((port) => port.type === "audio" && port.direction === "in")) {
  let tone: OscillatorNode | null = null;
  const toneButton = button("Play test tone", () => {
    void audio.resume();
    if (tone) {
      tone.stop();
      tone = null;
      toneButton.textContent = "Play test tone";
      return;
    }
    tone = audio.createOscillator();
    tone.type = "sawtooth";
    tone.frequency.value = 110;
    const level = audio.createGain();
    level.gain.value = 0.3;
    tone.connect(level);
    for (const port of ports) {
      if (port.type === "audio" && port.direction === "in") {
        level.connect(inputFor(port.id));
      }
    }
    tone.start();
    toneButton.textContent = "Stop test tone";
  });
}

const note = document.createElement("span");
note.textContent = "Mock host: no board, cables or other players.";
toolbar.append(note);

// Nodes fill the frame the host gives them, so give the preview one too.
const size = node.manifest.preferredSize ?? { width: 300, height: 260 };
const target = document.getElementById("node")!;
target.style.width = \`\${size.width}px\`;
target.style.height = \`\${size.height}px\`;

const controller = await node.setup?.(mock.context as never);
mount(node.view, {
  target,
  props: {
    context: mock.context,
    controller,
    size,
    active: true,
    readOnly: false,
  } as never,
});
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
4. To play it with other nodes, choose **Developer › Open Local Room** (Mac
   app 1.0.8 or later) and press Tab. It's listed as **Local · unreviewed**.

Local plugins are unreviewed and run with the board's access, so they need
[developer access](https://github.com/noodlrstudio/noodlr-plugins#developer-access)
and only load in Node Lab and local Rooms, which stay on your Mac. They never
appear in a shared Space, and a local Room can't be saved to noodlr while it
has a local node. After each change, rebuild, copy the folder again and reopen
Node Lab or the Room.`;
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
  const title = options.name.replace(/[<&]/g, "");
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
          check: "tsc --noEmit",
        },
        dependencies: {
          // audiframe is in alpha: pin the exact version.
          "@audiframe/client": AUDIFRAME_CLIENT_VERSION,
        },
        devDependencies: {
          typescript: "^5.9.3",
          vite: "^7.2.2",
        },
      }),
    },
    {
      path: "tsconfig.json",
      content: json({
        compilerOptions: {
          lib: ["ES2022", "DOM"],
          module: "ESNext",
          moduleResolution: "bundler",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src/**/*.ts"],
      }),
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p id="status">Not connected. Open this app in a Noodlr Web App node.</p>
      <button id="note" type="button">Play middle C</button>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    },
    {
      path: "src/main.ts",
      content: `// An audiframe app: Noodlr Board's Web App node plays it from MIDI cables,
// takes its notes out, mutes or suspends it, and saves its state with the
// space. The same code works in any audiframe host.
import { createClient } from "@audiframe/client";

const APP_ID = ${JSON.stringify(options.id)};
const SCHEMA_ID = \`\${APP_ID}.state\`;

interface AppState {
  lastNote: number | null;
}
let state: AppState = { lastNote: null };
const status = document.getElementById("status")!;

const client = createClient({
  manifest: {
    id: APP_ID,
    name: ${JSON.stringify(options.name)},
    appVersion: "0.1.0",
    protocolVersions: [{ major: 1, minor: 0 }],
    capabilities: ["lifecycle", "state.snapshot", "midi.input", "midi.output"].map(
      (id) => ({ id, version: 1 }),
    ),
    ports: [
      { id: "midi-in", label: "MIDI In", direction: "in", type: "midi1" },
      { id: "midi-out", label: "MIDI Out", direction: "out", type: "midi1" },
    ],
    stateSchemas: [
      { schemaId: SCHEMA_ID, writableVersion: 1, readableVersions: [1] },
    ],
  },
  midi: (events) => {
    for (const { data } of events) {
      const [statusByte, note, velocity] = data;
      if ((statusByte & 0xf0) === 0x90 && velocity > 0) {
        state = { lastNote: note };
        status.textContent = \`Last note in: \${note}\`;
        client.markStateDirty();
      }
    }
  },
  lifecycle: ({ enabled, audible }) => {
    status.textContent = enabled && audible ? "Connected" : "Muted by the board";
    return "running";
  },
  onPanic: () => {
    status.textContent = "All notes off";
  },
  state: {
    get: () => ({
      appId: APP_ID,
      schemaId: SCHEMA_ID,
      schemaVersion: 1,
      data: { ...state },
    }),
    // Check what arrives before using it.
    set: (snapshot) => {
      const note = (snapshot.data as { lastNote?: unknown } | null)?.lastNote;
      state = { lastNote: typeof note === "number" ? note : null };
    },
  },
});

// Connect on load: the board offers a session for a few seconds. Outside a
// host this does nothing.
client.connect();

document.getElementById("note")!.addEventListener("click", () => {
  const send = (data: number[]) =>
    client.sendMidi([{ id: crypto.randomUUID(), portId: "midi-out", data }]);
  send([0x90, 60, 100]);
  setTimeout(() => send([0x80, 60, 0]), 250);
});
`,
    },
    {
      path: ".gitignore",
      content: "node_modules\ndist\n",
    },
    {
      path: "README.md",
      content: `# ${options.name}

A web app for Noodlr Board, built on the open
[audiframe](https://github.com/noodlrstudio/audiframe) protocol. It needs no
review: host it anywhere over HTTPS.

\`\`\`sh
npm install
npm run dev
\`\`\`

To use it on a board, add a **Web App** node and give it your app's address
with \`?audiframe=1\` on the end, for example
\`https://example.com/my-app/?audiframe=1\`. Noodlr only offers audiframe to
URLs with that flag.

Your app keeps its own UI and audio; the board sends it MIDI, takes its notes
out, mutes or suspends it, and saves its state with the space. Audio does not
cross the frame. See ${REPOSITORY_URL}.
`,
    },
  ];
}
