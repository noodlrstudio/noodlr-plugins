# @noodlrstudio/play-api

The contract for [Noodlr Board](https://noodlr.xyz) Play nodes: the manifest,
capabilities, state field definitions, host context types, validation, and a
mock context for tests.

> **Early preview.** The Play API is at version `0`. Minor releases may contain
> breaking changes until 1.0.

## Install

```sh
npm install @noodlrstudio/play-api
```

`svelte` 5 is a peer dependency. It is used for types only (a node's `view` is
a Svelte component); this package ships no Svelte runtime code.

## Define a node

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

`definePlayNode` validates the definition and throws a
`PlayNodeValidationError` if the manifest or state fields are invalid. A node
declares the capabilities it uses; the host only provides the APIs a node has
declared.

## Test a node

`createMockPlayNodeContext` builds an in-memory host context, so a node's
logic can be tested without Noodlr Board. Import it from the `./testing`
entry point to keep it out of production bundles:

```ts
import { createPlayNodeSharedDefaults } from "@noodlrstudio/play-api";
import { createMockPlayNodeContext } from "@noodlrstudio/play-api/testing";
import { starterNode } from "./index";

const mock = createMockPlayNodeContext(
  createPlayNodeSharedDefaults(starterNode.state.fields),
  ["transport.read"],
);

mock.setClock({ playing: true, bpm: 96 });
mock.context.transport.snapshot().bpm; // 96
```

The mock is also re-exported from the package root, so existing imports keep
working, but prefer `@noodlrstudio/play-api/testing` in new code.

## What is in the package

| Area               | Exports                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Definition         | `definePlayNode`, `PLAY_API_VERSION`, manifest, port and state field types                                                    |
| Validation         | `validatePlayNodeManifest`, `validatePlayNodeDefinition`, `validatePlayNodeState`, `PlayNodeValidationError`, the Zod schemas |
| State              | `createPlayNodeDefaults`, `createPlayNodeSharedDefaults`, `migratePlayNodeState`                                              |
| Host context types | `PlayNodeContext`, `PlayNodeViewProps` and the transport, clock, MIDI, mixer, asset and appearance API types                  |
| Appearance         | Theme tokens and helpers for drawing on a `<canvas>`                                                                          |
| Testing            | `createMockPlayNodeContext` (`@noodlrstudio/play-api/testing`)                                                                |

JSON Schemas for manifests and definitions are in `schemas/play-api/v0` in the
noodlr-plugins repository.

## Module format

ES modules only, with TypeScript declarations. Works with bundlers and with
Node.js 24.

## Licence

MIT
