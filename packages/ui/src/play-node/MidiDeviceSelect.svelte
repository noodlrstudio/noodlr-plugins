<script lang="ts">
  import type { PlayMidiDeviceInfo } from "@noodlrstudio/play-api";

  export let devices: readonly PlayMidiDeviceInfo[] = [];
  export let selectedId = "";
  export let label = "MIDI device";
  export let emptyLabel = "No MIDI device";
  export let disabled = false;
  export let onChange: (deviceId: string) => void = () => {};
</script>

<label class="device-select">
  <span class="sr-only">{label}</span>
  <select
    value={selectedId}
    {disabled}
    aria-label={label}
    on:change={(event) => onChange(event.currentTarget.value)}
  >
    <option value="">{emptyLabel}</option>
    {#each devices as device}
      <option value={device.id}>
        {device.name}{device.state === "disconnected" ? " — disconnected" : ""}
      </option>
    {/each}
  </select>
</label>

<style>
  .device-select {
    display: block;
    flex: 1;
    min-width: 0;
  }

  select {
    width: 100%;
    min-height: 2rem;
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: 0.55rem;
    padding: 0.35rem 1.8rem 0.35rem 0.55rem;
    color: inherit;
    background: color-mix(in srgb, currentColor 7%, transparent);
    font: inherit;
  }

  select:focus-visible {
    outline: 2px solid color-mix(in srgb, currentColor 65%, transparent);
    outline-offset: 2px;
  }

  select:disabled {
    opacity: 0.5;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
