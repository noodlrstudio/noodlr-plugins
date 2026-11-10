<script lang="ts">
  export let label = "Loop region";
  export let peaks: readonly number[] = [];
  export let durationSeconds = 0;
  export let startSeconds = 0;
  export let endSeconds = 0;
  export let minimumRegionSeconds = 0.05;
  export let maximumRegionSeconds = Number.POSITIVE_INFINITY;
  export let disabled = false;
  export let progress = 0;
  export let onPreview: (region: {
    start: number;
    end: number;
  }) => void = () => {};
  export let onCommit: (region: {
    start: number;
    end: number;
  }) => void = () => {};
  export let onSeek: ((ratio: number) => void) | null = null;
  export let onScrub: ((ratio: number) => void) | null = null;

  let host: HTMLDivElement;
  let dragging: "start" | "end" | null = null;
  let pointerId: number | null = null;
  let previewStart = startSeconds;
  let previewEnd = endSeconds;
  let scrubbing = false;
  let scrubPointerId: number | null = null;

  $: if (!dragging) {
    previewStart = clamp(startSeconds, 0, Math.max(0, durationSeconds));
    previewEnd = clamp(
      endSeconds || durationSeconds,
      previewStart,
      durationSeconds,
    );
  }
  $: normalizedPeaks = peaks.length
    ? peaks.map((peak) => clamp(peak, 0.025, 1))
    : Array.from({ length: 48 }, () => 0.025);
  $: startRatio = durationSeconds ? previewStart / durationSeconds : 0;
  $: endRatio = durationSeconds ? previewEnd / durationSeconds : 1;

  function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function secondsAt(clientX: number) {
    const bounds = host.getBoundingClientRect();
    return clamp(
      ((clientX - bounds.left) / Math.max(1, bounds.width)) * durationSeconds,
      0,
      durationSeconds,
    );
  }

  function ratioAt(clientX: number) {
    const bounds = host.getBoundingClientRect();
    return clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
  }

  function beginScrub(event: PointerEvent) {
    if (disabled || (!onSeek && !onScrub)) return;
    if ((event.target as HTMLElement).closest("button")) return;
    scrubbing = true;
    scrubPointerId = event.pointerId;
    host.setPointerCapture(event.pointerId);
    const ratio = ratioAt(event.clientX);
    onSeek?.(ratio);
    onScrub?.(ratio);
  }

  function moveScrub(event: PointerEvent) {
    if (!scrubbing || event.pointerId !== scrubPointerId) return;
    onScrub?.(ratioAt(event.clientX));
  }

  function finishScrub(event: PointerEvent) {
    if (!scrubbing || event.pointerId !== scrubPointerId) return;
    onSeek?.(ratioAt(event.clientX));
    scrubbing = false;
    scrubPointerId = null;
  }

  function update(handle: "start" | "end", seconds: number) {
    const maximumLength = Math.max(minimumRegionSeconds, maximumRegionSeconds);
    if (handle === "start") {
      previewStart = clamp(
        seconds,
        Math.max(0, previewEnd - maximumLength),
        Math.max(0, previewEnd - minimumRegionSeconds),
      );
    } else {
      previewEnd = clamp(
        seconds,
        Math.min(durationSeconds, previewStart + minimumRegionSeconds),
        Math.min(durationSeconds, previewStart + maximumLength),
      );
    }
    onPreview({ start: previewStart, end: previewEnd });
  }

  function begin(handle: "start" | "end", event: PointerEvent) {
    if (disabled) return;
    event.preventDefault();
    dragging = handle;
    pointerId = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    update(handle, secondsAt(event.clientX));
  }

  function move(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    update(dragging, secondsAt(event.clientX));
  }

  function finish(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    update(dragging, secondsAt(event.clientX));
    dragging = null;
    pointerId = null;
    onCommit({ start: previewStart, end: previewEnd });
  }

  function key(handle: "start" | "end", event: KeyboardEvent) {
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? 1
          : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const step = Math.max(0.01, durationSeconds / 100);
    const current = handle === "start" ? previewStart : previewEnd;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? durationSeconds
          : current + direction * step;
    update(handle, next);
    onCommit({ start: previewStart, end: previewEnd });
  }
</script>

<div
  class="editor"
  class:can-scrub={!!onSeek || !!onScrub}
  bind:this={host}
  role="group"
  aria-label={label}
  data-no-drag
  on:pointerdown={beginScrub}
  on:pointermove={moveScrub}
  on:pointerup={finishScrub}
  on:pointercancel={finishScrub}
>
  <div
    class="selection"
    style={`left:${startRatio * 100}%;right:${(1 - endRatio) * 100}%`}
  ></div>
  <div class="bars" aria-hidden="true">
    {#each normalizedPeaks as peak}
      <span style={`height:${peak * 100}%`}></span>
    {/each}
  </div>
  <span
    class="playhead"
    style={`left:${clamp(progress, 0, 1) * 100}%`}
    aria-hidden="true"
  ></span>
  {#each ["start", "end"] as handle}
    {@const value = handle === "start" ? previewStart : previewEnd}
    <button title={`${label} ${handle} point`}
      type="button"
      class="handle"
      class:end={handle === "end"}
      style={`left:${(durationSeconds ? value / durationSeconds : 0) * 100}%`}
      role="slider"
      aria-label={`${label} ${handle} point`}
      aria-valuemin={0}
      aria-valuemax={durationSeconds}
      aria-valuenow={value}
      aria-valuetext={`${value.toFixed(2)} seconds`}
      {disabled}
      on:pointerdown={(event) => begin(handle as "start" | "end", event)}
      on:pointermove={move}
      on:pointerup={finish}
      on:pointercancel={finish}
      on:keydown={(event) => key(handle as "start" | "end", event)}
      ><span aria-hidden="true"></span></button
    >
  {/each}
</div>

<style>
  .editor {
    position: relative;
    height: 6.4rem;
    overflow: hidden;
    border: 1px solid var(--noodlr-border);
    border-radius: 0.72rem;
    background: var(--noodlr-surface-inset);
    touch-action: none;
  }
  .editor.can-scrub {
    cursor: crosshair;
  }
  .bars {
    position: absolute;
    inset: 0.8rem 0.55rem;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .bars span {
    flex: 1 1 0;
    min-width: 1px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--play-accent) 68%, var(--noodlr-text-primary));
    opacity: 0.75;
  }
  .selection {
    position: absolute;
    inset-block: 0;
    background: color-mix(in srgb, var(--play-accent) 16%, transparent);
  }
  .playhead {
    position: absolute;
    inset-block: 0.4rem;
    width: 2px;
    border-radius: 999px;
    background: var(--noodlr-text-primary);
    opacity: 0.76;
  }
  .handle {
    position: absolute;
    z-index: 3;
    top: 0;
    bottom: 0;
    width: 44px;
    margin-left: -22px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: ew-resize;
    touch-action: none;
  }
  .handle span {
    position: absolute;
    inset-block: 0.4rem;
    left: 20px;
    width: 3px;
    border-radius: 999px;
    background: var(--play-accent);
    box-shadow: 0 0 0 1px var(--noodlr-surface-inset);
  }
  .handle.end span {
    background: color-mix(in srgb, var(--play-accent) 55%, var(--noodlr-text-primary));
  }
  .handle:focus-visible {
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: -3px;
  }
  .handle:disabled {
    cursor: default;
    opacity: 0.45;
  }
</style>
