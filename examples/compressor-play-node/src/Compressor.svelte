<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PlayJsonObject, PlayNodeViewProps } from "@noodlr/play-api";
  import { Button, Knob, LevelMeter, NodeSurface } from "@noodlr/ui/play-node";
  import {
    DEFAULT_SETTINGS,
    settingsFromState,
    type CompressorController,
  } from "./compressor-controller";

  export let context: PlayNodeViewProps<PlayJsonObject>["context"];
  export let controller: CompressorController;
  export let readOnly = false;

  let settings = DEFAULT_SETTINGS;
  /** Gain reduction in dB, shown as a positive number. */
  let reduction = 0;

  context.lifecycle.onDispose(
    context.state.subscribe((state) => (settings = settingsFromState(state))),
  );

  let frame = 0;
  function readMeter() {
    reduction = Math.max(0, -controller.reduction());
    frame = requestAnimationFrame(readMeter);
  }
  frame = requestAnimationFrame(readMeter);
  onDestroy(() => cancelAnimationFrame(frame));

  type Key = "threshold" | "ratio" | "attack" | "release" | "knee" | "makeup";
  const knobs: Array<{ key: Key; label: string; min: number; max: number; step: number; unit: string }> = [
    { key: "threshold", label: "Threshold", min: -60, max: 0, step: 1, unit: "dB" },
    { key: "ratio", label: "Ratio", min: 1, max: 20, step: 0.5, unit: ":1" },
    { key: "attack", label: "Attack", min: 0, max: 1000, step: 1, unit: "ms" },
    { key: "release", label: "Release", min: 10, max: 1000, step: 10, unit: "ms" },
    { key: "knee", label: "Knee", min: 0, max: 40, step: 1, unit: "dB" },
    { key: "makeup", label: "Makeup", min: 0, max: 24, step: 0.5, unit: "dB" },
  ];
</script>

<NodeSurface label="Compressor" description="A stereo compressor">
  <div class="layout">
    <div class="knobs">
      {#each knobs as knob (knob.key)}
        <Knob
          label={knob.label}
          value={settings[knob.key]}
          minimum={knob.min}
          maximum={knob.max}
          step={knob.step}
          unit={knob.unit}
          size={44}
          disabled={readOnly}
          onPreview={(value) => context.state.preview(knob.key, value)}
          onCommit={(value) =>
            context.state.commit(knob.key, value, {
              historyLabel: `Change ${knob.label}`,
            })}
        />
      {/each}
    </div>
    <div class="side">
      <LevelMeter label="Gain reduction" value={Math.min(1, reduction / 24)} segments={12} />
      <span class="reading">−{reduction.toFixed(1)} dB</span>
      <Button
        label="Bypass"
        active={settings.bypass}
        disabled={readOnly}
        onPress={() =>
          context.state.set("bypass", !settings.bypass, {
            historyLabel: "Toggle Compressor Bypass",
          })}
      >
        Bypass
      </Button>
    </div>
  </div>
</NodeSurface>

<style>
  .layout {
    display: flex;
    gap: 0.75rem;
    align-items: stretch;
  }

  .knobs {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 0.5rem 0.75rem;
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .reading {
    color: var(--noodlr-text-secondary);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }
</style>
