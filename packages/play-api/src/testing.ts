import {
  createPlayAppearanceController,
  type PlayAppearanceTheme,
} from "./appearance";
import type { PlayClockApi, PlayClockSnapshot } from "./clock";
import { PlayResourceScope } from "./lifecycle";
import type { PlaySongApi, PlaySongSnapshot } from "./song";
import type {
  PlayDiagnosticsApi,
  PlayFrameApi,
  PlayJsonObject,
  PlayMidiNoteEvent,
  PlayMixerSnapshot,
  PlayNodeCapability,
  PlayNodeContext,
  PlayNodeDiagnostic,
  PlayNodePortDefinition,
  PlayStateApi,
  PlayTransportSnapshot,
} from "./types";

export interface MockPlayFrameOptions {
  /** Declared ports, in declaration order. When omitted, any requested id is accepted. */
  ports?: readonly Pick<PlayNodePortDefinition, "id">[];
  /** Initial frame size. Defaults to 300 x 260. */
  size?: { width: number; height: number };
  /** `setSize` clamps to this, like the host does for manifest.minimumSize. */
  minimumSize?: { width: number; height: number };
  /** Ports shown at the start. Defaults to every declared port. */
  activePorts?: readonly string[];
  /**
   * Whether the frame takes writes (the host's `writable`). Defaults to true;
   * flip it later with `setFrameWritable`.
   */
  writable?: boolean;
}

