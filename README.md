# noodlr-plugins

Everything you need to build plugins for [Noodlr Board](https://noodlr.xyz), the
music-native workspace for capturing ideas, planning projects and building
playable signal-flow boards.

This repository is the public developer surface of Noodlr Board: the plugin
contracts, the UI kit, starter projects and documentation. The Noodlr Board
application itself is developed separately and is not open source.

> **Status: early preview.** The packages are on npm as `@noodlrstudio/*`.
> The Play API is at version `0` and will have breaking changes before 1.0.
> See [Roadmap](#roadmap).

## Quick start

With a coding agent (Claude Code shown; any MCP client works):

```sh
claude mcp add noodlr -- npx -y @noodlrstudio/mcp
```

Then ask it for a plugin, for example "Use the noodlr MCP to build a stereo
compressor Play node." See [Building plugins with a coding agent](docs/mcp.md).

By hand, start from [`examples/play-node-starter`](examples/play-node-starter):

```sh
npm install @noodlrstudio/play-api @noodlrstudio/ui svelte
npm run dev      # preview the node in a browser, with a mock host
npm run validate # type-check and test it
```

To play it inside noodlr, `npm run build:local` and load it in the noodlr Mac
app's Node Lab or a local Room. That needs [developer access](#developer-access).

## Ways to build a plugin

| Route            | What you write                                                                                          | What you get                                                                                  | Review needed |
| ---------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------- |
| **Web app**      | Any web app you host, plus [audiframe](https://github.com/noodlrstudio/audiframe) (`@audiframe/client`) | MIDI in and out, mute and suspend, and state saved with the board, inside a Web App node      | No            |
| **Play node**    | A Svelte 5 component and a `definePlayNode` definition                                                  | The full host API: audio and MIDI ports, transport, shared collaborative state, assets, mixer | Yes           |
| **Audio plugin** | A WAM 2, Cmajor or WCLAP (CLAP compiled to WebAssembly) bundle                                          | Real graph audio and MIDI inside Noodlr's AudioContext                                        | Yes           |

Not sure which to pick? Start with a web app. It needs no review and works
with a site you already have. Move to a Play node when you need audio
ports, transport sync or shared state.

Building with a coding agent? Connect it to [`@noodlrstudio/mcp`](packages/mcp) and
read [Building plugins with a coding agent](docs/mcp.md).

## Packages

| Package                                           | Purpose                                                                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`@noodlrstudio/play-api`](packages/play-api)     | The Play node contract: manifest, capabilities, state fields, host context types, validation and a mock context for tests              |
| [`@noodlrstudio/ui`](packages/ui)                 | Svelte controls that match the host (`NodeSurface`, `Knob`, `Pad`, `PianoKeyboard`, meters, pickers) and the `--noodlr-*` theme tokens |
| [`@noodlrstudio/plugin-sdk`](packages/plugin-sdk) | The earlier Noodlr web app bridge. Existing apps keep working; new web apps use [audiframe](https://github.com/noodlrstudio/audiframe) |
| [`@noodlrstudio/mcp`](packages/mcp)               | An MCP server that gives coding agents the contracts, schemas, UI kit and review checks                                                |

JSON Schemas for Play node manifests and definitions are in
[`schemas/play-api/v0`](schemas/play-api/v0).

## Starters

| Starter                                                            | Use it for                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| [`examples/play-node-starter`](examples/play-node-starter)         | A Play node with shared state, theming and transport     |
| [`examples/compressor-play-node`](examples/compressor-play-node)   | An audio effect Play node built with `@noodlrstudio/mcp` |
| [`examples/web-app-plugin-bridge`](examples/web-app-plugin-bridge) | The earlier Noodlr bridge (new apps: audiframe, below)   |
| [`examples/wam-plugin-starter`](examples/wam-plugin-starter)       | A minimal WAM 2 gain effect                              |
| [`examples/cmajor-plugin-starter`](examples/cmajor-plugin-starter) | A Cmajor patch exported for Web Audio                    |
| [`wclap-plugins/`](wclap-plugins)                                  | Reference CLAP plugins in Rust, built to WebAssembly     |

## Quick look: a Play node

```ts
import { definePlayNode } from "@noodlrstudio/play-api";
import StarterNode from "./StarterNode.svelte";

export const starterNode = definePlayNode({
  manifest: {
    id: "com.example.starter-node",
    name: "Starter Node",
    version: "0.1.0",
    apiVersion: "0",
    icon: "Activity",
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
  view: StarterNode,
});
```

A node declares the capabilities it uses. The host only provides the APIs a
node has declared, and reviewers check the declaration against the code.

## Quick look: a web app

Web App nodes speak [audiframe](https://github.com/noodlrstudio/audiframe), an
open protocol for embedded web music apps. Your app keeps its own UI and audio;
the board plays it from its MIDI cables, takes its notes out, mutes or suspends
it, and saves its state with the space.

```ts
// npm install --save-exact @audiframe/client@0.1.0-alpha.3
import { createClient } from "@audiframe/client";

const client = createClient({
  manifest: {
    id: "com.example.my-app",
    name: "My App",
    appVersion: "1.0.0",
    protocolVersions: [{ major: 1, minor: 0 }],
    capabilities: ["lifecycle", "midi.input", "midi.output"].map((id) => ({
      id,
      version: 1,
    })),
    ports: [
      { id: "midi-in", label: "MIDI In", direction: "in", type: "midi1" },
      { id: "midi-out", label: "MIDI Out", direction: "out", type: "midi1" },
    ],
  },
  midi: (events) => events.forEach(({ data }) => handleMidi(data)),
  lifecycle: ({ enabled, audible }) => {
    setMuted(!enabled || !audible);
    return "running";
  },
});

client.connect(); // on load
```

Share the app's address with `?audiframe=1` on the end; Noodlr only offers
audiframe to URLs with that flag. Audio does not cross the frame: for audio in
Noodlr's graph, write a Play node or an audio plugin. The MCP server's
`scaffold_plugin` (route `web-app`) creates a starter.

## Design rules for Play nodes

- Use controls from `@noodlrstudio/ui/play-node`. They follow the host's Light and
  Dark themes automatically.
- Style your own elements with `--noodlr-*` tokens. Do not write colour
  literals; they will be wrong in one of the two themes.
- Read `context.appearance` only when drawing on a `<canvas>`.
- Declare every capability you use, and nothing you don't.

## Developing in this repository

Requirements: Node.js 24 and npm 11.

```sh
npm install
npm run build
npm test
```

## Developer access

To play your own Play nodes inside noodlr before review (in the Mac app's Node
Lab and in local Rooms), your noodlr account needs developer access.
[Request it with an issue](https://github.com/noodlrstudio/noodlr-plugins/issues/new?template=developer-access.yml);
don't post your email there, we'll ask for it privately. Web apps need no
access: any Web App node can open them.

## Submitting a plugin for review

Play nodes and audio plugins run inside the Noodlr page, so they are reviewed
before they ship to cloud and Live Collaboration Spaces. The review process for
third-party plugins is still being set up. If you have one you'd like to ship,
open an issue so we can talk. Expect to provide the source, the manifest, a
licence that permits redistribution, and tests; audio bundles also need
versioned build output with SHA-256 checksums.

## Roadmap

- [x] **Phase 1:** contract packages, schemas, starters and docs published here
      and on npm, plus an MCP server for coding agents
- [ ] **Phase 2:** shared node helpers and first-party reference nodes
- [ ] **Phase 3:** Node Lab for developing and previewing nodes. Started: a
      browser preview in every starter, and Node Lab in the noodlr Mac app
- [ ] **Phase 4:** loading unreviewed nodes in local, non-collaborative Spaces.
      Started: local Rooms in the noodlr Mac app, for developer access; audio
      plugins (WAM, Cmajor, WCLAP) don't load locally yet

## Versioning

Packages follow semver. While the Play API is at version `0`, minor releases
may contain breaking changes; each one is recorded in `CHANGELOG.md`.

## Licence

MIT. See [LICENSE](LICENSE). The reference plugins in `wclap-plugins/` are
MIT OR Apache-2.0 and carry their own licence files.
