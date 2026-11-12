import {
  MAX_PLAY_NODE_SHARED_STATE_BYTES,
  PLAY_APPEARANCE_TOKENS,
  PLAY_NODE_CAPABILITIES,
  PLAY_NODE_ICON_TOKENS,
  type PlayNodeCapability,
} from "@noodlrstudio/play-api";
import { UI_COMPONENTS } from "./generated/ui-catalogue.js";

export const REPOSITORY_URL = "https://github.com/noodlrstudio/noodlr-plugins";

export interface CapabilityDoc {
  summary: string;
  api: string;
}

/** What each capability unlocks on the Play node context. */
export const CAPABILITY_DOCS: Record<PlayNodeCapability, CapabilityDoc> = {
  "midi.input": {
    summary: "Receive MIDI from graph ports the node declares.",
    api: "context.midi.input(portId)",
  },
  "midi.output": {
    summary: "Send MIDI to graph ports the node declares.",
    api: "context.midi.output(portId)",
  },
  "midi.control-mapping": {
    summary: "MIDI-learn bindings for on-screen controls.",
    api: "context.midi.control(definition), context.midi.trigger(definition)",
  },
  "midi.device-input": {
    summary: "Read from hardware MIDI devices directly.",
    api: "context.midi.devices.requestAccess(), .input(deviceId)",
  },
  "midi.device-output": {
    summary: "Write to hardware MIDI devices directly.",
    api: "context.midi.devices.requestAccess(), .output(deviceId)",
  },
  "collaboration.shared-state": {
    summary:
      "State fields with scope 'shared-persisted', synced to everyone in a Live Collaboration Space.",
    api: "context.state with shared-persisted fields",
  },
  "transport.read": {
    summary: "Read and follow the space transport (tempo, beat, play state).",
    api: "context.transport.snapshot(), .subscribe(), .now(), .beatAt(), .timeOfBeat()",
  },
  "transport.schedule": {
    summary: "Schedule callbacks against the transport.",
    api: "context.transport.schedule(callback, options)",
  },
  "audio.input": {
    summary: "Receive graph audio on declared audio ports.",
    api: "context.audio.input(portId)",
  },
  "audio.output": {
    summary: "Send audio to declared audio ports.",
    api: "context.audio.output(portId), context.audio.ensureReady(), context.audio.context()",
  },
  "audio.decode": {
    summary: "Decode audio files into waveform previews.",
    api: "context.audio.decodeWaveform(blob)",
  },
  "mixer.read": {
    summary: "Read master levels and analyse the output.",
    api: "context.mixer.snapshot(), .subscribe(), .outputAnalyser()",
  },
  "mixer.write": {
    summary: "Change the master volume.",
    api: "context.mixer.setMasterVolumeDb(value)",
  },
  "song.read": {
    summary: "Read the space's active song, parts and chords.",
    api: "context.song.snapshot(), .subscribe(), .chordAt(), .position()",
  },
  "song.perform": {
    summary: "Start, queue and stop song playback.",
    api: "context.song.play(), .queue(), .stop()",
  },
  "song.write": {
    summary: "Edit the active song.",
    api: "context.song.write",
  },
  "clock.follow": {
    summary: "Follow the space's shared bar clock.",
    api: "context.clock",
  },
  "network.fetch": {
    summary: "Make network requests through the host.",
    api: "context.network.fetch(input, init)",
  },
  "microphone.input": {
    summary: "Open the user's microphone or audio interface.",
    api: "context.microphone.devices(), .request(options)",
  },
  "file.import": {
    summary: "Ask the user to pick files.",
    api: "context.files.pick(options)",
  },
  "file.export": {
    summary: "Save a file to the user's computer.",
    api: "context.files.save(blob, { suggestedName })",
  },
  "asset.read": {
    summary: "Load stored assets referenced from state.",
    api: "context.assets.load(), .prepare(), .status(), .subscribe()",
  },
  "asset.write": {
    summary: "Store and remove assets.",
    api: "context.assets.store(blob, options), .remove(reference)",
  },
};

