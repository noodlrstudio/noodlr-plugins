import type { PlayMicrophoneChannelSelection } from "./types";

export function normalizeMicrophoneChannelSelection(
  selection: PlayMicrophoneChannelSelection,
  availableChannelCount: number,
): PlayMicrophoneChannelSelection {
  const available = Math.max(1, Math.round(availableChannelCount));
  const mode = selection.mode === "stereo" && available > 1 ? "stereo" : "mono";
  const maximumStart = mode === "stereo" ? available - 1 : available;
  return {
    mode,
    channel: Math.max(1, Math.min(maximumStart, Math.round(selection.channel))),
  };
}

export function microphoneSelectionChannelCount(
  selection: PlayMicrophoneChannelSelection | null | undefined,
) {
  return selection?.mode === "stereo" ? 2 : 1;
}
