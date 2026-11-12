# Building plugins with a coding agent

`@noodlr/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io)
server for building Noodlr Board plugins with a coding agent such as Claude
Code. It gives the agent the real plugin contracts, the UI kit and theme
tokens, and the checks reviewers run, so the agent writes against the actual
API instead of guessing and can check its own work before you open a pull
request.

The server runs on your machine over stdio. It needs no account and sends
nothing anywhere.

- [Set up](#set-up)
- [What the server provides](#what-the-server-provides)
- [Walkthrough: build a compressor](#walkthrough-build-a-compressor)
- [Debugging the server](#debugging-the-server)

## Set up

> **Early preview.** `@noodlr/mcp` is not on npm yet. Until it is, build it
> from this repository (see [From source](#from-source)). The `npx` commands
> below are how it will work once it is published.

### Claude Code

```sh
claude mcp add noodlr -- npx -y @noodlr/mcp
```

Start Claude Code in your plugin project. Paths in tool arguments are resolved
against the directory the server starts in.

### Project `.mcp.json`

Commit this to your plugin repository so everyone working on it gets the
server:

```json
{
  "mcpServers": {
    "noodlr": { "command": "npx", "args": ["-y", "@noodlr/mcp"] }
  }
}
```

### Other MCP clients

Any client that supports stdio servers works. Use `npx` as the command and
`-y @noodlr/mcp` as the arguments.

### From source

```sh
git clone https://github.com/noodlrstudio/noodlr-plugins.git
cd noodlr-plugins
npm install
npm run build
```

Then point your client at the built server:

```sh
claude mcp add noodlr -- node /path/to/noodlr-plugins/packages/mcp/dist/bin.js
```

## What the server provides

### Resources

Reference material the agent reads before writing code.

| URI                                      | Contents                                                    |
| ---------------------------------------- | ----------------------------------------------------------- |
| `noodlr://docs/overview`                 | The three plugin routes, when to use each, and the workflow |
| `noodlr://docs/design-rules`             | Theming, capability, state and lifecycle rules              |
| `noodlr://docs/capabilities`             | Every capability and the context API behind it              |
| `noodlr://docs/web-app-bridge`           | The web app bridge and the limits the host enforces         |
| `noodlr://docs/submitting`               | What a review pull request needs                            |
| `noodlr://ui/components`                 | `@noodlr/ui` Play node controls and their props             |
| `noodlr://theme/tokens`                  | The `--noodlr-*` tokens and their Light and Dark values     |
| `noodlr://schemas/play-node/manifest`    | Play node manifest JSON Schema                              |
| `noodlr://schemas/play-node/definition`  | Play node manifest, state and ports JSON Schema             |
| `noodlr://schemas/audio-plugin/manifest` | WAM 2, Cmajor and WCLAP plugin manifest JSON Schema         |

The component list is generated from the UI kit, and the schemas and tokens
come from `@noodlr/play-api`, so they always match the packages you install.

### Tools

| Tool                             | What it does                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `scaffold_plugin`                | Creates a Play node or web app bridge project                                       |
| `validate_play_node`             | Validates a manifest, state fields and ports, including that the defaults are valid |
| `validate_web_app_manifest`      | Checks a web app bridge manifest the way the host does                              |
| `validate_audio_plugin_manifest` | Validates a curated audio plugin manifest, including checksums and ports            |
| `check_capabilities`             | Compares the capabilities you declare with the context APIs your code uses          |
| `lint_theme`                     | Finds colour literals that should be `--noodlr-*` tokens                            |

`check_capabilities` reads your source rather than running it. When it says a
capability is **missing**, the host will refuse that call, so fix it. When it
says one is **unused**, the code may still reach it in a way the check cannot
see; look before removing it.

### Prompts

Ready-made instructions you can start a task from.

| Prompt               | Arguments    | What it asks the agent to do                     |
| -------------------- | ------------ | ------------------------------------------------ |
| `create-play-node`   | `idea`, `id` | Build a Play node from an idea, end to end       |
| `connect-web-app`    | `id`         | Add the web app bridge to an existing web app    |
| `prepare-for-review` | `directory`  | Run every check and list what review still needs |

## Walkthrough: build a compressor

This is a real session, recorded while building
[`examples/compressor-play-node`](../examples/compressor-play-node). Each step
shows the MCP call the agent made and what the server returned. To follow
along, ask your agent for the same thing:

> Build a stereo compressor Play node with threshold, ratio, attack, release,
> knee and makeup gain, and a gain-reduction meter. Use the noodlr MCP server.

### 1. Get a plan

The agent starts from the `create-play-node` prompt:

