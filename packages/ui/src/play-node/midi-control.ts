import type { PlayMidiControlBinding } from "@noodlr/play-api";

export function bindMidiControl(
  node: HTMLElement,
  binding: PlayMidiControlBinding | null | undefined,
) {
  let detach = binding?.attach(node) ?? (() => {});

  return {
    update(next: PlayMidiControlBinding | null | undefined) {
      detach();
      detach = next?.attach(node) ?? (() => {});
    },
    destroy() {
      detach();
    },
  };
}