const COMPONENT_PURPOSE: Record<string, string> = {
  NodeSurface:
    "The root container for every Play node view. Wrap your UI in it.",
  Button: "A themed push or toggle button, MIDI-learnable.",
  Pad: "A performance pad with press and release, MIDI-learnable.",
  Knob: "A rotary control with preview and commit callbacks, MIDI-learnable.",
  LevelMeter: "A segmented level meter for values from 0 to 1.",
  WaveformPreview: "A waveform drawing with progress, selection and seek.",
  WaveformRegionEditor: "A waveform with a draggable loop region.",
  PianoKeyboard:
    "An on-screen keyboard that can dock to the host keyboard shelf.",
  MidiDeviceChecklist: "Pick several hardware MIDI devices.",
  MidiDeviceSelect: "Pick one hardware MIDI device.",
  EditPicker: "A modal panel for secondary settings.",
  AudioInputPicker:
    "Pick a microphone or interface and mono or stereo channels.",
};

export function overviewMarkdown() {
  return `# Building plugins for Noodlr Board

Noodlr Board is a music-native workspace with playable signal-flow boards.
Source, starters and docs: ${REPOSITORY_URL}

## Pick a route

| Route | You write | You get | Review |
| --- | --- | --- | --- |
| Web app bridge | Any hosted web app plus \`@noodlrstudio/plugin-sdk/web-app\` | MIDI in and out, runtime state, JSON state saved with the board, inside an iframe node | No |
| Play node | A Svelte 5 component plus a \`definePlayNode\` definition from \`@noodlrstudio/play-api\` | The full host API: audio and MIDI ports, transport, shared collaborative state, assets, mixer | Yes |
| Audio plugin | A WAM 2, Cmajor or WCLAP (CLAP built to WebAssembly) bundle | Real graph audio and MIDI inside Noodlr's AudioContext | Yes |

Start with the web app bridge if you already have a site. Move to a Play node
when you need audio ports, transport sync or shared state. The bridge carries
MIDI and JSON only; it never carries audio across the iframe.

## Workflow with this server

1. Read \`noodlr://docs/design-rules\` and \`noodlr://docs/capabilities\`.
2. Call \`scaffold_plugin\` to create a project.
3. Edit it. Use components from \`noodlr://ui/components\` and tokens from
   \`noodlr://theme/tokens\`.
4. Call \`validate_play_node\` (or the web app or audio plugin validator),
   \`check_capabilities\` and \`lint_theme\` until they pass.
5. Run the project's own tests (\`npm test\`). Use
   \`createMockPlayNodeContext\` from \`@noodlrstudio/play-api/testing\` in tests.
6. To try a Play node in the Noodlr Mac app, run \`npm run build:local\` and
   copy \`dist-local/<id>\` into the folder that **Developer › Show Plugins
   Folder** opens. It appears in **Developer › Open Node Lab** under
   **Local plugins**.
7. Read \`noodlr://docs/submitting\` before opening a pull request.

The Play API is at version \`0\`; minor releases may break things.
`;
}

export function designRulesMarkdown() {
  return `# Design rules for Play nodes

- Wrap the view in \`NodeSurface\` and use controls from \`@noodlrstudio/ui/play-node\`.
  They follow the host's Light and Dark themes on their own.
- Style your own elements with \`--noodlr-*\` tokens only. Never write colour
  literals (hex, rgb(), hsl(), oklch(), named colours); they will be wrong in
  one of the two themes. \`lint_theme\` checks this.
- Read \`context.appearance\` only when drawing on a \`<canvas>\`.
- Declare every capability you use and nothing you don't. The host only
  provides APIs a node declares, and reviewers check the declaration against
  the code. \`check_capabilities\` checks this.
- Respect \`readOnly\`: disable controls when it is true.
- Use \`context.state.preview\` while dragging and \`context.state.commit\` (or
  \`set\`) on release, with a \`historyLabel\`, so undo works.
- Unsubscribe in \`context.lifecycle.onDispose\`.
- Shared state is limited to ${MAX_PLAY_NODE_SHARED_STATE_BYTES / 1024} KB. Put
  large data in assets.
- Manifest ids are reverse-domain (\`com.example.my-node\`), versions are semver,
  \`apiVersion\` is \`"0"\`.
- Icons must be one of: ${PLAY_NODE_ICON_TOKENS.join(", ")}.
`;
}

