# noodlr-plugins

Everything you need to build plugins for [Noodlr Board](https://noodlr.xyz), the
music-native workspace for capturing ideas, planning projects and building
playable signal-flow boards.

This repository is the public developer surface of Noodlr Board: the plugin
contracts, the UI kit, starter projects and documentation. The Noodlr Board
application itself is developed separately and is not open source.

> **Status: early preview.** The Play API is at version `0` and will have
> breaking changes before 1.0. Packages are being moved here from the main
> Noodlr codebase and are not all on npm yet. See [Roadmap](#roadmap).

## Ways to build a plugin

| Route              | What you write                                                 | What you get                                                                                  | Review needed |
| ------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------- |
| **Web app bridge** | Any web app you host, plus `@noodlr/plugin-sdk`                | MIDI in and out, runtime state, and state saved with the board, inside an iframe node         | No            |
| **Play node**      | A Svelte 5 component and a `definePlayNode` definition         | The full host API: audio and MIDI ports, transport, shared collaborative state, assets, mixer | Yes           |
| **Audio plugin**   | A WAM 2, Cmajor or WCLAP (CLAP compiled to WebAssembly) bundle | Real graph audio and MIDI inside Noodlr's AudioContext                                        | Yes           |

Not sure which to pick? Start with the web app bridge. It needs no review and
works with a site you already have. Move to a Play node when you need audio
ports, transport sync or shared state.

Building with a coding agent? Connect it to [`@noodlr/mcp`](packages/mcp) and
read [Building plugins with a coding agent](docs/mcp.md).

## Packages

| Package                                     | Purpose                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [`@noodlr/play-api`](packages/play-api)     | The Play node contract: manifest, capabilities, state fields, host context types, validation and a mock context for tests              |
| [`@noodlr/ui`](packages/ui)                 | Svelte controls that match the host (`NodeSurface`, `Knob`, `Pad`, `PianoKeyboard`, meters, pickers) and the `--noodlr-*` theme tokens |
| [`@noodlr/plugin-sdk`](packages/plugin-sdk) | Framework-neutral bridge for independently hosted web apps                                                                             |
| [`@noodlr/mcp`](packages/mcp)               | An MCP server that gives coding agents the contracts, schemas, UI kit and review checks                                                |

JSON Schemas for Play node manifests and definitions are in
[`schemas/play-api/v0`](schemas/play-api/v0).

## Starters

| Starter                                                            | Use it for                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| [`examples/play-node-starter`](examples/play-node-starter)         | A Play node with shared state, theming and transport |
| [`examples/compressor-play-node`](examples/compressor-play-node)   | An audio effect Play node built with `@noodlr/mcp`   |
| [`examples/web-app-plugin-bridge`](examples/web-app-plugin-bridge) | Connecting a hosted web app over the bridge          |
| [`examples/wam-plugin-starter`](examples/wam-plugin-starter)       | A minimal WAM 2 gain effect                          |
| [`examples/cmajor-plugin-starter`](examples/cmajor-plugin-starter) | A Cmajor patch exported for Web Audio                |
| [`wclap-plugins/`](wclap-plugins)                                  | Reference CLAP plugins in Rust, built to WebAssembly |

## Quick look: a Play node

```ts
import { definePlayNode } from "@noodlr/play-api";
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

```ts
import { createNoodlrWebAppBridge } from "@noodlr/plugin-sdk/web-app";

const bridge = createNoodlrWebAppBridge({
  manifest: {
    id: "com.example.my-app",
    name: "My App",
    version: "1.0.0",
    ports: [
      { id: "midi-in", label: "MIDI In", type: "midi", direction: "in" },
      { id: "midi-out", label: "MIDI Out", type: "midi", direction: "out" },
    ],
    features: { runtimeControl: true, state: true },
  },
  onMidiMessage: ({ data }) => handleMidi(data),
  onRestoreState: (state) => restore(state),
});
```

The bridge carries MIDI and JSON state. It does not carry audio across the
iframe boundary; use an audio plugin format for that.

## Design rules for Play nodes

- Use controls from `@noodlr/ui/play-node`. They follow the host's Light and
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

## Submitting a plugin for review

Play nodes and audio plugins run inside the Noodlr page, so they are reviewed
before they ship to cloud and Live Collaboration Spaces. Open a pull request
that includes the source, the manifest, a licence that permits redistribution,
and tests. Audio bundles also need versioned build output with SHA-256
checksums. Full details will be in `docs/submitting.md`.

## Roadmap

- [ ] **Phase 1:** contract packages, schemas, starters and docs published here
      and on npm
- [ ] **Phase 2:** shared node helpers and first-party reference nodes
- [ ] **Phase 3:** Node Lab as a standalone local host for developing and
      previewing nodes
- [ ] **Phase 4:** loading unreviewed nodes in local, non-collaborative Spaces

## Versioning

Packages follow semver. While the Play API is at version `0`, minor releases
may contain breaking changes; each one is recorded in `CHANGELOG.md`.

## Licence

MIT. See [LICENSE](LICENSE). The reference plugins in `wclap-plugins/` are
MIT OR Apache-2.0 and carry their own licence files.
