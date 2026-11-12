<script lang="ts">
  import type { PlayMidiDeviceInfo } from "@noodlrstudio/play-api";

  export let devices: readonly PlayMidiDeviceInfo[] = [];
  export let selectedIds: readonly string[] = [];
  export let label = "MIDI devices";
  export let emptyLabel = "No MIDI devices found.";
  export let disabled = false;
  export let onChange: (deviceIds: readonly string[]) => void = () => {};

  function toggle(deviceId: string) {
    onChange(
      selectedIds.includes(deviceId)
        ? selectedIds.filter((candidate) => candidate !== deviceId)
        : [...selectedIds, deviceId],
    );
  }
</script>

<fieldset class="device-list" {disabled} aria-label={label}>
  <legend class="sr-only">{label}</legend>
  {#each devices as device}
    <label>
      <input
        type="checkbox"
        checked={selectedIds.includes(device.id)}
        on:change={() => toggle(device.id)}
      />
      <span>{device.name}</span>
    </label>
  {:else}
    <p>{emptyLabel}</p>
  {/each}
</fieldset>

<style>
  .device-list {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
    max-height: 6.5rem;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: auto;
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 1.65rem;
    font-size: 0.75rem;
  }

  input {
    accent-color: currentColor;
  }

  p {
    margin: 0;
    opacity: 0.62;
    font-size: 0.72rem;
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
