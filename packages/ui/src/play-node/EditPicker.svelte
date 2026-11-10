<script lang="ts">
  import { afterUpdate } from "svelte";

  export let open = false;
  export let title: string;
  export let description = "";
  export let closeLabel = "Done";
  export let onClose: () => void = () => {};

  let panel: HTMLElement | null = null;
  let wasOpen = false;
  let previousFocus: HTMLElement | null = null;

  afterUpdate(() => {
    if (open && !wasOpen) {
      previousFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      panel?.focus();
    } else if (!open && wasOpen) {
      previousFocus?.focus();
      previousFocus = null;
    }
    wasOpen = open;
  });

  function handleBackdrop(event: PointerEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel) return;

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("hidden"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      panel.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div
    class="edit-picker"
    role="presentation"
    data-no-drag
    on:pointerdown={handleBackdrop}
  >
    <div
      bind:this={panel}
      class="edit-picker__panel"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
    >
      <header class="edit-picker__header">
        <div>
          <strong>{title}</strong>
          {#if description}<p>{description}</p>{/if}
        </div>
        <button type="button" class="edit-picker__close" on:click={onClose}>
          {closeLabel}
        </button>
      </header>

      <div class="edit-picker__body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .edit-picker {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    align-items: end;
    padding: clamp(0.45rem, 2.5cqi, 0.8rem);
    background: color-mix(in srgb, var(--noodlr-surface-canvas) 68%, transparent);
    backdrop-filter: blur(8px);
  }

  .edit-picker__panel {
    min-width: 0;
    max-height: calc(100% - 0.15rem);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--play-accent, var(--noodlr-accent)) 34%, var(--noodlr-surface-3));
    border-radius: 0.88rem;
    background: var(--noodlr-surface-1);
    box-shadow:
      var(--noodlr-shadow-3),
      inset 0 1px 0 var(--noodlr-border);
  }

  .edit-picker__panel:focus {
    outline: none;
  }

  .edit-picker__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0.75rem 0.8rem 0.65rem;
    border-bottom: 1px solid var(--noodlr-border);
  }

  .edit-picker__header strong {
    display: block;
    color: var(--noodlr-text-primary);
    font-size: 0.85rem;
    letter-spacing: -0.02em;
  }

  .edit-picker__header p {
    margin: 0.16rem 0 0;
    color: var(--noodlr-text-tertiary);
    font-size: 0.61rem;
    line-height: 1.35;
  }

  .edit-picker__close {
    min-height: 1.8rem;
    padding: 0.32rem 0.58rem;
    border: 1px solid
      color-mix(in srgb, var(--play-accent, var(--noodlr-accent)) 28%, transparent);
    border-radius: 999px;
    color: var(--noodlr-text-primary);
    background: color-mix(in srgb, var(--play-accent, var(--noodlr-accent)) 13%, var(--noodlr-surface-2));
    font: inherit;
    font-size: 0.61rem;
    font-weight: 720;
  }

  .edit-picker__close:focus-visible {
    outline: 2px solid var(--noodlr-focus-ring);
    outline-offset: 2px;
  }

  .edit-picker__body {
    min-height: 0;
    overflow: auto;
    padding: 0.75rem 0.8rem 0.85rem;
  }

  @container (max-width: 360px) {
    .edit-picker {
      padding: 0.35rem;
    }

    .edit-picker__header,
    .edit-picker__body {
      padding-right: 0.65rem;
      padding-left: 0.65rem;
    }
  }
</style>