```text
prompt create-play-node
  idea: a stereo audio compressor with threshold, ratio, attack, release,
        knee and makeup gain, and a gain-reduction meter
  id:   com.example.compressor
```

```text
1. Read noodlr://docs/overview, noodlr://docs/design-rules,
   noodlr://docs/capabilities and noodlr://ui/components.
2. Call scaffold_plugin with route "play-node" and id "com.example.compressor".
3. Implement the node. Use @noodlr/ui controls and --noodlr-* tokens only.
   Declare exactly the capabilities you use.
4. Add tests with createMockPlayNodeContext.
5. Run validate_play_node, check_capabilities and lint_theme, then the
   project's tests, and fix everything they report.
6. Run `npm run build:local` in the project to build it for the Noodlr Mac
   app. It writes dist-local/com.example.compressor/. Then tell the developer
   how to try it: (the steps in "Run it in the Mac app" below)
```

### 2. Read the reference

From `noodlr://docs/capabilities`, the agent learns which capabilities audio
needs:

| Capability                   | What it allows                              | API                                                          |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `collaboration.shared-state` | State fields with scope `shared-persisted`  | `context.state` with shared-persisted fields                 |
| `audio.input`                | Receive graph audio on declared audio ports | `context.audio.input(portId)`                                |
| `audio.output`               | Send audio to declared audio ports          | `context.audio.output(portId)`, `ensureReady()`, `context()` |

From `noodlr://ui/components` it finds `Knob`, `LevelMeter`, `Button` and
`NodeSurface`, with their props.

### 3. Scaffold

```text
tool scaffold_plugin
  route:       play-node
  id:          com.example.compressor
  name:        Compressor
  description: A stereo compressor with a gain-reduction meter.
  directory:   examples/compressor-play-node
```

```json
{
  "created": true,
  "files": [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "src/index.ts",
    "src/Compressor.svelte",
    "src/index.test.ts",
    "README.md"
  ],
  "next": ["npm install", "npm run validate"]
}
```

The scaffold is a working node: a knob, shared state, and the space tempo from
the transport. Its manifest declares `collaboration.shared-state` and
`transport.read`.

### 4. Write the node

The agent writes three files.

**`src/compressor-controller.ts`** builds the audio graph. Audio processing
belongs in `setup`, not in the view, so it keeps running when the view is not
mounted:

```ts
export function createCompressorController(
  context: PlayNodeContext<PlayJsonObject>,
  audio: CompressorAudio = {
    audioContext: context.audio.context(),
    input: context.audio.input("audio-in").node,
  },
): CompressorController {
  const { audioContext, input } = audio;
  const compressor = audioContext.createDynamicsCompressor();
  // ... makeup gain, plus wet and dry gains for bypass, into one sum node
  const disconnectOutput = context.audio.output("audio-out").connect(sum);

  const unsubscribe = context.state.subscribe((state) =>
    apply(settingsFromState(state)),
  );
  context.lifecycle.onDispose(() => {
    unsubscribe();
    disconnectOutput();
    // ... disconnect every node it created
  });

  return { reduction: () => compressor.reduction };
}
```

Parameter changes use `setTargetAtTime` so turning a knob does not click.
Bypass crossfades between the compressed and dry paths, so nothing is
reconnected while audio plays.

**`src/index.ts`** declares the audio ports, seven shared state fields, and
`setup`:

```ts
ports: [
  { id: "audio-in", type: "audio", label: "In", direction: "in" },
  { id: "audio-out", type: "audio", label: "Out", direction: "out" },
],
setup: (context) => createCompressorController(context),
view: Compressor,
```

**`src/Compressor.svelte`** draws six `Knob`s, a `LevelMeter` for gain
reduction and a bypass `Button`, using `controller.reduction()` for the meter.
Knobs call `context.state.preview` while dragging and `context.state.commit`
on release, so undo records one step per gesture.

At this point the agent has not touched the manifest's `capabilities`. It
still has the scaffold's values.

### 5. Validate the definition

```text
tool validate_play_node
  manifest: { id: "com.example.compressor", ..., icon: "Activity" }
  state:    { version: 1, fields: { threshold, ratio, attack, release,
                                    knee, makeup, bypass } }
  ports:    [ audio-in, audio-out ]
```

```json
{ "valid": true }
```

This checks the manifest, every state field, and that each default is inside
its field's range.

### 6. Check capabilities

```text
tool check_capabilities
  directory: examples/compressor-play-node
```

