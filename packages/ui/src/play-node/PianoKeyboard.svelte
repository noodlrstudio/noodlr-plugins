<script lang="ts">
  import { getContext, onDestroy } from "svelte";
  import { readable } from "svelte/store";
  import {
    HeldPianoNotes,
    isBlackPianoNote,
    PIANO_KEYBOARD_HOST,
    pianoNoteOctave,
    type PianoKeyboardHost,
    type PianoNoteHandler,
  } from "./piano-keyboard-host.js";

  export let onNoteOn: PianoNoteHandler = () => {};
  export let onNoteOff: PianoNoteHandler = () => {};
  export let activeNotes: readonly number[] = [];
  export let startNote = 48;
  export let keyCount = 25;
  export let disabled = false;
  /** "c" marks each C with its octave; "none" leaves the keys bare. */
  export let labels: "c" | "none" = "c";
  /** False keeps the keyboard in place even inside a docking host. */
  export let dockable = true;
  /** Short captions drawn on keys, such as the computer key that plays them. */
  export let keyLabels: Readonly<Record<number, string>> | null = null;
  /** Pitch classes (0–11) to tint as members of a scale; empty shows none. */
  export let scaleNotes: readonly number[] = [];
  /** Pitch class marked as the scale's root, or null for no root mark. */
  export let rootPitchClass: number | null = null;

  const noteNames = [
    "C",
    "C♯",
    "D",
    "E♭",
    "E",
    "F",
    "F♯",
    "G",
    "A♭",
    "A",
    "B♭",
    "B",
  ];

  const host = dockable
    ? getContext<PianoKeyboardHost | undefined>(PIANO_KEYBOARD_HOST)
    : undefined;
  const binding = host?.attach({
    startNote,
    keyCount,
    activeNotes,
    disabled,
    onNoteOn,
    onNoteOff,
  });
  const docked = binding?.docked ?? readable(false);
  const shelf = binding?.shelf ?? readable("off");
  const held = new HeldPianoNotes();
  // Fingers stay tracked while down, even between keys, so a glide that
  // crosses the gap between two keys carries on into the next one.
  const downPointers = new Set<number>();

  let keyboard: HTMLDivElement | null = null;
  let heldNotes: number[] = [];

  $: binding?.update({
    startNote,
    keyCount,
    activeNotes,
    disabled,
    onNoteOn,
    onNoteOff,
  });
  $: whiteKeys = Array.from(
    { length: keyCount },
    (_, index) => startNote + index,
  ).filter((note) => !isBlackPianoNote(note));
  // On the desktop shelf the node keeps the keyboard's shape, so it still
  // takes the same room and says where its keys went.
  $: away = $docked && $shelf === "holding";
  $: if ((disabled || $docked) && heldNotes.length) releaseAll();
  $: sounding = new Set([...activeNotes, ...heldNotes]);
  $: scaleSet = new Set(scaleNotes.map((note) => ((note % 12) + 12) % 12));
  $: rootClass =
    rootPitchClass === null || scaleSet.size === 0
      ? null
      : ((rootPitchClass % 12) + 12) % 12;

  function noteLabel(note: number) {
    return `${noteNames[note % 12]}${pianoNoteOctave(note)}`;
  }

  function keyLabel(note: number) {
    const role =
      rootClass === note % 12
        ? ", scale root"
        : scaleSet.has(note % 12)
          ? ", in scale"
          : "";
    return `${noteLabel(note)}${role}`;
  }

  function hasBlackAfter(note: number) {
    return isBlackPianoNote(note + 1) && note + 1 < startNote + keyCount;
  }

  function noteFromElement(element: Element | null) {
    const key = element?.closest<HTMLElement>("[data-note]");
    if (!key || !keyboard?.contains(key)) return null;
    const note = Number(key.dataset.note);
    return Number.isFinite(note) ? note : null;
  }

  function press(source: string, note: number, event?: PointerEvent) {
    if (held.press(source, note)) void onNoteOn(note, event);
    heldNotes = held.notes;
  }

  function release(source: string, event?: PointerEvent) {
    const note = held.release(source);
    if (note !== null) void onNoteOff(note, event);
    heldNotes = held.notes;
  }

  function releaseAll() {
    downPointers.clear();
    for (const note of held.releaseAll()) void onNoteOff(note);
    heldNotes = [];
  }

  function insideKeyboard(event: PointerEvent) {
    const rect = keyboard?.getBoundingClientRect();
    return (
      !!rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function handlePointerDown(event: PointerEvent) {
    if (disabled || event.button > 0) return;
    const note = noteFromElement(event.target as Element);
    if (note === null) return;
    event.preventDefault();
    // The board also listens for pointers so it can pan and move Noodles.
    // Keep this finger with the instrument: otherwise the board can capture
    // it, and WebKit may turn a playing gesture into text selection.
    event.stopPropagation();
    keyboard?.setPointerCapture(event.pointerId);
    downPointers.add(event.pointerId);
    press(`pointer:${event.pointerId}`, note, event);
  }

  // Sliding a finger across the keys plays each key it reaches.
  function handlePointerMove(event: PointerEvent) {
    if (!downPointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    const source = `pointer:${event.pointerId}`;
    const current = held.noteFor(source);
    const note = noteFromElement(
      document.elementFromPoint(event.clientX, event.clientY),
    );
    if (note === current) return;
    if (note === null && insideKeyboard(event)) return;
    release(source, event);
    if (note !== null && !disabled) press(source, note, event);
  }

  function handlePointerEnd(event: PointerEvent) {
    if (!downPointers.delete(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    if (keyboard?.hasPointerCapture(event.pointerId)) {
      keyboard.releasePointerCapture(event.pointerId);
    }
    release(`pointer:${event.pointerId}`, event);
  }

  // Touch stays with the key it started on, so a finger keeps gliding past
  // the edge. A mouse leaving the keys lets go, as a finger lifting would.
  function handlePointerLeave(event: PointerEvent) {
    if (event.pointerType !== "touch") handlePointerEnd(event);
  }

  function handleKeyDown(event: KeyboardEvent, note: number) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat && !disabled) press(`key:${note}`, note);
  }

  function handleKeyUp(event: KeyboardEvent, note: number) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    release(`key:${note}`);
  }

  onDestroy(() => {
    releaseAll();
    binding?.release();
  });
</script>

<svelte:window
  on:pointerup={handlePointerEnd}
  on:pointercancel={handlePointerEnd}
/>

{#if !$docked || away}
  <div
    bind:this={keyboard}
    class="keyboard"
    class:away
    class:playing={heldNotes.length > 0}
    role="group"
    aria-label={away ? "Piano keyboard, playing on the shelf" : "Piano keyboard"}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerEnd}
    on:pointercancel={handlePointerEnd}
    on:pointerleave={handlePointerLeave}
    on:selectstart|preventDefault
    on:dragstart|preventDefault
  >
    {#if !away && $shelf === "available" && !disabled}
      <button
        type="button"
        class="shelf-button"
        title="Play these keys from the keyboard shelf"
        on:click={() => binding?.moveToShelf?.()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v11M7.5 10l4.5 4.5 4.5-4.5M4 20h16" />
        </svg>
        <span>Move to shelf</span>
      </button>
    {/if}
    {#if away}
      <div class="away-note">
        <span>Keys are on the shelf</span>
        <button
          type="button"
          class="shelf-button"
          on:click={() => binding?.bringBackFromShelf?.()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 18V7M7.5 11 12 6.5l4.5 4.5M4 21h16" />
          </svg>
          <span>Bring back</span>
        </button>
      </div>
    {/if}
    <div class="rails" inert={away} aria-hidden={away}>
      {#each whiteKeys as note (note)}
        <div class="key">
          <button
            type="button"
            class:active={sounding.has(note)}
            class:in-scale={scaleSet.has(note % 12)}
            class:scale-root={rootClass === note % 12}
            class="white"
            data-note={note}
            aria-label={keyLabel(note)}
            title={noteLabel(note)}
            {disabled}
            on:keydown={(event) => handleKeyDown(event, note)}
            on:keyup={(event) => handleKeyUp(event, note)}
            on:blur={() => release(`key:${note}`)}
          >
            {#if keyLabels?.[note]}
              <kbd aria-hidden="true">{keyLabels[note]}</kbd>
            {/if}
            {#if labels === "c" && note % 12 === 0}
              <span aria-hidden="true">C{pianoNoteOctave(note)}</span>
            {/if}
          </button>

          {#if hasBlackAfter(note)}
            <button
              type="button"
              class:active={sounding.has(note + 1)}
              class:in-scale={scaleSet.has((note + 1) % 12)}
              class:scale-root={rootClass === (note + 1) % 12}
              class="black"
              data-note={note + 1}
              aria-label={keyLabel(note + 1)}
              title={noteLabel(note + 1)}
              {disabled}
              on:keydown={(event) => handleKeyDown(event, note + 1)}
              on:keyup={(event) => handleKeyUp(event, note + 1)}
              on:blur={() => release(`key:${note + 1}`)}
            >
              {#if keyLabels?.[note + 1]}
                <kbd aria-hidden="true">{keyLabels[note + 1]}</kbd>
              {/if}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .keyboard {
    --key-gap: 3px;
    --key-accent: var(--play-accent, var(--noodlr-accent));
    box-sizing: border-box;
    width: 100%;
    padding: 0.3rem;
    overflow: hidden;
    border: 1px solid var(--noodlr-border);
    border-radius: 0.9rem;
    background: var(--noodlr-surface-inset);
    container-type: inline-size;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    position: relative;
  }

  .keyboard.away {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--key-accent) 45%, var(--noodlr-border));
    background: color-mix(in srgb, var(--key-accent) 7%, var(--noodlr-surface-inset));
  }

  .away .rails {
    opacity: 0.1;
    pointer-events: none;
  }

  .away-note {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    color: color-mix(in srgb, var(--key-accent) 60%, var(--noodlr-text-primary));
    font-size: 0.78rem;
    font-weight: 650;
    text-align: center;
  }

  .shelf-button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.28rem 0.65rem 0.28rem 0.5rem;
    border: 1px solid
      color-mix(in srgb, var(--key-accent) 40%, var(--noodlr-border));
    border-radius: 999px;
    background: var(--noodlr-surface-1);
    color: var(--noodlr-text-primary);
    font-size: 0.7rem;
    font-weight: 650;
    box-shadow: 0 0.35rem 0.9rem
      color-mix(in srgb, var(--noodlr-shadow-color) 30%, transparent);
  }

  .shelf-button svg {
    width: 0.85rem;
    height: 0.85rem;
    fill: none;
    stroke: color-mix(in srgb, var(--key-accent) 75%, var(--noodlr-text-primary));
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Offered on hover, on the keyboard's top edge so it stays clear of the
     keys, and never while notes are held. */
  .keyboard:has(> .shelf-button) {
    overflow: visible;
  }

  .keyboard > .shelf-button {
    position: absolute;
    top: 0;
    right: 0.6rem;
    z-index: 4;
    opacity: 0;
    transform: translateY(-45%);
    pointer-events: none;
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .keyboard:hover:not(.playing) > .shelf-button,
  .keyboard > .shelf-button:focus-visible {
    opacity: 1;
    transform: translateY(-55%);
    pointer-events: auto;
  }

  /* No hover on touch screens: a quiet icon stays in reach instead. */
  @media (hover: none) {
    .keyboard > .shelf-button {
      opacity: 0.8;
      transform: translateY(-55%);
      pointer-events: auto;
    }

    .keyboard > .shelf-button span {
      display: none;
    }
  }

  .rails {
    position: relative;
    display: flex;
    gap: var(--key-gap);
    width: 100%;
    min-width: 0;
    height: var(--piano-key-height, clamp(5rem, 30cqi, 6.6rem));
  }

  .key {
    position: relative;
    min-width: 0;
    flex: 1 1 0;
  }

  button {
    padding: 0;
    border: 0;
    font: inherit;
    touch-action: none;
    cursor: pointer;
  }

  .white {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 0.3rem;
    padding-bottom: 0.55rem;
    border-radius: 0 0 0.55rem 0.55rem;
    background: var(--noodlr-key-white);
    box-shadow: inset 0 -0.38rem 0
      color-mix(in srgb, var(--noodlr-key-white) 80%, var(--noodlr-key-black));
    transition:
      background-color 60ms ease,
      box-shadow 60ms ease;
  }

  .white.in-scale:not(.active) {
    background: color-mix(in srgb, var(--key-accent) 22%, var(--noodlr-key-white));
  }

  .white.scale-root:not(.active) {
    background: color-mix(in srgb, var(--key-accent) 48%, var(--noodlr-key-white));
  }

  .black.in-scale:not(.active) {
    background: color-mix(in srgb, var(--key-accent) 45%, var(--noodlr-key-black));
  }

  .black.scale-root:not(.active) {
    background: color-mix(in srgb, var(--key-accent) 70%, var(--noodlr-key-black));
  }

  .white.active {
    background: var(--key-accent);
    box-shadow: inset 0 -0.12rem 0
      color-mix(in srgb, var(--key-accent) 70%, var(--noodlr-key-black));
  }

  .white span {
    color: color-mix(in srgb, var(--noodlr-key-black) 55%, var(--noodlr-key-white));
    font-size: 0.62rem;
    font-weight: 700;
    line-height: 1;
  }

  .white.active span {
    color: var(--play-on-accent, var(--noodlr-text-on-accent));
  }

  kbd {
    min-width: 1.15rem;
    height: 1.15rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.2rem;
    border-radius: 0.3rem;
    font: 700 0.66rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    text-transform: uppercase;
  }

  .white kbd {
    border: 1px solid
      color-mix(in srgb, var(--noodlr-key-black) 14%, transparent);
    background: color-mix(in srgb, var(--noodlr-key-black) 7%, transparent);
    color: color-mix(in srgb, var(--noodlr-key-black) 75%, var(--noodlr-key-white));
  }

  .black kbd {
    min-width: 1rem;
    height: 1rem;
    background: color-mix(in srgb, var(--noodlr-key-white) 12%, transparent);
    color: color-mix(in srgb, var(--noodlr-key-white) 85%, var(--noodlr-key-black));
  }

  .active kbd {
    border-color: transparent;
    background: color-mix(in srgb, var(--noodlr-key-black) 14%, transparent);
    color: var(--play-on-accent, var(--noodlr-text-on-accent));
  }

  /* Centred over the gap between this white key and the next. */
  .black {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 0.45rem;
    position: absolute;
    top: 0;
    right: calc(-31% - var(--key-gap) / 2);
    z-index: 2;
    width: 62%;
    height: 60%;
    border-radius: 0 0 0.45rem 0.45rem;
    background: var(--noodlr-key-black);
    box-shadow:
      inset 0 -0.3rem 0
        color-mix(in srgb, var(--noodlr-key-black) 72%, var(--noodlr-key-white)),
      0 0.25rem 0.5rem color-mix(in srgb, var(--noodlr-key-black) 45%, transparent);
    transition:
      background-color 60ms ease,
      box-shadow 60ms ease;
  }

  .black.active {
    background: var(--key-accent);
    box-shadow: inset 0 -0.1rem 0
      color-mix(in srgb, var(--key-accent) 60%, var(--noodlr-key-black));
  }

  button:focus-visible {
    z-index: 3;
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: -2px;
  }

  button:disabled {
    cursor: default;
    opacity: 0.55;
  }

  @media (prefers-reduced-motion: reduce) {
    .keyboard > .shelf-button,
    .white,
    .black {
      transition: none;
    }
  }
</style>
