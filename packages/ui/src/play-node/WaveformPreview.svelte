<script lang="ts">
  export let label = "Waveform preview";
  export let peaks: readonly number[] = [];
  export let progress = 0;
  export let selectionStart: number | null = null;
  export let selectionEnd: number | null = null;
  export let disabled = false;
  export let compact = false;
  export let onSeek: ((ratio: number) => void) | null = null;

  $: normalizedPeaks = normalizePeaks(peaks);
  $: playhead = clamp(progress);
  $: selection = normalizeSelection(selectionStart, selectionEnd);
  $: canSeek = !!onSeek && !disabled;

  function clamp(value: number) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }

  function normalizePeaks(values: readonly number[]) {
    return values.length
      ? values.map((value) => Math.max(0.025, clamp(value)))
      : Array.from({ length: compact ? 24 : 48 }, () => 0.025);
  }

  function normalizeSelection(start: number | null, end: number | null) {
    if (start === null || end === null) return null;
    const left = clamp(Math.min(start, end));
    const right = clamp(Math.max(start, end));
    return { left, width: Math.max(0, right - left) };
  }

  function seek(event: PointerEvent | MouseEvent) {
    if (!canSeek) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = bounds.width
      ? (event.clientX - bounds.left) / bounds.width
      : 0;
    onSeek?.(clamp(ratio));
  }
</script>

{#if canSeek}
  <button title={label}
    type="button"
    class="waveform-preview"
    class:compact
    class:can-seek={canSeek}
    aria-label={label}
    on:pointerdown={seek}
    on:keydown={(event) => {
      if (event.key === "Home") onSeek?.(0);
      if (event.key === "End") onSeek?.(1);
    }}
  >
    {#if selection}
      <span
        class="waveform-preview__selection"
        style={`left:${selection.left * 100}%;width:${selection.width * 100}%`}
      ></span>
    {/if}

    <div class="waveform-preview__bars" aria-hidden="true">
      {#each normalizedPeaks as peak}
        <span style={`height:${peak * 100}%`}></span>
      {/each}
    </div>

    <span
      class="waveform-preview__playhead"
      style={`left:${playhead * 100}%`}
      aria-hidden="true"
    ></span>
  </button>
{:else}
  <div class="waveform-preview" class:compact role="img" aria-label={label}>
    {#if selection}
      <span
        class="waveform-preview__selection"
        style={`left:${selection.left * 100}%;width:${selection.width * 100}%`}
      ></span>
    {/if}

    <div class="waveform-preview__bars" aria-hidden="true">
      {#each normalizedPeaks as peak}
        <span style={`height:${peak * 100}%`}></span>
      {/each}
    </div>

    <span
      class="waveform-preview__playhead"
      style={`left:${playhead * 100}%`}
      aria-hidden="true"
    ></span>
  </div>
{/if}

<style>
  .waveform-preview {
    position: relative;
    min-width: 0;
    height: 5.1rem;
    overflow: hidden;
    padding: 0;
    border: 1px solid var(--noodlr-border);
    border-radius: 0.7rem;
    background: var(--noodlr-surface-inset);
    appearance: none;
  }

  .waveform-preview.compact {
    height: 2.8rem;
    border-radius: 0.55rem;
  }

  .waveform-preview.can-seek {
    cursor: pointer;
  }

  .waveform-preview:focus-visible {
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: 2px;
  }

  .waveform-preview__selection {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 1;
    background: color-mix(
      in srgb,
      var(--play-accent, var(--noodlr-accent)) 20%,
      transparent
    );
  }

  .waveform-preview__bars {
    position: absolute;
    inset: 0.55rem;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .waveform-preview.compact .waveform-preview__bars {
    inset: 0.35rem;
    gap: 1px;
  }

  .waveform-preview__bars span {
    position: relative;
    z-index: 2;
    flex: 1 1 0;
    min-width: 1px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--play-accent, var(--noodlr-accent)) 70%,
      var(--noodlr-text-primary)
    );
  }

  .waveform-preview__playhead {
    position: absolute;
    top: 0.35rem;
    bottom: 0.35rem;
    z-index: 3;
    width: 2px;
    border-radius: 999px;
    background: var(--noodlr-text-primary);
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--noodlr-text-primary) 32%, transparent);
  }
</style>
