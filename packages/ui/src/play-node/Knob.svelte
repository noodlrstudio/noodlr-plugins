<script lang="ts">
  import type { PlayMidiControlBinding } from "@noodlrstudio/play-api";
  import { bindMidiControl } from "./midi-control";

  export let label: string;
  export let value: number;
  export let minimum = 0;
  export let maximum = 127;
  export let min: number | null = null;
  export let max: number | null = null;
  export let step = 1;
  export let unit = "";
  export let size: number | null = null;
  export let disabled = false;
  export let midiControl: PlayMidiControlBinding | null = null;
  /** Display text for the value (e.g. a plugin's "80ms"); overrides value + unit. */
  export let valueText: string | null = null;
  export let onPreview: (value: number) => void = () => {};
  export let onCommit: (value: number) => void = () => {};
  export let onChange: (value: number) => void = () => {};

  let pointerId: number | null = null;
  let startY = 0;
  let startValue = 0;
  let previewValue = value;

  $: if (pointerId === null) previewValue = value;
  $: resolvedMinimum = min ?? minimum;
  $: resolvedMaximum = max ?? maximum;
  $: ratio =
    resolvedMaximum === resolvedMinimum
      ? 0
      : (previewValue - resolvedMinimum) / (resolvedMaximum - resolvedMinimum);
  $: rotation = Math.max(0, Math.min(1, ratio)) * 270 - 135;
  $: sizeStyle = size ? `--knob-size:${size}px` : "";

  function normalize(next: number) {
    const clamped = Math.max(resolvedMinimum, Math.min(resolvedMaximum, next));
    const stepped =
      Math.round((clamped - resolvedMinimum) / step) * step + resolvedMinimum;
    return Number(stepped.toFixed(6));
  }

  function preview(next: number) {
    onPreview(next);
    onChange(next);
  }

  function handlePointerDown(event: PointerEvent) {
    if (disabled) return;
    pointerId = event.pointerId;
    startY = event.clientY;
    startValue = value;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    const range = resolvedMaximum - resolvedMinimum;
    previewValue = normalize(
      startValue + (startY - event.clientY) * range * 0.005,
    );
    preview(previewValue);
  }

  function finishPointer(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    onCommit(previewValue);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    const delta =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? step
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? -step
          : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? resolvedMinimum
        : event.key === "End"
          ? resolvedMaximum
          : normalize(value + delta);
    preview(next);
    onCommit(next);
  }
</script>

<label style={sizeStyle}>
  <span class="knob-label">{label}</span>
  <button title={label}
    type="button"
    role="slider"
    aria-label={label}
    aria-valuemin={resolvedMinimum}
    aria-valuemax={resolvedMaximum}
    aria-valuenow={previewValue}
    aria-valuetext={valueText ?? `${previewValue}${unit}`}
    {disabled}
    use:bindMidiControl={midiControl}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={finishPointer}
    on:pointercancel={finishPointer}
    on:keydown={handleKeyDown}
  >
    <span class="knob-base"></span>
    <span class="knob-face" style={`transform:rotate(${rotation}deg)`}>
      <span class="knob-indicator"></span>
    </span>
  </button>
  <output>{valueText ?? `${previewValue}${unit}`}</output>
</label>

<style>
  label {
    --knob-size: clamp(2.8rem, 18cqi, 4rem);
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.32rem;
    user-select: none;
  }

  .knob-label {
    color: var(--noodlr-text-tertiary);
    font-size: 0.56rem;
    font-weight: 720;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  button {
    position: relative;
    width: var(--knob-size);
    height: var(--knob-size);
    padding: 0;
    border: 0;
    background: transparent;
    touch-action: none;
    cursor: ns-resize;
  }

  button:focus-visible {
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: 4px;
    border-radius: 999px;
  }

  .knob-base,
  .knob-face {
    position: absolute;
    inset: 0;
    border-radius: 999px;
  }

  .knob-base {
    border: 1px solid
      color-mix(in srgb, var(--noodlr-border-strong) 50%, var(--noodlr-surface-3));
    background: var(--noodlr-surface-3);
    box-shadow: inset 0 1px 2px var(--noodlr-border);
  }

  .knob-face {
    inset: 4px;
    border: 1px solid var(--noodlr-surface-2);
    background: linear-gradient(
      180deg,
      var(--noodlr-surface-1),
      var(--noodlr-surface-inset)
    );
    box-shadow: var(--noodlr-shadow-control);
  }

  .knob-indicator {
    position: absolute;
    top: 5px;
    left: 50%;
    width: 3px;
    height: 10px;
    margin-left: -1.5px;
    border-radius: 999px;
    background: var(--play-accent);
  }

  output {
    color: var(--noodlr-text-secondary);
    font-family: var(--noodlr-font-mono);
    font-size: 0.58rem;
  }

  button:disabled {
    cursor: default;
    opacity: 0.45;
  }
</style>
