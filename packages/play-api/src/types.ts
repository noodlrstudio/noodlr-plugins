import type { PlayPerformanceApi } from "./performance";
import type { PlayAppearanceApi } from "./appearance";
import type { PlayLiveTransportApi, PlayMidiLiveApi } from "./live-session";
import type { PlayClockApi } from "./clock";
import type { PlaySongApi } from "./song";
import type { Component } from "svelte";

export const PLAY_API_VERSION = "0" as const;

export type PlayJsonPrimitive = string | number | boolean | null;
export type PlayJsonValue =
  | PlayJsonPrimitive
  | PlayJsonValue[]
  | { [key: string]: PlayJsonValue };
export type PlayJsonObject = { [key: string]: PlayJsonValue };

export type PlayNodeCapability =
  | "midi.input"
  | "midi.output"
  | "midi.control-mapping"
  | "midi.device-input"
  | "midi.device-output"
  | "collaboration.shared-state"
  | "transport.read"
  | "transport.schedule"
  | "audio.input"
  | "audio.output"
  | "audio.decode"
  | "mixer.read"
  | "mixer.write"
  | "song.read"
  | "song.perform"
  | "song.write"
  | "clock.follow"
  | "network.fetch"
  | "microphone.input"
  | "file.import"
  | "file.export"
  | "asset.read"
  | "asset.write";

export type PlayStateScope =
  | "shared-persisted"
  | "local-persisted"
  | "local-ephemeral";

export type PlayAssetReference = PlayJsonObject & {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  storage: PlayJsonObject;
};

interface PlayStateFieldBase<T extends PlayJsonValue> {
  default: T;
  scope: PlayStateScope;
  label?: string;
  description?: string;
  /** Allows a session-scoped node-control lease to change this field. */
  liveSessionEditable?: boolean;
}

export type PlayStateFieldDefinition =
  | (PlayStateFieldBase<string> & {
      type: "string";
      options?: readonly string[];
      maxLength?: number;
    })
  | (PlayStateFieldBase<number> & {
      type: "number";
      integer?: boolean;
      minimum?: number;
      maximum?: number;
      step?: number;
    })
  | (PlayStateFieldBase<boolean> & { type: "boolean" })
  | (PlayStateFieldBase<PlayJsonValue> & { type: "json" })
  | {
      type: "asset";
      default: PlayAssetReference | null;
      scope: PlayStateScope;
      label?: string;
      description?: string;
      /** Asset references are protected from session-scoped control leases. */
      liveSessionEditable?: never;
      accept?: readonly string[];
      maximumBytes?: number;
    };

export type PlayStateFields = Record<string, PlayStateFieldDefinition>;

type InferPlayStateField<TField extends PlayStateFieldDefinition> =
  TField["type"] extends "string"
    ? string
    : TField["type"] extends "number"
      ? number
      : TField["type"] extends "boolean"
        ? boolean
        : TField["type"] extends "asset"
          ? PlayAssetReference | null
          : PlayJsonValue;

export type InferPlayState<TFields extends PlayStateFields> = {
  [TKey in keyof TFields]: InferPlayStateField<TFields[TKey]>;
};

export interface PlayNodeManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: typeof PLAY_API_VERSION;
  description?: string;
  category?: string;
  author?: {
    name: string;
    url?: string;
  };
  icon?: string;
  tags?: string[];
  capabilities?: PlayNodeCapability[];
  liveSession?: {
    performance?: Array<"midi" | "transport" | "shared-loop">;
  };
  minimumSize?: { width: number; height: number };
  preferredSize?: { width: number; height: number };
}

export interface PlayNodePortDefinition {
  id: string;
  type: "midi.notes" | "midi.messages" | "audio";
  label: string;
  direction: "in" | "out";
}

export interface PlayMidiNoteEvent {
  type: "noteon" | "noteoff";
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
  /** The sender chose `timestamp`, so a late note is still played against it. */
  timed?: boolean;
  sourceId?: string;
  /** Original MIDI 1 bytes when the event came from a byte packet. */
  data?: readonly number[];
}

