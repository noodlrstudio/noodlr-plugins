import { describe, expect, it } from "vitest";
import {
  PLAY_API_VERSION,
  createMockPlayNodeContext,
  createPlayNodeSharedDefaults,
} from "@noodlr/play-api";
import { starterNode } from "./index";

describe("starter node", () => {
  it("targets the current preview API", () => {
    expect(starterNode.manifest.apiVersion).toBe(PLAY_API_VERSION);
  });

  it("starts enabled at level 96", () => {
    expect(createPlayNodeSharedDefaults(starterNode.state.fields)).toEqual({
      enabled: true,
      level: 96,
    });
  });

  it("is told when the host switches between Dark and Light", () => {
    const mock = createMockPlayNodeContext(
      createPlayNodeSharedDefaults(starterNode.state.fields),
    );
    const themes: string[] = [];
    mock.context.appearance.subscribe(({ theme }) => themes.push(theme));

    mock.setTheme("light");

    expect(themes).toEqual(["dark", "light"]);
    expect(mock.context.appearance.snapshot().tokens["surface-1"]).toBe(
      "#dddee1",
    );
  });

  it("reads the space's tempo from the transport", () => {
    expect(starterNode.manifest.capabilities).toContain("transport.read");
    const mock = createMockPlayNodeContext(
      createPlayNodeSharedDefaults(starterNode.state.fields),
      ["transport.read"],
    );
    const tempos: number[] = [];
    mock.context.transport.subscribe(({ bpm }) => tempos.push(bpm));

    mock.setClock({ playing: true, bpm: 96 });

    expect(tempos).toEqual([120, 96]);
    expect(mock.context.transport.snapshot().state).toBe("playing");
  });
});
