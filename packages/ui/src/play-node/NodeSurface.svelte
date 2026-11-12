<script lang="ts">
  import { resolveOnAccentCss } from "@noodlrstudio/play-api";

  export let label: string;
  export let description = "";
  export let accent = "var(--noodlr-accent)";
  export let compact = false;
  export let element: HTMLElement | null = null;
  /** Text colour on the accent. Set it when `accent` is a `var(...)` or other value that cannot be resolved here. */
  export let onAccent: string | null = null;

  $: resolvedOnAccent =
    onAccent ?? resolveOnAccentCss(accent) ?? "var(--noodlr-text-on-accent)";
</script>

<section
  bind:this={element}
  class="play-surface"
  class:compact
  style={`--play-accent:${accent};--play-on-accent:${resolvedOnAccent}`}
  aria-label={description ? `${label}: ${description}` : label}
>
  <slot />
</section>

<style>
  .play-surface {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(0.65rem, 3cqi, 1rem);
    padding: clamp(0.7rem, 3.5cqi, 1.1rem);
    overflow: hidden;
    color: var(--noodlr-text-primary);
    background: var(--noodlr-surface-1);
    font-family: var(--noodlr-font-sans);
    container-type: size;
  }

  .play-surface.compact {
    gap: 0.55rem;
    padding: 0.65rem;
  }
</style>