export interface PlayMidiCcEvent {
  type: "cc";
  controller: number;
  value: number;
  channel: number;
  timestamp: number;
  /** The sender chose `timestamp`, so a late note is still played against it. */
  timed?: boolean;
  sourceId?: string;
  /** Original MIDI 1 bytes when the event came from a byte packet. */
  data?: readonly number[];
}

export interface PlayMidiRawEvent {
  type: "raw";
  /** Complete MIDI 1 short message. SysEx and MIDI 2 are not accepted in v1. */
  data: readonly number[];
  channel: number;
  timestamp: number;
  sourceId?: string;
}

export type PlayMidiMessage =
  | PlayMidiNoteEvent
  | PlayMidiCcEvent
  | PlayMidiRawEvent;

export interface PlayMidiInput {
  /**
   * A future note reaches a listener when it is due. With `scheduled`, it comes
   * straight away and the node plays it at `event.timestamp`, which is on the
   * performance.now() timebase: `context.audio.timeAt` converts it.
   */
  subscribe(
    listener: (event: PlayMidiMessage) => void,
    options?: { scheduled?: boolean },
  ): () => void;
}

export interface PlayMidiOutput {
  /** `atMs` plays it later, on the performance.now() timebase. */
  noteOn(
    note: number,
    velocity?: number,
    channel?: number,
    sourceId?: string,
    atMs?: number,
  ): void;
  noteOff(
    note: number,
    releaseVelocity?: number,
    channel?: number,
    sourceId?: string,
    atMs?: number,
  ): void;
  note(
    note: number,
    options?: {
      velocity?: number;
      channel?: number;
      durationMs?: number;
      sourceId?: string;
      atMs?: number;
    },
  ): void;
  controlChange(
    controller: number,
    value: number,
    channel?: number,
    sourceId?: string,
  ): void;
  send(data: readonly number[], options?: { timestamp?: number }): void;
  allNotesOff(): void;
}

export interface PlayMidiControlBinding {
  readonly id: string;
  readonly label: string;
  attach(target: HTMLElement): () => void;
}

export interface PlayMidiControlDefinition {
  id: string;
  label: string;
  apply(message: PlayMidiCcEvent): void;
  disabled?: boolean;
}

export type PlayMidiTriggerEvent = PlayMidiCcEvent | PlayMidiNoteEvent;

export interface PlayMidiTriggerDefinition {
  id: string;
  label: string;
  apply(message: PlayMidiTriggerEvent): void;
  disabled?: boolean;
}

export interface PlayMidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: "connected" | "disconnected";
  connection: "open" | "closed" | "pending";
  direction: "input" | "output";
}

export interface PlayMidiDeviceSnapshot {
  supported: boolean;
  inputs: readonly PlayMidiDeviceInfo[];
  outputs: readonly PlayMidiDeviceInfo[];
}

export interface PlayMidiDevicesApi {
  requestAccess(): Promise<PlayMidiDeviceSnapshot>;
  snapshot(): PlayMidiDeviceSnapshot;
  subscribe(listener: (snapshot: PlayMidiDeviceSnapshot) => void): () => void;
  input(deviceId: string): PlayMidiInput;
  output(deviceId: string): PlayMidiOutput;
}

export interface PlayAudioConnectable {
  connect(destination: unknown): unknown;
  disconnect(destination?: unknown): unknown;
}

export interface PlayAudioInput {
  readonly node: AudioNode;
}

export interface PlayAudioOutput {
  connect(
    source: PlayAudioConnectable,
    options?: { connectToMasterWhenUnrouted?: boolean },
  ): () => void;
}

export interface PlayWaveformPreview {
  readonly durationSeconds: number;
  readonly channelCount: number;
  readonly peaks: readonly number[];
}

