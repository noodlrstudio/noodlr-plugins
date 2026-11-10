import { describe, expect, it } from "vitest";
import {
  microphoneSelectionChannelCount,
  normalizeMicrophoneChannelSelection,
} from "./audio-input";

describe("Play microphone channel selection", () => {
  it("keeps a valid mono input", () => {
    expect(
      normalizeMicrophoneChannelSelection({ mode: "mono", channel: 4 }, 8),
    ).toEqual({ mode: "mono", channel: 4 });
  });

  it("clamps stereo pairs to two available adjacent inputs", () => {
    expect(
      normalizeMicrophoneChannelSelection({ mode: "stereo", channel: 8 }, 8),
    ).toEqual({ mode: "stereo", channel: 7 });
  });

  it("falls back to mono for a one-channel device", () => {
    const selection = normalizeMicrophoneChannelSelection(
      { mode: "stereo", channel: 3 },
      1,
    );
    expect(selection).toEqual({ mode: "mono", channel: 1 });
    expect(microphoneSelectionChannelCount(selection)).toBe(1);
  });
});
