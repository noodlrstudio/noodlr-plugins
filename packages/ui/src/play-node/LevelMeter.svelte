<script lang="ts">
  export let label: string;
  export let value = 0;
  export let segments = 20;
  export let warnAt = 0.68;
  export let peakAt = 0.86;
  export let showValue = false;

  $: clampedValue = Math.max(0, Math.min(1, value));
  $: safeSegments = Math.max(1, Math.round(segments));
  $: activeSegments = Math.round(clampedValue * safeSegments);
  $: segmentItems = Array.from({ length: safeSegments }, (_, index) => {
    const ratio = (index + 1) / safeSegments;
    return {
      active: index < activeSegments,
      warn: ratio >= warnAt,
      peak: ratio >= peakAt,
    };
  });
</script>

<div
  class="level-meter"
  style={`--segments:${safeSegments}`}
  role="meter"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(clampedValue * 100)}
>
  <div class="level-meter__row">
    <span>{label}</span>
    {#if showValue}<output>{Math.round(clampedValue * 100)}%</output>{/if}
  </div>
  <div class="level-meter__segments" aria-hidden="true">
    {#each segmentItems as segment}
      <span
        class:active={segment.active}
        class:warn={segment.active && segment.warn}
        class:peak={segment.active && segment.peak}
      ></span>
    {/each}
  </div>
</div>

<style>
  .level-meter {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }

  .level-meter__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .level-meter__row span {
    min-width: 0;
    overflow: hidden;
    color: var(--noodlr-text-tertiary);
    font-size: 0.56rem;
    font-weight: 720;
    letter-spacing: 0;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  output {
    color: var(--noodlr-text-secondary);
    font-family: var(--noodlr-font-mono);
    font-size: 0.58rem;
  }

  .level-meter__segments {
    display: grid;
    grid-template-columns: repeat(var(--segments, 20), minmax(0, 1fr));
    gap: 2px;
    height: 0.78rem;
  }

  .level-meter__segments span {
    border-radius: 2px;
    background: var(--noodlr-surface-3);
  }

  .level-meter__segments span.active {
    background: var(--play-accent, var(--noodlr-accent));
    box-shadow: 0 0 8px
      color-mix(in srgb, var(--play-accent, var(--noodlr-accent)) 38%, transparent);
  }

  .level-meter__segments span.warn {
    background: var(--noodlr-warning);
  }

  .level-meter__segments span.peak {
    background: var(--noodlr-danger);
  }
</style>