export interface PlayAudioApi {
  ensureReady(): Promise<AudioContext>;
  context(): AudioContext;
  input(portId: string): PlayAudioInput;
  output(portId: string): PlayAudioOutput;
  decodeWaveform(
    value: Blob,
    options?: { sampleCount?: number },
  ): Promise<PlayWaveformPreview>;
  /**
   * `timeAt`, `msAt` and `onSchedulerTick` need no audio capability, so a node
   * that only schedules MIDI can use them.
   * Audio-context seconds for a performance.now() time. All nodes on a context share one map.
   */
  timeAt(ms: number): number;
  /** The performance.now() time of an audio-context time. */
  msAt(audioTime: number): number;
  /** About every 25 ms, also in a hidden tab. Released with the node. */
  onSchedulerTick(callback: () => void): () => void;
}

export type PlayTransportState = "stopped" | "playing" | "paused";

export interface PlayTransportSnapshot {
  readonly state: PlayTransportState;
  readonly seconds: number;
  readonly beat: number;
  readonly bpm: number;
}

export interface PlayTransportScheduleOptions {
  afterSeconds?: number;
  atSeconds?: number;
  quantizeBeats?: number;
}

export interface PlayTransportApi {
  now(): number;
  snapshot(): PlayTransportSnapshot;
  subscribe(listener: (snapshot: PlayTransportSnapshot) => void): () => void;
  schedule(
    callback: (snapshot: PlayTransportSnapshot) => void,
    options?: PlayTransportScheduleOptions,
  ): () => void;
  /**
   * Seconds on the `now()` timebase at which the space clock reaches `beat`;
   * null while the clock is stopped.
   */
  timeOfBeat(beat: number): number | null;
  /** The clock's beat at `seconds` on the `now()` timebase; null while stopped. */
  beatAt(seconds: number): number | null;
}

export interface PlayMixerSnapshot {
  readonly levels: {
    readonly native: number;
    readonly tab: number;
  };
  readonly masterVolumeDb: number;
}

export interface PlayMixerApi {
  snapshot(): PlayMixerSnapshot;
  subscribe(listener: (snapshot: PlayMixerSnapshot) => void): () => void;
  setMasterVolumeDb(value: number, options?: { rampSeconds?: number }): void;
  /**
   * A read-only analyser on what this listener hears, after the master
   * limiter. Shared between nodes and released when the node is disposed.
   * Null where there is no audio context, such as in previews and tests.
   */
  outputAnalyser(): AnalyserNode | null;
}

