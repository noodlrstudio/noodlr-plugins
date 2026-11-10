import { describe, expect, it } from "vitest";
import {
  createPlayNodeDefaults,
  createMockPlayNodeContext,
  definePlayNode,
  isPlayAssetReference,
  midiCcToBoolean,
  midiCcToIndex,
  midiCcToRange,
  migratePlayNodeState,
  PlayResourceScope,
  PlayNodeValidationError,
  validatePlayNodeManifest,
  validatePlayNodeState,
} from "./index";

const fields = {
  root: {
    type: "number",
    integer: true,
    minimum: 0,
    maximum: 127,
    default: 60,
    scope: "shared-persisted",
  },
  label: {
    type: "string",
    maxLength: 20,
    default: "C",
    scope: "local-ephemeral",
  },
} as const;

describe("Play API contracts", () => {
  it("validates a preview manifest", () => {
    expect(
      validatePlayNodeManifest({
        id: "xyz.noodlr.test-node",
        name: "Test Node",
        version: "0.1.0",
        apiVersion: "0",
        capabilities: ["midi.output"],
      }).id,
    ).toBe("xyz.noodlr.test-node");
  });

  it("declares bounded live performance and control surfaces", () => {
    expect(
      validatePlayNodeManifest({
        id: "xyz.noodlr.live-synth",
        name: "Live Synth",
        version: "0.1.0",
        apiVersion: "0",
        liveSession: { performance: ["midi", "transport"] },
      }).liveSession?.performance,
    ).toEqual(["midi", "transport"]);

    expect(() =>
      definePlayNode({
        manifest: {
          id: "xyz.noodlr.live-asset",
          name: "Unsafe Live Asset",
          version: "0.1.0",
          apiVersion: "0",
        },
        state: {
          version: 1,
          fields: {
            take: {
              type: "asset",
              default: null,
              scope: "shared-persisted",
              liveSessionEditable: true,
            },
          },
        },
        ports: [],
        view: (() => {}) as never,
      } as never),
    ).toThrow(PlayNodeValidationError);
  });

  it("fails closed for unknown capabilities", () => {
    expect(() =>
      validatePlayNodeManifest({
        id: "xyz.noodlr.test-node",
        name: "Test Node",
        version: "0.1.0",
        apiVersion: "0",
        capabilities: ["secrets.read"],
      }),
    ).toThrow(PlayNodeValidationError);
  });

  it("builds and validates defaults", () => {
    const defaults = createPlayNodeDefaults(fields);
    expect(defaults).toEqual({ root: 60, label: "C" });
    expect(validatePlayNodeState(fields, defaults)).toEqual(defaults);
  });

  it("runs sequential migrations and rejects missing steps", () => {
    expect(
      migratePlayNodeState(
        {
          version: 2,
          fields,
          migrations: {
            1: (state) => ({ ...state, root: 64 }),
          },
        },
        { root: 60, label: "C" },
        1,
      ),
    ).toMatchObject({ version: 2, migrated: true, state: { root: 64 } });

    expect(() =>
      migratePlayNodeState({ version: 2, fields }, { root: 60, label: "C" }, 1),
    ).toThrow(/migration is missing/i);
  });

  it("rejects unsupported state versions and oversized state", () => {
    expect(() =>
      migratePlayNodeState({ version: 1, fields }, { root: 60, label: "C" }, 2),
    ).toThrow(/newer state version/i);

    expect(() =>
      validatePlayNodeState(
        {
          payload: {
            type: "json",
            default: null,
            scope: "shared-persisted",
          },
        },
        { payload: "x".repeat(33 * 1024) },
      ),
    ).toThrow(/too large/i);
  });

  it("uses host-owned icon tokens", () => {
    expect(
      validatePlayNodeManifest({
        id: "xyz.noodlr.test-node",
        name: "Test Node",
        version: "0.1.0",
        apiVersion: "0",
        icon: "CassetteTape",
      }).icon,
    ).toBe("CassetteTape");
    expect(() =>
      validatePlayNodeManifest({
        id: "xyz.noodlr.test-node",
        name: "Test Node",
        version: "0.1.0",
        apiVersion: "0",
        icon: "RemotePackageIcon",
      }),
    ).toThrow(PlayNodeValidationError);
  });

  it("cleans tracked resources and aborts disposal", async () => {
    const lifecycle = new PlayResourceScope();
    const target = new EventTarget();
    let events = 0;
    let activationCleanups = 0;
    lifecycle.listen(target, "ping", () => {
      events += 1;
    });
    lifecycle.onActivate(() => () => {
      activationCleanups += 1;
    });
    lifecycle.activate();
    target.dispatchEvent(new Event("ping"));
    await lifecycle.dispose();
    target.dispatchEvent(new Event("ping"));

    expect(events).toBe(1);
    expect(activationCleanups).toBe(1);
    expect(lifecycle.signal.aborted).toBe(true);
  });

  it("provides mock state, capability, MIDI, and diagnostics utilities", () => {
    const mock = createMockPlayNodeContext({ enabled: true }, ["midi.output"]);
    mock.context.state.set("enabled", false);
    mock.context.midi.output("notes").noteOn(60);
    const trigger = mock.context.midi.trigger({
      id: "record",
      label: "Record",
      apply: () => {},
    });
    mock.context.diagnostics.report({
      level: "info",
      code: "test",
      message: "Ready",
    });

    expect(mock.context.state.get("enabled")).toBe(false);
    expect(mock.midiEvents).toHaveLength(1);
    expect(trigger.id).toBe("record");
    expect(trigger.attach({} as HTMLElement)).toBeTypeOf("function");
    expect(mock.diagnostics).toHaveLength(1);
    expect(() => mock.context.requireCapability("network.fetch")).toThrow(
      /not declared/i,
    );
  });

  it("scales MIDI CC values for ranges, switches, and choices", () => {
    expect(midiCcToRange(0, 20, 10_000)).toBe(20);
    expect(midiCcToRange(127, 20, 10_000)).toBe(10_000);
    expect(midiCcToRange(64, 0, 1, 0.1)).toBe(0.5);
    expect(midiCcToBoolean(63)).toBe(false);
    expect(midiCcToBoolean(64)).toBe(true);
    expect(midiCcToIndex(127, 4)).toBe(3);
  });

  it("accepts local-persisted state, richer ports, and asset fields", () => {
    const definition = definePlayNode({
      manifest: {
        id: "dev.noodlr.runtime-test",
        name: "Runtime Test",
        version: "0.1.0",
        apiVersion: "0",
        capabilities: [
          "midi.device-output",
          "audio.input",
          "audio.decode",
          "mixer.read",
          "network.fetch",
          "microphone.input",
          "asset.read",
        ],
      },
      state: {
        version: 1,
        fields: {
          deviceId: {
            type: "string",
            default: "",
            scope: "local-persisted",
          },
          asset: {
            type: "asset",
            default: null,
            scope: "shared-persisted",
          },
        },
      },
      ports: [
        {
          id: "messages",
          type: "midi.messages",
          label: "Messages",
          direction: "out",
        },
        {
          id: "audio-in",
          type: "audio",
          label: "Audio",
          direction: "in",
        },
      ],
      view: (() => {}) as never,
    });
    expect(definition.ports?.map((port) => port.type)).toEqual([
      "midi.messages",
      "audio",
    ]);
  });

  it("validates opaque Play asset references", () => {
    expect(
      isPlayAssetReference({
        id: "asset-1",
        name: "loop.wav",
        mimeType: "audio/wav",
        byteSize: 128,
        createdAt: "2026-07-03T12:00:00.000Z",
        storage: {
          id: "asset-1",
          kind: "browser_cache",
          storageKey: "asset-1",
          syncPolicy: "metadata_synced",
        },
      }),
    ).toBe(true);
    expect(isPlayAssetReference({ id: "asset-1" })).toBe(false);
  });

  it("mirrors the host frame rules in the mock context", () => {
    const mock = createMockPlayNodeContext({}, [], {
      frame: {
        ports: [{ id: "in-a" }, { id: "in-b" }, { id: "out" }],
        size: { width: 400, height: 300 },
        minimumSize: { width: 336, height: 460 },
      },
    });
    const frame = mock.context.frame!;
    expect(frame.size).toEqual({ width: 400, height: 300 });
    frame.setSize({ width: 100, height: 100 });
    expect(frame.size).toEqual({ width: 336, height: 460 });

    mock.connect("in-b");
    expect(frame.connectedPortIds()).toEqual(["in-b"]);
    expect(frame.setActivePorts(["out", "in-a", "nope"])).toEqual([
      "in-a",
      "in-b",
      "out",
    ]);
    let ran = false;
    frame.batch("Remove Looper Loop", () => {
      ran = true;
      expect(frame.setActivePorts(["out"], { disconnect: true })).toEqual([
        "out",
      ]);
    });
    expect(ran).toBe(true);
    expect(frame.connectedPortIds()).toEqual([]);
    expect(mock.frameHistory).toEqual(["Remove Looper Loop"]);
  });

  it("models a frame that will not take writes", () => {
    const mock = createMockPlayNodeContext({}, [], {
      frame: { ports: [{ id: "in" }, { id: "out" }], writable: false },
    });
    const frame = mock.context.frame!;
    expect(frame.writable).toBe(false);
    frame.setSize({ width: 900, height: 900 });
    expect(frame.size).toEqual({ width: 300, height: 260 });
    expect(frame.setActivePorts(["out"])).toEqual(["in", "out"]);
    let ran = false;
    frame.batch("Add Loop", () => {
      ran = true;
    });
    expect(ran).toBe(false);
    expect(mock.frameHistory).toEqual([]);
    mock.setFrameWritable(true);
    expect(frame.writable).toBe(true);
    expect(frame.setActivePorts(["out"])).toEqual(["out"]);
  });

  it("keeps cabled ports outside a batch, like the host", () => {
    const mock = createMockPlayNodeContext({}, [], {
      frame: { ports: [{ id: "in-a" }, { id: "in-b" }, { id: "out" }] },
    });
    const frame = mock.context.frame!;
    mock.connect("in-a");
    // Outside a batch nothing is disconnected, even when asked.
    expect(frame.setActivePorts(["out"], { disconnect: true })).toEqual([
      "in-a",
      "out",
    ]);
    expect(frame.connectedPortIds()).toEqual(["in-a"]);
    // A cable removed elsewhere is kept for its undo, so its port stays.
    mock.connect("in-b");
    mock.disconnect("in-b");
    expect(frame.setActivePorts(["out"])).toEqual(["in-a", "in-b", "out"]);
    // Inside a batch, a port with only a removed cable can go.
    frame.batch("Remove Looper Loop", () => {
      expect(frame.setActivePorts(["in-a", "out"])).toEqual(["in-a", "out"]);
    });
    expect(frame.setActivePorts(["out"])).toEqual(["in-a", "out"]);
  });

  it("reports active ports and models a cable removed elsewhere", () => {
    const mock = createMockPlayNodeContext({}, [], {
      frame: {
        ports: [{ id: "in-a" }, { id: "in-b" }, { id: "out" }],
        activePorts: ["in-a", "out"],
      },
    });
    const frame = mock.context.frame!;
    expect(frame.activePortIds()).toEqual(["in-a", "out"]);
    frame.setActivePorts(["in-a", "in-b", "out"]);
    expect(frame.activePortIds()).toEqual(["in-a", "in-b", "out"]);
    mock.connect("in-b");
    mock.disconnect("in-b");
    expect(frame.connectedPortIds()).toEqual([]);
    // Removing a cable leaves the port shown.
    expect(frame.activePortIds()).toEqual(["in-a", "in-b", "out"]);
  });

  it("accepts an initialFrame hook on a definition", () => {
    const definition = definePlayNode({
      manifest: {
        id: "dev.noodlr.initial-frame",
        name: "Initial Frame",
        version: "0.1.0",
        apiVersion: "0",
      },
      state: {
        version: 1,
        fields: {
          loops: {
            type: "number",
            integer: true,
            minimum: 1,
            maximum: 2,
            default: 1,
            scope: "shared-persisted",
          },
        },
      },
      ports: [
        { id: "in-1", type: "audio", label: "In 1", direction: "in" },
        { id: "in-2", type: "audio", label: "In 2", direction: "in" },
      ],
      initialFrame: (state) => ({
        size: { width: 200 * Number(state.loops), height: 100 },
        activePortIds: Number(state.loops) > 1 ? ["in-1", "in-2"] : ["in-1"],
      }),
      view: (() => {}) as never,
    });
    expect(definition.initialFrame?.({ loops: 2 })).toEqual({
      size: { width: 400, height: 100 },
      activePortIds: ["in-1", "in-2"],
    });
  });

  it("can model a host that omits the frame API", () => {
    const mock = createMockPlayNodeContext({}, [], { frame: false });
    expect(mock.context.frame).toBeUndefined();
    expect(createMockPlayNodeContext({}).context.frame).toBeDefined();
  });

  it("accepts the clock.follow capability", () => {
    expect(
      validatePlayNodeManifest({
        id: "com.example.clocked",
        name: "Clocked",
        version: "1.0.0",
        apiVersion: "0",
        capabilities: ["clock.follow", "transport.read"],
      }).capabilities,
    ).toEqual(["clock.follow", "transport.read"]);
  });

  it("gives the mock context a clock the test can drive", () => {
    const { context, setClock, runningNodes } = createMockPlayNodeContext({}, [
      "clock.follow",
      "transport.read",
    ]);
    const clock = context.clock!;
    expect(clock.snapshot()).toEqual({
      playing: false,
      bpm: 120,
      scope: null,
      follows: false,
      ownBpm: null,
      canEdit: true,
    });
    expect(clock.barAt(1_000)).toBeNull();
    expect(context.transport.timeOfBeat(4)).toBeNull();

    const bpms: number[] = [];
    clock.subscribe((snapshot) => bpms.push(snapshot.bpm));
    setClock({ playing: true, bpm: 96, originMs: 250 });
    expect(bpms).toEqual([120, 96]);
    expect(context.transport.snapshot()).toMatchObject({
      state: "playing",
      bpm: 96,
    });
    // Four beats at 96 BPM is one bar, 2.5 s after the 250 ms origin.
    expect(context.transport.timeOfBeat(4)).toBeCloseTo(2.75);
    expect(context.transport.beatAt(2.75)).toBeCloseTo(4);

    clock.running(true);
    clock.stopIfIdle();
    expect(clock.snapshot().playing).toBe(true);
    expect(runningNodes.has("play-node-test")).toBe(true);
    clock.running(false);
    clock.stopIfIdle();
    expect(clock.snapshot().playing).toBe(false);
  });

  it("refuses mock clock writes when the person cannot edit", () => {
    const { context, setClock } = createMockPlayNodeContext({});
    setClock({ canEdit: false });
    expect(context.clock!.setFollow(true)).toBe(false);
    expect(context.clock!.setOwnBpm(100)).toBe(false);
    setClock({ canEdit: true });
    expect(context.clock!.setOwnBpm(999)).toBe(true);
    expect(context.clock!.snapshot()).toMatchObject({
      follows: false,
      ownBpm: 240,
    });
  });
});
