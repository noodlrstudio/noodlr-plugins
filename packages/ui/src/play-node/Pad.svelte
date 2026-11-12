<script lang="ts">
  import type { PlayMidiControlBinding } from "@noodlr/play-api";
  import { bindMidiControl } from "./midi-control.js";

  export let label: string;
  export let detail = "";
  export let active = false;
  export let disabled = false;
  export let midiControl: PlayMidiControlBinding | null = null;
  export let onPress: () => void = () => {};
  export let onRelease: () => void = () => {};

  let pressed = false;

  function press(event: PointerEvent | KeyboardEvent) {
    if (disabled || pressed) return;
    if (event instanceof KeyboardEvent && ![" ", "Enter"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    pressed = true;
    onPress();
  }

  function release(event?: PointerEvent | KeyboardEvent) {
    if (!pressed) return;
    if (event instanceof KeyboardEvent && ![" ", "Enter"].includes(event.key)) {
      return;
    }
    event?.preventDefault();
    pressed = false;
    onRelease();
  }
</script>

<button
  type="button"
  class:active={active || pressed}
  {disabled}
  use:bindMidiControl={midiControl}
  aria-label={detail ? `${label}, ${detail}` : label}
  on:pointerdown={press}
  on:pointerup={release}
  on:pointercancel={release}
  on:pointerleave={release}
  on:keydown={press}
  on:keyup={release}
  on:blur={() => release()}
>
  <span>{label}</span>
  {#if detail}<small>{detail}</small>{/if}
</button>

<style>
  button {
    min-width: 3rem;
    min-height: 3rem;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    padding: clamp(0.55rem, 3cqi, 0.8rem);
    border: 1px solid var(--noodlr-border);
    border-radius: 0.72rem;
    background: var(--noodlr-surface-3);
    color: var(--noodlr-text-secondary);
    box-shadow:
      var(--noodlr-shadow-control),
      inset 0 1px 0 var(--noodlr-border);
    touch-action: none;
    transition:
      transform 90ms ease,
      background 90ms ease,
      color 90ms ease;
  }

  button:hover:not(:disabled),
  button:focus-visible {
    border-color: color-mix(in srgb, var(--play-accent) 48%, transparent);
  }

  button.active {
    transform: translateY(1px) scale(0.98);
    background: var(--play-accent);
    color: var(--play-on-accent, var(--noodlr-text-on-accent));
    box-shadow: var(--noodlr-shadow-control);
  }

  button:focus-visible {
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: 2px;
  }

  span {
    font-size: 0.76rem;
    font-weight: 700;
  }

  small {
    color: var(--noodlr-text-tertiary);
    font-family: var(--noodlr-font-mono);
    font-size: 0.54rem;
  }

  button.active small {
    color: currentColor;
  }

  button:disabled {
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
