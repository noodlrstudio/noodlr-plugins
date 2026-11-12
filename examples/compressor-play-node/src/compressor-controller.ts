import type { PlayJsonObject, PlayNodeContext } from "@noodlrstudio/play-api";

export interface CompressorSettings {
  /** dB, -60 to 0. */
  threshold: number;
  /** 1 to 20. */
  ratio: number;
  /** Milliseconds, 0 to 1000. */
  attack: number;
  /** Milliseconds, 10 to 1000. */
  release: number;
  /** dB, 0 to 40. */
  knee: number;
  /** dB of makeup gain, 0 to 24. */
  makeup: number;
  bypass: boolean;
}

export const DEFAULT_SETTINGS: CompressorSettings = {
  threshold: -24,
  ratio: 4,
  attack: 10,
  release: 250,
  knee: 6,
  makeup: 0,
  bypass: false,
};

/** Smoothing for parameter changes, so moving a knob does not click. */
const RAMP_SECONDS = 0.02;

function clamp(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

/** Reads settings from node state, clamped to what Web Audio accepts. */
export function settingsFromState(
  state: Readonly<PlayJsonObject>,
): CompressorSettings {
  const d = DEFAULT_SETTINGS;
  return {
    threshold: clamp(state.threshold, -60, 0, d.threshold),
    ratio: clamp(state.ratio, 1, 20, d.ratio),
    attack: clamp(state.attack, 0, 1000, d.attack),
    release: clamp(state.release, 10, 1000, d.release),
    knee: clamp(state.knee, 0, 40, d.knee),
    makeup: clamp(state.makeup, 0, 24, d.makeup),
    bypass: state.bypass === true,
  };
}

export function dbToGain(db: number) {
  return 10 ** (db / 20);
}

export interface CompressorController {
  /** Current gain reduction in dB, 0 or negative. */
  reduction(): number;
}

/** The audio objects the controller needs, injectable for tests. */
export interface CompressorAudio {
  audioContext: BaseAudioContext;
  input: AudioNode;
}

/**
 * Builds input -> compressor -> makeup -> output, plus a dry path for bypass,
 * and keeps the graph in step with the node's shared state.
 */
export function createCompressorController(
  context: PlayNodeContext<PlayJsonObject>,
  audio: CompressorAudio = {
    audioContext: context.audio.context(),
    input: context.audio.input("audio-in").node,
  },
): CompressorController {
  const { audioContext, input } = audio;
  const compressor = audioContext.createDynamicsCompressor();
  const makeup = audioContext.createGain();
  const wet = audioContext.createGain();
  const dry = audioContext.createGain();
  const sum = audioContext.createGain();

  input.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(wet);
  wet.connect(sum);
  input.connect(dry);
  dry.connect(sum);

  const disconnectOutput = context.audio.output("audio-out").connect(sum);

  function apply(settings: CompressorSettings) {
    const now = audioContext.currentTime;
    const set = (param: AudioParam, value: number) =>
      param.setTargetAtTime(value, now, RAMP_SECONDS);
    set(compressor.threshold, settings.threshold);
    set(compressor.ratio, settings.ratio);
    set(compressor.knee, settings.knee);
    set(compressor.attack, settings.attack / 1000);
    set(compressor.release, settings.release / 1000);
    set(makeup.gain, dbToGain(settings.makeup));
    set(wet.gain, settings.bypass ? 0 : 1);
    set(dry.gain, settings.bypass ? 1 : 0);
  }

  const unsubscribe = context.state.subscribe((state) =>
    apply(settingsFromState(state)),
  );

  context.lifecycle.onDispose(() => {
    unsubscribe();
    disconnectOutput();
    for (const node of [compressor, makeup, wet, dry, sum]) node.disconnect();
    try {
      input.disconnect(compressor);
      input.disconnect(dry);
    } catch {
      // The host may already have torn the input down.
    }
  });

  return {
    reduction: () => compressor.reduction,
  };
}