export function createMockPlayNodeContext<TState extends PlayJsonObject>(
  initialState: TState,
  capabilities: PlayNodeCapability[] = [],
  options: { frame?: MockPlayFrameOptions | false } = {},
) {
  let state = structuredClone(initialState);
  const listeners = new Set<(value: Readonly<TState>) => void>();
  const diagnostics: PlayNodeDiagnostic[] = [];
  const midiEvents: Array<{ portId: string; event: PlayMidiNoteEvent }> = [];
  const schedulerTicks = new Set<() => void>();
  const lifecycle = new PlayResourceScope();
  const appearance = createPlayAppearanceController();
  lifecycle.track(() => appearance.dispose());
  // Stopped at 120 BPM and not following the space, until a test drives it.
  let clockSnapshot: PlayClockSnapshot = {
    playing: false,
    bpm: 120,
    scope: null,
    follows: false,
    ownBpm: null,
    canEdit: true,
  };
  /** Local ms at which bar 0 starts while the clock plays. */
  let clockOriginMs = 0;
  const clockListeners = new Set<(snapshot: PlayClockSnapshot) => void>();
  const runningNodes = new Set<string>();
  const clockBarMs = () => 240_000 / clockSnapshot.bpm;
  const clockBarAt = (timeMs: number) =>
    clockSnapshot.playing ? (timeMs - clockOriginMs) / clockBarMs() : null;
  const clockTimeOfBar = (bar: number) =>
    clockSnapshot.playing ? clockOriginMs + bar * clockBarMs() : null;
  function changeClock(next: Partial<PlayClockSnapshot>) {
    clockSnapshot = { ...clockSnapshot, ...next };
    clockListeners.forEach((listener) => listener(clockSnapshot));
  }
  const clockApi: PlayClockApi = {
    snapshot: () => clockSnapshot,
    subscribe(listener) {
      listener(clockSnapshot);
      clockListeners.add(listener);
      return () => clockListeners.delete(listener);
    },
    barAt: clockBarAt,
    timeOfBar: clockTimeOfBar,
    nextBar(leadMs = 0) {
      const atMs = performance.now() + leadMs;
      const bar = clockBarAt(atMs);
      if (bar === null) return null;
      const next = Math.ceil(bar);
      return { bar: next, atMs: clockTimeOfBar(next)! };
    },
    start() {
      if (clockSnapshot.playing) return;
      clockOriginMs = performance.now();
      changeClock({ playing: true, scope: "node" });
    },
    stopIfIdle() {
      if (clockSnapshot.playing && runningNodes.size === 0) {
        changeClock({ playing: false, scope: null });
      }
    },
    running(isRunning) {
      if (isRunning) runningNodes.add(context.nodeId);
      else runningNodes.delete(context.nodeId);
    },
    isLive: () => false,
    setFollow(follows) {
      if (!clockSnapshot.canEdit || clockSnapshot.follows === follows) {
        return false;
      }
      changeClock({ follows });
      return true;
    },
    setOwnBpm(bpm) {
      if (!clockSnapshot.canEdit || !Number.isFinite(bpm)) return false;
      const ownBpm = Math.round(Math.min(240, Math.max(40, bpm)));
      if (!clockSnapshot.follows && clockSnapshot.ownBpm === ownBpm) {
        return false;
      }
      changeClock({ follows: false, ownBpm });
      return true;
    },
  };
  const transportListeners = new Set<
    (snapshot: PlayTransportSnapshot) => void
  >();
  clockListeners.add(() => {
    const snapshot = transportSnapshot();
    transportListeners.forEach((listener) => listener(snapshot));
  });
  function transportSnapshot(): PlayTransportSnapshot {
    const seconds = 0;
    const bpm = clockSnapshot.bpm;
    return {
      state: clockSnapshot.playing ? "playing" : "stopped",
      seconds,
      bpm,
      beat: (clockBarAt(seconds * 1_000) ?? 0) * 4,
    };
  }
  const mixerSnapshot: PlayMixerSnapshot = {
    levels: { native: 0, tab: 0 },
    masterVolumeDb: 0,
  };

  // A space with no songs yet; nothing plays and every write is refused.
  const songSnapshot: PlaySongSnapshot = {
    canEdit: true,
    songs: [],
    activeSongId: null,
    active: null,
    playback: { playing: false, bpm: null, queued: null },
  };
  const songApi: PlaySongApi = {
    snapshot: () => songSnapshot,
    subscribe(listener) {
      listener(songSnapshot);
      return () => {};
    },
    timeOfBar: () => null,
    barAt: () => null,
    position: () => null,
    chordAt: () => null,
    play() {},
    queue() {},
    stop() {},
    write: {
      createSong: () => null,
      setActiveSong: () => false,
      setTempo: () => false,
      keepPart: () => null,
      updatePartBars: () => false,
      renamePart: () => false,
      archivePart: () => false,
    },
  };

  const stateApi: PlayStateApi<TState> = {
    get: (key) => state[key],
    set(key, value) {
      state = { ...state, [key]: structuredClone(value) };
      listeners.forEach((listener) => listener(state));
    },
    update(key, updater) {
      stateApi.set(key, updater(state[key]));
    },
    preview(key, value) {
      stateApi.set(key, value);
    },
    commit(key, value) {
      if (value !== undefined) stateApi.set(key, value);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    snapshot: () => structuredClone(state),
  };

  const frameOptions = options.frame || {};
  const declaredPortIds = frameOptions.ports?.map((port) => port.id) ?? null;
  const connectedPorts = new Set<string>();
  /** Ports whose cable was removed elsewhere; the host keeps it for undo. */
  const removedCablePorts = new Set<string>();
  /** Open `batch` calls; like the host, only a batch may disconnect. */
  let batchDepth = 0;
  let frameWritable = frameOptions.writable ?? true;
  const frameHistory: string[] = [];
  let frameSize = { ...(frameOptions.size ?? { width: 300, height: 260 }) };
  let activePorts: string[] = [
    ...(frameOptions.activePorts ?? declaredPortIds ?? []),
  ];

  const frameApi: PlayFrameApi = {
    get writable() {
      return frameWritable;
    },
    get size() {
      return { ...frameSize };
    },
    setSize(size) {
      if (!frameWritable) return;
      const minimum = frameOptions.minimumSize;
      frameSize = {
        width: Math.max(size.width, minimum?.width ?? 0),
        height: Math.max(size.height, minimum?.height ?? 0),
      };
    },
    setActivePorts(portIds, portOptions = {}) {
      if (!frameWritable) return [...activePorts];
      const keep = new Set(portIds);
      // Outside a batch every cabled port stays, removed cables included;
      // inside one, `disconnect` drops live cables of ports not named.
      if (batchDepth === 0) {
        for (const id of [...connectedPorts, ...removedCablePorts]) {
          keep.add(id);
        }
      } else if (!portOptions.disconnect) {
        for (const id of connectedPorts) keep.add(id);
      }
      const ordered = declaredPortIds
        ? declaredPortIds.filter((id) => keep.has(id))
        : [...keep];
      activePorts = ordered;
      // Dropping a port prunes its cables, live and removed.
      for (const cables of [connectedPorts, removedCablePorts]) {
        for (const id of [...cables]) {
          if (!activePorts.includes(id)) cables.delete(id);
        }
      }
      return [...activePorts];
    },
    connectedPortIds: () =>
      (declaredPortIds ?? [...connectedPorts]).filter((id) =>
        connectedPorts.has(id),
      ),
    activePortIds: () => [...activePorts],
    batch(label, change) {
      // Like the host, a frame that takes no writes does not run the change.
      if (!frameWritable) return;
      frameHistory.push(label);
      batchDepth += 1;
      try {
        change();
      } finally {
        batchDepth -= 1;
      }
    },
  };

  const diagnosticsApi: PlayDiagnosticsApi = {
    report(diagnostic) {
      diagnostics.push({ ...diagnostic, timestamp: Date.now() });
    },
    snapshot: () => diagnostics,
  };

  const context: PlayNodeContext<TState> = {
    nodeId: "play-node-test",
    readOnly: false,
    state: stateApi,
    lifecycle,
    diagnostics: diagnosticsApi,
    appearance: appearance.api,
    // `{ frame: false }` models a host that omits the optional frame API.
    ...(options.frame === false ? {} : { frame: frameApi }),
    hasCapability: (capability) => capabilities.includes(capability),
    requireCapability(capability) {
      if (!capabilities.includes(capability)) {
        throw new Error(`Play node capability was not declared: ${capability}`);
      }
    },
    midi: {
      input: () => ({ subscribe: () => () => {} }),
      control(definition) {
        return {
          id: definition.id,
          label: definition.label,
          attach: () => () => {},
        };
      },
      trigger(definition) {
        return {
          id: definition.id,
          label: definition.label,
          attach: () => () => {},
        };
      },
      devices: {
        async requestAccess() {
          return { supported: false, inputs: [], outputs: [] };
        },
        snapshot() {
          return { supported: false, inputs: [], outputs: [] };
        },
        subscribe: () => () => {},
        input: () => ({ subscribe: () => () => {} }),
        output: () => createMockMidiOutput("device"),
      },
      live: {
        share() {},
        subscribe: () => () => {},
      },
      output(portId) {
        return createMockMidiOutput(portId);
      },
    },
    audio: {
      async ensureReady() {
        throw new Error("Audio is not available in the mock context.");
      },
      context() {
        throw new Error("Audio is not available in the mock context.");
      },
      input() {
        throw new Error("Audio is not available in the mock context.");
      },
      output() {
        return { connect: () => () => {} };
      },
      async decodeWaveform() {
        context.requireCapability("audio.decode");
        throw new Error("Audio is not available in the mock context.");
      },
      timeAt: (ms) => ms / 1_000,
      msAt: (audioTime) => audioTime * 1_000,
      onSchedulerTick(callback) {
        schedulerTicks.add(callback);
        return lifecycle.track(() => schedulerTicks.delete(callback));
      },
    },
    transport: {
      now: () => transportSnapshot().seconds,
      snapshot: transportSnapshot,
      subscribe(listener) {
        listener(transportSnapshot());
        transportListeners.add(listener);
        return () => transportListeners.delete(listener);
      },
      schedule(callback) {
        callback(transportSnapshot());
        return () => {};
      },
      timeOfBeat(beat) {
        const ms = clockTimeOfBar(beat / 4);
        return ms === null ? null : ms / 1_000;
      },
      beatAt(seconds) {
        const bar = clockBarAt(seconds * 1_000);
        return bar === null ? null : bar * 4;
      },
    },
    liveTransport: {
      request: () => false,
      subscribe: () => () => {},
      providePhase: () => () => {},
    },
    mixer: {
      snapshot: () => mixerSnapshot,
      subscribe(listener) {
        listener(mixerSnapshot);
        return () => {};
      },
      setMasterVolumeDb() {},
      outputAnalyser: () => null,
    },
    song: songApi,
    clock: clockApi,
    network: {
      async fetch() {
        throw new Error("Network fetch is not available in the mock context.");
      },
    },
    microphone: {
      supported: () => false,
      async devices() {
        return [];
      },
      subscribeDevices(listener) {
        listener([]);
        return () => {};
      },
      async request() {
        throw new Error("Microphone is not available in the mock context.");
      },
    },
    files: {
      async pick() {
        return [];
      },
      async save() {},
    },
    assets: {
      async store() {
        throw new Error("Assets are not available in the mock context.");
      },
      async load() {
        throw new Error("Assets are not available in the mock context.");
      },
      async prepare() {
        throw new Error("Assets are not available in the mock context.");
      },
      async remove() {},
      status: () => "missing",
      localSyncStatus: () => "error",
      subscribe: () => () => {},
    },
  };

  function createMockMidiOutput(portId: string) {
    const publish = (
      type: "noteon" | "noteoff",
      note: number,
      velocity: number,
      channel: number,
      atMs?: number,
    ) =>
      midiEvents.push({
        portId,
        event: {
          type,
          note,
          velocity,
          channel,
          timestamp: atMs ?? performance.now(),
        },
      });
    return {
      noteOn: (
        note: number,
        velocity = 100,
        channel = 1,
        _sourceId?: string,
        atMs?: number,
      ) => publish("noteon", note, velocity, channel, atMs),
      noteOff: (
        note: number,
        velocity = 0,
        channel = 1,
        _sourceId?: string,
        atMs?: number,
      ) => publish("noteoff", note, velocity, channel, atMs),
      note(
        note: number,
        options: { velocity?: number; channel?: number; atMs?: number } = {},
      ) {
        publish(
          "noteon",
          note,
          options.velocity ?? 100,
          options.channel ?? 1,
          options.atMs,
        );
      },
      controlChange() {},
      send() {},
      allNotesOff() {},
    };
  }

  return {
    context,
    diagnostics,
    midiEvents,
    /** Runs everything subscribed to `context.audio.onSchedulerTick`. */
    tickScheduler: () => schedulerTicks.forEach((callback) => callback()),
    lifecycle,
    /** Labels of `context.frame.batch` calls, in order. */
    frameHistory,
    /** Marks a declared port as having a connected cable. */
    connect(portId: string) {
      connectedPorts.add(portId);
      removedCablePorts.delete(portId);
    },
    /**
     * Removes a port's cable elsewhere (a delete). The port stays shown, and
     * like the host's soft-deleted cable it keeps the port outside a batch.
     */
    disconnect(portId: string) {
      if (connectedPorts.delete(portId)) removedCablePorts.add(portId);
    },
    /** Models the host locking or unlocking frame writes (focus mode, say). */
    setFrameWritable(writable: boolean) {
      frameWritable = writable;
    },
    setTheme(theme: PlayAppearanceTheme) {
      appearance.set({ theme });
    },
    /**
     * Drives `context.clock` and the transport that reads it. `originMs` is the
     * local time at which bar 0 starts. The clock starts stopped at 120 BPM.
     */
    setClock(next: Partial<PlayClockSnapshot> & { originMs?: number }) {
      const { originMs, ...snapshot } = next;
      if (originMs !== undefined) clockOriginMs = originMs;
      changeClock(snapshot);
    },
    /** Nodes that told `context.clock` they are running. */
    runningNodes,
  };
}
