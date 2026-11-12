<script lang="ts">
  import type { PlayMidiControlBinding } from "@noodlr/play-api";
  import { bindMidiControl } from "./midi-control.js";

  export let label: string;
  export let title = "";
  export let active = false;
  export let activeTone: "accent" | "record" = "accent";
  export let disabled = false;
  export let quiet = false;
  export let midiControl: PlayMidiControlBinding | null = null;
  export let onPress: () => void = () => {};
</script>

<button
  type="button"
  class:active
  class:record={activeTone === "record"}
  class:quiet
  {disabled}
  aria-label={label}
  aria-pressed={active}
  {title}
  use:bindMidiControl={midiControl}
  on:click={onPress}
>
  <slot>{label}</slot>
</button>

<style>
  button {
    min-height: 2.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--noodlr-border);
    border-radius: 0.58rem;
    background: var(--noodlr-surface-2);
    color: var(--noodlr-text-primary);
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: -0.01em;
    transition:
      background 120ms ease,
      color 120ms ease,
      transform 120ms ease;
  }

  button:hover:not(:disabled),
  button:focus-visible,
  button.active {
    background: color-mix(
      in srgb,
      var(--play-accent) 22%,
      var(--noodlr-surface-2)
    );
    color: var(--noodlr-text-primary);
  }

  button.record.active {
    border-color: color-mix(in srgb, var(--noodlr-danger) 52%, transparent);
    background: color-mix(in srgb, var(--noodlr-record) 78%, transparent);
    color: var(--noodlr-text-primary);
  }

  button:active:not(:disabled) {
    transform: translateY(1px);
  }

  button:focus-visible {
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: 2px;
  }

  button.quiet {
    border-color: transparent;
    background: transparent;
  }

  button:disabled {
    cursor: default;
    opacity: 0.42;
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