export interface PlayNetworkApi {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface PlayMicrophoneDeviceInfo {
  id: string;
  label: string;
  groupId: string;
  /** Maximum independently addressable input channels, when exposed. */
  availableChannelCount?: number;
}

export type PlayMicrophoneInputMode = "mono" | "stereo";

/** A one-based channel or adjacent stereo-pair selection. */
export interface PlayMicrophoneChannelSelection {
  mode: PlayMicrophoneInputMode;
  channel: number;
}

export interface PlayMicrophoneInputOptions {
  deviceId?: string;
  channelCount?: number;
  selection?: PlayMicrophoneChannelSelection;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface PlayMicrophoneInput {
  readonly stream: MediaStream;
  /** The raw device source, retained for backwards compatibility. */
  readonly source: MediaStreamAudioSourceNode;
  /** The selected mono channel, stereo pair, or unmodified device source. */
  readonly node: AudioNode;
  readonly analyser: AnalyserNode;
  readonly availableChannelCount: number;
  readonly channelCount: number;
  readonly selection: PlayMicrophoneChannelSelection | null;
  stop(): void;
}

export interface PlayMicrophoneApi {
  supported(): boolean;
  devices(): Promise<readonly PlayMicrophoneDeviceInfo[]>;
  subscribeDevices(
    listener: (devices: readonly PlayMicrophoneDeviceInfo[]) => void,
  ): () => void;
  request(options?: PlayMicrophoneInputOptions): Promise<PlayMicrophoneInput>;
}

export interface PlayFilePickOptions {
  accept?: readonly string[];
  multiple?: boolean;
  maximumBytes?: number;
}

export interface PlayFilesApi {
  pick(options?: PlayFilePickOptions): Promise<readonly File[]>;
  save(blob: Blob, options: { suggestedName: string }): Promise<void>;
}

export type PlayAssetAvailability =
  | "local"
  | "syncing"
  | "shared"
  | "missing"
  | "error";

export type PlayLocalAssetSyncStatus =
  | "uploading"
  | "available"
  | "downloading"
  | "preparing"
  | "ready"
  | "error";

export interface PlayAssetsApi {
  store(
    value: Blob,
    options: { name: string; shared?: boolean },
  ): Promise<PlayAssetReference>;
  load(reference: PlayAssetReference): Promise<Blob>;
  prepare(
    reference: PlayAssetReference,
    prepare: (value: Blob) => Promise<void>,
  ): Promise<void>;
  remove(reference: PlayAssetReference): Promise<void>;
  status(reference: PlayAssetReference): PlayAssetAvailability;
  localSyncStatus(reference: PlayAssetReference): PlayLocalAssetSyncStatus;
  subscribe(
    listener: (
      referenceId: string,
      status: PlayAssetAvailability,
      error?: string,
    ) => void,
  ): () => void;
}

export interface PlayStateApi<TState extends PlayJsonObject> {
  get<TKey extends keyof TState>(key: TKey): TState[TKey];
  set<TKey extends keyof TState>(
    key: TKey,
    value: TState[TKey],
    options?: { historyLabel?: string },
  ): void;
  update<TKey extends keyof TState>(
    key: TKey,
    updater: (value: TState[TKey]) => TState[TKey],
    options?: { historyLabel?: string },
  ): void;
  preview<TKey extends keyof TState>(key: TKey, value: TState[TKey]): void;
  commit<TKey extends keyof TState>(
    key: TKey,
    value?: TState[TKey],
    options?: { historyLabel?: string },
  ): void;
  subscribe(listener: (state: Readonly<TState>) => void): () => void;
  snapshot(): Readonly<TState>;
}

export interface PlayLifecycleApi {
  readonly signal: AbortSignal;
  onActivate(callback: () => void | (() => void)): () => void;
  onSuspend(callback: () => void): () => void;
  onResize(
    callback: (size: { width: number; height: number }) => void,
  ): () => void;
  onDispose(callback: () => void | Promise<void>): () => void;
  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): () => void;
  timeout(callback: () => void, delayMs: number): () => void;
  interval(callback: () => void, delayMs: number): () => void;
  animationFrame(callback: FrameRequestCallback): () => void;
  track(cleanup: () => void): () => void;
}

export interface PlayNodeDiagnostic {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  timestamp: number;
}

export interface PlayDiagnosticsApi {
  report(diagnostic: Omit<PlayNodeDiagnostic, "timestamp">): void;
  snapshot(): readonly PlayNodeDiagnostic[];
}

/**
 * Optional frame control for nodes that resize themselves or change which of
 * their declared ports are shown. Hosts that cannot do this omit `frame`.
 *
 * Use `batch` for anything a user did: `setSize` and `setActivePorts` called
 * outside `batch` record no undo step and can invalidate earlier undo steps for
 * this node, so call them outside `batch` only to correct a mismatch. A node
 * whose shape follows its state should also declare `initialFrame` on its
 * definition, so a new node needs no such correction.
 */
export interface PlayFrameApi {
  /**
   * False when the host won't apply frame writes: the node is read-only, in
   * focus presentation, disposed, or missing (removed). Writes are then
   * no-ops and `batch` does not run its change.
   */
  readonly writable: boolean;
  /** Current frame size in board units. */
  readonly size: { width: number; height: number };
  /** Sets this node's size; clamped to manifest.minimumSize, position unchanged. */
  setSize(size: { width: number; height: number }): void;
  /**
   * Shows only these declared port ids on the board. A port with a connected
   * cable stays active unless `disconnect` is true inside `batch`; outside a
   * batch the host keeps every cabled port, including cables removed but kept
   * for undo. Returns the ids now active.
   */
  setActivePorts(
    portIds: readonly string[],
    options?: { disconnect?: boolean },
  ): readonly string[];
  /** Ids of declared ports that currently have a connected cable. */
  connectedPortIds(): readonly string[];
  /** Ids of the ports the node shows on the board now, in declaration order. */
  activePortIds(): readonly string[];
  /**
   * Runs `change` as one board-history step named `label`. When the frame
   * cannot change (read-only, focus mode, a removed node) `change` is not run.
   */
  batch(label: string, change: () => void): void;
}

export interface PlayNodeContext<TState extends PlayJsonObject> {
  readonly performance?: PlayPerformanceApi;
  readonly nodeId: string;
  readonly readOnly: boolean;
  readonly state: PlayStateApi<TState>;
  readonly lifecycle: PlayLifecycleApi;
  readonly diagnostics: PlayDiagnosticsApi;
  readonly appearance: PlayAppearanceApi;
  readonly midi: {
    input(portId: string): PlayMidiInput;
    output(portId: string): PlayMidiOutput;
    control(definition: PlayMidiControlDefinition): PlayMidiControlBinding;
    trigger(definition: PlayMidiTriggerDefinition): PlayMidiControlBinding;
    readonly devices: PlayMidiDevicesApi;
    readonly live: PlayMidiLiveApi;
  };
  readonly audio: PlayAudioApi;
  readonly transport: PlayTransportApi;
  readonly liveTransport: PlayLiveTransportApi;
  readonly mixer: PlayMixerApi;
  readonly network: PlayNetworkApi;
  readonly microphone: PlayMicrophoneApi;
  readonly files: PlayFilesApi;
  readonly assets: PlayAssetsApi;
  readonly parameters?: PlayParameterApi;
  readonly frame?: PlayFrameApi;
  /** The space's active song; absent where there is no space, such as Node Lab. */
  readonly song?: PlaySongApi;
  /** The space's shared clock; only for nodes declaring `clock.follow`. */
  readonly clock?: PlayClockApi;
  hasCapability(capability: PlayNodeCapability): boolean;
  requireCapability(capability: PlayNodeCapability): void;
}

export interface PlayParameterDescriptor {
  id: string;
  label: string;
  minimum: number;
  maximum: number;
  default: number;
  unit?: string;
  step?: number;
  scale?: "linear" | "logarithmic";
}

export interface PlayParameterApi {
  register(
    descriptor: PlayParameterDescriptor,
    set: (value: number, phase: "preview" | "commit") => void,
    get?: () => number,
  ): () => void;
  beginGesture(label?: string): void;
  endGesture(): void;
}

export interface PlayNodeViewProps<
  TState extends PlayJsonObject = PlayJsonObject,
  TController = unknown,
> {
  context: PlayNodeContext<TState>;
  controller: TController;
  size: { width: number; height: number };
  active: boolean;
  readOnly: boolean;
  canPerform?: boolean;
  boardId?: string | null;
  presentationMode?: "canvas" | "focus";
}

export interface PlayNodeStateDefinition<TFields extends PlayStateFields> {
  version: number;
  fields: TFields;
  migrations?: Record<number, (state: PlayJsonObject) => PlayJsonObject>;
}

/**
 * The frame a new or duplicated node starts with, worked out from its shared
 * state. `size` is clamped to `manifest.minimumSize`; `activePortIds` keeps
 * the declared ports, in declaration order, that it names.
 */
export interface PlayNodeInitialFrame {
  size?: { width: number; height: number };
  activePortIds?: readonly string[];
}

export interface PlayNodeDefinition<
  TFields extends PlayStateFields = PlayStateFields,
  TController = void,
> {
  manifest: PlayNodeManifest;
  state: PlayNodeStateDefinition<TFields>;
  ports?: readonly PlayNodePortDefinition[];
  /**
   * Optional. Lets the host create (and duplicate) the node already in the
   * shape its state needs, so it never has to reshape itself on first mount
   * outside history. Without it the node starts at `preferredSize` with
   * every declared port.
   */
  initialFrame?: (sharedState: PlayJsonObject) => PlayNodeInitialFrame;
  setup?: (
    context: PlayNodeContext<InferPlayState<TFields>>,
  ) => TController | Promise<TController>;
  view: Component<
    PlayNodeViewProps<InferPlayState<TFields>, Awaited<TController>>
  >;
}
