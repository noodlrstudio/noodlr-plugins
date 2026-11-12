import { describe, expect, it } from "vitest";
import {
  PLAY_API_VERSION,
  createMockPlayNodeContext,
  createPlayNodeSharedDefaults,
  type PlayJsonObject,
} from "@noodlrstudio/play-api";
import { compressor } from "./index";
import {
  DEFAULT_SETTINGS,
  createCompressorController,
  dbToGain,
  settingsFromState,
} from "./compressor-controller";

/** Just enough of Web Audio to record what the controller builds. */
function fakeAudio() {
  const connections: Array<[string, string]> = [];
  const param = () => ({
    value: 0,
    setTargetAtTime(value: number) {
      this.value = value;
    },
  });
  let count = 0;
  const node = (kind: string, extra: object = {}) => {
    const name = `${kind}${count++}`;
    return {
      name,
      connect(target: { name: string }) {
        connections.push([name, target.name]);
      },
      disconnect() {},
      ...extra,
    };
  };
  const created: Record<string, any> = {};
  const audioContext = {
    currentTime: 0,
    createDynamicsCompressor: () =>
      (created.compressor = node("compressor", {
        threshold: param(),
        ratio: param(),
        knee: param(),
        attack: param(),
        release: param(),
        reduction: -3.5,
      })),
    createGain: () => {
      const gain = node("gain", { gain: param() });
      (created.gains ??= []).push(gain);
      return gain;
    },
  };
  return {
    audioContext: audioContext as unknown as BaseAudioContext,
    input: node("input") as unknown as AudioNode,
    connections,
    created,
  };
}

describe("compressor", () => {
  const defaults = createPlayNodeSharedDefaults(compressor.state.fields);

  it("targets the current Play API", () => {
    expect(compressor.manifest.apiVersion).toBe(PLAY_API_VERSION);
  });

  it("has an audio input and output", () => {
    expect(
      compressor.ports?.map((port) => `${port.type}:${port.direction}`),
    ).toEqual(["audio:in", "audio:out"]);
  });

  it("defaults match the controller's defaults", () => {
    expect(settingsFromState(defaults)).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps out-of-range state", () => {
    const settings = settingsFromState({
      threshold: -100,
      ratio: 50,
      attack: "fast",
    });
    expect(settings.threshold).toBe(-60);
    expect(settings.ratio).toBe(20);
    expect(settings.attack).toBe(DEFAULT_SETTINGS.attack);
  });

  it("converts makeup dB to gain", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(6)).toBeCloseTo(1.995, 3);
  });

  it("builds the graph and follows shared state", () => {
    const mock = createMockPlayNodeContext(defaults as PlayJsonObject, [
      "audio.input",
      "audio.output",
      "collaboration.shared-state",
    ]);
    const audio = fakeAudio();
    const controller = createCompressorController(mock.context, audio);
    const { compressor: dynamics, gains } = audio.created;

    expect(dynamics.threshold.value).toBe(-24);
    expect(dynamics.attack.value).toBeCloseTo(0.01);
    // wet on, dry off
    expect(gains[1].gain.value).toBe(1);
    expect(gains[2].gain.value).toBe(0);
    expect(controller.reduction()).toBe(-3.5);

    mock.context.state.set("threshold", -40);
    mock.context.state.set("makeup", 6);
    mock.context.state.set("bypass", true);

    expect(dynamics.threshold.value).toBe(-40);
    expect(gains[0].gain.value).toBeCloseTo(1.995, 3);
    expect(gains[1].gain.value).toBe(0);
    expect(gains[2].gain.value).toBe(1);
    expect(audio.connections).toContainEqual(["input0", dynamics.name]);
  });
});
