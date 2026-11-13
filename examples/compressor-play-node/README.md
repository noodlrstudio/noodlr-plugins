# Compressor

A stereo compressor Play node: audio in, audio out, six knobs, a bypass button
and a gain-reduction meter. All settings are shared, so everyone in a Live
Collaboration Space hears the same compressor.

It was built with a coding agent through [`@noodlrstudio/mcp`](../../packages/mcp).
The walkthrough in [docs/mcp.md](../../docs/mcp.md) shows each step.

| File                           | What it does                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `src/index.ts`                 | The `definePlayNode` definition: manifest, state fields, audio ports and `setup`             |
| `src/compressor-controller.ts` | Builds the Web Audio graph (`DynamicsCompressorNode`, makeup gain, bypass) and follows state |
| `src/Compressor.svelte`        | The view, using `@noodlrstudio/ui` controls and `--noodlr-*` tokens only                     |
| `src/index.test.ts`            | Tests, with a fake `AudioContext` injected into the controller                               |

```sh
npm install
npm run dev          # preview in a browser; "Play test tone" drives the meter
npm run validate     # type-check and test
npm run build:local  # bundle for the noodlr Mac app's local plugins folder
```

Play nodes are reviewed before they ship. See
[Submitting a plugin for review](../../README.md#submitting-a-plugin-for-review).