```json
{
  "ok": false,
  "declared": ["collaboration.shared-state", "transport.read"],
  "used": ["audio.input", "audio.output", "collaboration.shared-state"],
  "missing": ["audio.input", "audio.output"],
  "unused": ["transport.read"],
  "unknown": [],
  "usages": [
    {
      "capability": "audio.output",
      "file": "src/compressor-controller.ts",
      "line": 81
    },
    {
      "capability": "audio.input",
      "file": "src/compressor-controller.ts",
      "line": 82
    },
    {
      "capability": "audio.output",
      "file": "src/compressor-controller.ts",
      "line": 99
    },
    {
      "capability": "collaboration.shared-state",
      "file": "src/index.ts",
      "line": 5
    }
  ],
  "manifestFile": "src/index.ts"
}
```

(The `evidence` field on each usage is left out here.)

This is the mistake the check exists for. In Noodlr the node would have loaded,
and then `context.audio.input` would have been refused. The agent sets:

```ts
capabilities: ["audio.input", "audio.output", "collaboration.shared-state"],
```

and checks again:

```json
{
  "ok": true,
  "declared": ["audio.input", "audio.output", "collaboration.shared-state"],
  "used": ["audio.input", "audio.output", "collaboration.shared-state"],
  "missing": [],
  "unused": []
}
```

### 7. Check theming

```text
tool lint_theme
  directory: examples/compressor-play-node
```

```json
{ "ok": true, "findings": [], "filesScanned": 4 }
```

The view styles its own text with `var(--noodlr-text-secondary)` and uses
`@noodlr/ui` controls for everything else, so it works in Light and Dark.

### 8. Test

The mock context from `@noodlr/play-api` has no audio: `context.audio.context()`
and `context.audio.input()` throw. That is why the controller takes its audio
objects as an optional argument. The test passes a small fake `AudioContext`
that records what is created and connected, and checks that state changes
reach the graph:

```ts
const mock = createMockPlayNodeContext(defaults, [
  "audio.input",
  "audio.output",
  "collaboration.shared-state",
]);
const audio = fakeAudio();
createCompressorController(mock.context, audio);

mock.context.state.set("threshold", -40);
mock.context.state.set("bypass", true);

expect(audio.created.compressor.threshold.value).toBe(-40);
// bypass: wet off, dry on
expect(audio.created.gains[1].gain.value).toBe(0);
expect(audio.created.gains[2].gain.value).toBe(1);
```

```text
$ npm run validate
svelte-check: 364 FILES 0 ERRORS 0 WARNINGS
Test Files  1 passed (1)
     Tests  6 passed (6)
```

### 9. Run it in the Mac app

Every Play node scaffold includes a build for the Noodlr Mac app's local
plugins folder:

```text
$ npm run build:local
dist-local/com.example.compressor/index.js  241.55 kB │ gzip: 62.78 kB
```

`dist-local/com.example.compressor/` holds one JavaScript file (with its own
Svelte runtime and styles) and a `noodlr-plugin.json` descriptor. To run it:

1. Choose **Developer › Show Plugins Folder** and copy
   `dist-local/com.example.compressor` into it. That folder is
   `~/Library/Containers/com.5of12.noodlr/Data/Library/Application Support/Noodlr/Plugins`,
   or `~/Library/Application Support/Noodlr/Plugins` for a development build.
2. Turn on **Developer › Load Local Plugins**.
3. Choose **Developer › Open Node Lab**. The node is put on the stage and
   listed under **Local plugins**. If it can't load, the reason is shown there.

Local plugins are unreviewed and run with the board's access, so they only
load in Node Lab. Rebuild and reopen Node Lab after each change.

The bundle's default export is `{ definition, mount }`: the definition without
its view, and a function that mounts the view into an element the host
provides. `src/local-plugin.ts` in the scaffold does this for you.

### 10. Prepare for review

The `prepare-for-review` prompt runs every check again and lists what a review
pull request still needs, such as a licence file. See
[Submitting a plugin for review](../README.md#submitting-a-plugin-for-review).

## Debugging the server

**From the command line.** `packages/mcp/scripts/call.mjs` calls the built
server the same way an MCP client does. Every output in the walkthrough above
came from it:

```sh
node packages/mcp/scripts/call.mjs tools
node packages/mcp/scripts/call.mjs read noodlr://docs/capabilities
node packages/mcp/scripts/call.mjs prompt create-play-node '{"idea":"a compressor"}'
node packages/mcp/scripts/call.mjs check_capabilities '{"directory":"examples/compressor-play-node"}'
```

It exits with status 1 when a tool reports an error, so you can use it in
scripts.

**In a browser.** The [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
lists everything the server offers and lets you call it by hand:

```sh
npx @modelcontextprotocol/inspector node packages/mcp/dist/bin.js
```
