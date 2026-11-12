# @noodlrstudio/ui

Svelte 5 controls for Noodlr Board Play nodes. They follow the host's Light
and Dark themes on their own, so a node that uses them looks right in both.

```sh
npm install @noodlrstudio/ui @noodlrstudio/play-api svelte
```

```svelte
<script lang="ts">
  import { Knob, NodeSurface } from "@noodlrstudio/ui/play-node";
</script>

<NodeSurface label="My node">
  <Knob label="Level" value={96} onCommit={(value) => save(value)} />
</NodeSurface>
```

## Controls

`NodeSurface`, `Button`, `Pad`, `Knob`, `LevelMeter`, `WaveformPreview`,
`WaveformRegionEditor`, `PianoKeyboard`, `MidiDeviceChecklist`,
`MidiDeviceSelect`, `EditPicker` and `AudioInputPicker`. `Knob`, `Pad` and
`Button` take a `midiControl` binding for MIDI learn.

## Theme tokens

Style your own elements with the `--noodlr-*` custom properties, never colour
literals. The host provides them; for previews and tests, import the defaults:

```ts
import "@noodlrstudio/ui/theme.css";
```

`svelte` is a peer dependency: a node and the host share one Svelte runtime.

See [noodlr-plugins](https://github.com/noodlrstudio/noodlr-plugins) for the
Play API, starters and the review process. MIT licence.
