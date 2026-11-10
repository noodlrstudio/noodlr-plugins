<script lang="ts">
  import type {
    PlayMicrophoneChannelSelection,
    PlayMicrophoneDeviceInfo,
    PlayMicrophoneInputMode,
  } from "@noodlr/play-api";

  export let devices: readonly PlayMicrophoneDeviceInfo[] = [];
  export let deviceId = "";
  export let availableChannelCount = 1;
  export let selection: PlayMicrophoneChannelSelection = {
    mode: "mono",
    channel: 1,
  };
  export let disabled = false;
  export let compact = false;
  export let onDeviceChange: (deviceId: string) => void = () => {};
  export let onSelectionChange: (
    selection: PlayMicrophoneChannelSelection,
  ) => void = () => {};

  $: selectedDevice = deviceId
    ? devices.find((device) => device.id === deviceId)
    : devices.find((device) => device.id === "default");
  $: channelCount = Math.max(
    1,
    Math.round(availableChannelCount),
    Math.round(selectedDevice?.availableChannelCount ?? 1),
  );
  $: monoChannels = Array.from(
    { length: channelCount },
    (_, index) => index + 1,
  );
  $: stereoPairs = Array.from(
    { length: Math.floor(channelCount / 2) },
    (_, index) => index * 2 + 1,
  );
  $: selectedChannel =
    selection.mode === "stereo"
      ? Math.min(Math.max(1, selection.channel), stereoPairs.at(-1) ?? 1)
      : Math.min(Math.max(1, selection.channel), channelCount);

  function chooseMode(mode: PlayMicrophoneInputMode) {
    const channel =
      mode === "stereo"
        ? Math.max(1, Math.floor((selectedChannel - 1) / 2) * 2 + 1)
        : selectedChannel;
    onSelectionChange({ mode, channel });
  }
</script>

<fieldset
  class="audio-input-picker"
  class:compact
  {disabled}
  data-testid="audio-input-picker"
  aria-label="Audio input routing"
>
  <label class="device">
    <span>Input</span>
    <select
      value={deviceId}
      aria-label="Audio input device"
      on:change={(event) => onDeviceChange(event.currentTarget.value)}
    >
      <option value="">System Default</option>
      {#each devices as device, index (device.id)}
        {#if device.id !== "default" && device.id !== "communications"}
          <option value={device.id}
            >{device.label || `Audio Input ${index + 1}`}</option
          >
        {/if}
      {/each}
    </select>
  </label>

  <div class="format" aria-label="Recording format">
    <button
      type="button"
      class:active={selection.mode === "mono"}
      aria-pressed={selection.mode === "mono"}
      title="Record one input"
      on:click={() => chooseMode("mono")}>Mono</button
    >
    <button
      type="button"
      class:active={selection.mode === "stereo"}
      aria-pressed={selection.mode === "stereo"}
      disabled={disabled || channelCount < 2}
      title={channelCount < 2
        ? "This device has one input"
        : "Record a stereo pair"}
      on:click={() => chooseMode("stereo")}>Stereo</button
    >
  </div>

  <label class="channel">
    <span>{selection.mode === "stereo" ? "Pair" : "Channel"}</span>
    <select
      value={selectedChannel}
      disabled={disabled || channelCount < 2}
      aria-label={selection.mode === "stereo"
        ? "Stereo input pair"
        : "Input channel"}
      on:change={(event) =>
        onSelectionChange({
          mode: selection.mode,
          channel: Number(event.currentTarget.value),
        })}
    >
      {#if selection.mode === "stereo"}
        {#each stereoPairs as channel}
          <option value={channel}>Input {channel}–{channel + 1}</option>
        {/each}
      {:else}
        {#each monoChannels as channel}
          <option value={channel}>Input {channel}</option>
        {/each}
      {/if}
    </select>
  </label>
</fieldset>

<style>
  .audio-input-picker {
    display: grid;
    width: min(100%, 29rem);
    max-width: 100%;
    min-width: 0;
    grid-template-columns: minmax(0, 13rem) auto minmax(6.5rem, 7.5rem);
    align-items: end;
    justify-self: start;
    gap: 0.48rem;
    margin: 0;
    border: 0;
    padding: 0;
    color: var(--noodlr-text-primary);
  }
  label {
    display: grid;
    min-width: 0;
    gap: 0.25rem;
  }
  label > span {
    color: var(--noodlr-text-tertiary);
    font-size: 0.5rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  select,
  .format {
    min-width: 0;
    height: 32px;
    box-sizing: border-box;
    border: 1px solid var(--noodlr-surface-3);
    border-radius: 8px;
    background: var(--noodlr-surface-2);
    color: var(--noodlr-text-primary);
    font: inherit;
    font-size: 0.61rem;
  }
  select {
    width: 100%;
    padding: 0 1.75rem 0 0.58rem;
    text-overflow: ellipsis;
  }
  .format {
    display: flex;
    overflow: hidden;
    border-radius: 999px;
  }
  button {
    min-width: 48px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--noodlr-text-secondary);
    padding: 0 0.55rem;
    font: inherit;
    font-size: 0.58rem;
  }
  button.active {
    background: color-mix(in srgb, var(--noodlr-warning) 18%, var(--noodlr-surface-1));
    color: var(--noodlr-warning);
  }
  select:hover:not(:disabled),
  select:focus-visible,
  .format:focus-within {
    border-color: color-mix(in srgb, var(--noodlr-warning) 40%, var(--noodlr-surface-3));
  }
  select:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: 2px;
  }
  :disabled {
    opacity: 0.4;
  }
  .audio-input-picker.compact {
    width: min(100%, 26rem);
    grid-template-columns: minmax(0, 11.5rem) auto minmax(5.5rem, 6.5rem);
    gap: 0.34rem;
  }
  .compact select,
  .compact .format {
    height: 28px;
    border-radius: 7px;
  }
  .compact button {
    min-width: 42px;
    padding: 0 0.42rem;
    font-size: 0.54rem;
  }
  .compact label > span {
    font-size: 0.46rem;
  }
  @media (max-width: 560px) {
    .audio-input-picker,
    .audio-input-picker.compact {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .device,
    .compact .device {
      grid-column: 1/-1;
    }
  }
</style>