export function capabilitiesMarkdown() {
  const rows = PLAY_NODE_CAPABILITIES.map(
    (capability) =>
      `| \`${capability}\` | ${CAPABILITY_DOCS[capability].summary} | \`${CAPABILITY_DOCS[capability].api}\` |`,
  );
  return `# Play node capabilities

Declare these in \`manifest.capabilities\` (at most 16). Use
\`context.hasCapability\` to branch and \`context.requireCapability\` to fail
early.

| Capability | What it allows | API |
| --- | --- | --- |
${rows.join("\n")}

A state field with \`scope: "shared-persisted"\` needs
\`collaboration.shared-state\`. \`context.audio.timeAt\`, \`msAt\` and
\`onSchedulerTick\` need no capability.
`;
}

export function uiComponentsMarkdown() {
  const sections = UI_COMPONENTS.map((component) => {
    const purpose = COMPONENT_PURPOSE[component.name] ?? "";
    const props = component.props.map((prop) => `- \`${prop}\``).join("\n");
    return `## ${component.name}\n\n${purpose}\n\n${props || "_No props._"}`;
  });
  return `# @noodlrstudio/ui Play node components

Import from \`@noodlrstudio/ui/play-node\`, for example
\`import { NodeSurface, Knob } from "@noodlrstudio/ui/play-node";\`

${sections.join("\n\n")}
`;
}

export function themeTokensMarkdown(css: string) {
  return `# Theme tokens

Use these as \`var(--noodlr-<name>)\`. Values differ between Light and Dark.

${PLAY_APPEARANCE_TOKENS.map((token) => `- \`--noodlr-${token}\``).join("\n")}

## Generated CSS

\`\`\`css
${css}
\`\`\`
`;
}

export function webAppBridgeMarkdown() {
  return `# Web app bridge

\`@noodlrstudio/plugin-sdk/web-app\` connects a web app you host to a Noodlr iframe
node. No review is needed.

\`\`\`ts
import { createNoodlrWebAppBridge } from "@noodlrstudio/plugin-sdk/web-app";

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
  onMidiMessage: ({ portId, data }) => handleMidi(portId, data),
  onRestoreState: (state) => restore(state),
});
\`\`\`

Rules the host enforces:

- \`id\` is reverse-domain, \`version\` is semver, \`name\` is at most 80 characters.
- At most 8 ports. Port ids are unique, \`type\` is \`"midi"\`, \`direction\` is
  \`"in"\` or \`"out"\`, labels are at most 64 characters.
- State is JSON and at most 32 KB.
- MIDI is MIDI 1.0 short messages only.
- No audio crosses the iframe. Use a Play node or an audio plugin for audio.
`;
}

export function submittingMarkdown() {
  return `# Submitting a plugin for review

Play nodes and audio plugins run inside the Noodlr page, so they are reviewed
before they ship to cloud and Live Collaboration Spaces. Web app bridge plugins
need no review.

Open a pull request on ${REPOSITORY_URL} that includes:

- The source and the manifest.
- A licence that permits redistribution.
- Tests. For Play nodes, use \`createMockPlayNodeContext\` from
  \`@noodlrstudio/play-api/testing\`.
- For audio bundles: versioned build output and SHA-256 checksums in the
  manifest (\`sha256-<base64>\`).

Before opening it, run \`validate_play_node\` or \`validate_audio_plugin_manifest\`,
\`check_capabilities\` and \`lint_theme\`, and make sure the project's tests pass.
`;
}
