import { describe, expect, it } from "vitest";
import {
  createNoodlrPluginHandshakeRequest,
  createNoodlrWebAppBridge,
  isSupportedMidi1ShortMessage,
  parseNoodlrHostToPluginMessage,
  parseNoodlrPluginToHostMessage,
} from "./web-app";

function fixture() {
  const sent: unknown[] = [];
  const parent = { postMessage: (message: unknown) => sent.push(message) };
  let listener:
    | ((event: { data: unknown; source?: unknown; origin?: string }) => void)
    | null = null;
  return {
    sent,
    parent,
    endpoint: {
      parent,
      addEventListener: (_type: "message", next: typeof listener) => {
        listener = next;
      },
      removeEventListener: (_type: "message", next: typeof listener) => {
        if (listener === next) listener = null;
      },
    },
    emit(
      data: unknown,
      source: unknown = parent,
      origin = "https://noodlr.test",
    ) {
      listener?.({ data, source, origin });
    },
  };
}

describe("Noodlr web app bridge", () => {
  it("validates MIDI 1 short messages without accepting SysEx", () => {
    for (const packet of [
      [0x80, 60, 32],
      [0x90, 60, 100],
      [0xa0, 60, 50],
      [0xb0, 1, 127],
      [0xc0, 5],
      [0xd0, 80],
      [0xe0, 0, 64],
      [0xf1, 1],
      [0xf2, 1, 2],
      [0xf6],
      [0xf8],
    ])
      expect(isSupportedMidi1ShortMessage(packet)).toBe(true);
    expect(isSupportedMidi1ShortMessage([0xf0, 1, 0xf7])).toBe(false);
    expect(isSupportedMidi1ShortMessage([0xc0, 5, 6])).toBe(false);
    expect(isSupportedMidi1ShortMessage([0xf9])).toBe(false);
  });

  it("announces, checks source/origin, routes named ports, state, and teardown", () => {
    const frame = fixture();
    const midi: unknown[] = [];
    const restored: unknown[] = [];
    const runtime: unknown[] = [];
    const transport: unknown[] = [];
    const bridge = createNoodlrWebAppBridge({
      endpoint: frame.endpoint,
      targetOrigin: "https://noodlr.test",
      manifest: {
        id: "fun.ypc2000.bridge-demo",
        name: "Bridge Demo",
        version: "1.0.0",
        ports: [
          { id: "notes-in", label: "Notes", type: "midi", direction: "in" },
          { id: "notes-out", label: "Notes", type: "midi", direction: "out" },
        ],
        features: { runtimeControl: true, transport: true, state: true },
      },
      onMidiMessage: (packet) => midi.push(packet),
      onRestoreState: (state) => restored.push(state),
      onRuntimeStateChange: (state) => runtime.push(state),
      onTransportChange: (state) => transport.push(state),
    });
    expect(frame.sent).toHaveLength(1);

    const request = createNoodlrPluginHandshakeRequest("node-1");
    frame.emit(request, {}, "https://noodlr.test");
    frame.emit(request, frame.parent, "https://evil.test");
    expect(frame.sent).toHaveLength(1);
    frame.emit(request);
    expect(frame.sent).toHaveLength(2);

    frame.emit({
      channel: "noodlr:plugin",
      version: 2,
      type: "midi/message",
      nodeId: "node-1",
      packet: { portId: "notes-in", data: [0xe0, 0, 64] },
    });
    frame.emit({
      channel: "noodlr:plugin",
      version: 2,
      type: "midi/message",
      nodeId: "another-node",
      packet: { portId: "notes-in", data: [0x90, 60, 100] },
    });
    frame.emit({
      channel: "noodlr:plugin",
      version: 2,
      type: "state/restore",
      nodeId: "node-1",
      state: { bank: 2 },
    });
    frame.emit({
      channel: "noodlr:plugin",
      version: 2,
      type: "runtime/state",
      nodeId: "node-1",
      state: {
        isEnabled: true,
        isMuted: false,
        isSoloed: false,
        isArmed: true,
        isAudible: true,
        shouldRecord: true,
      },
    });
    frame.emit({
      channel: "noodlr:plugin",
      version: 2,
      type: "transport/state",
      nodeId: "node-1",
      transport: {
        state: "playing",
        seconds: 1,
        beat: 2,
        bpm: 120,
        audioTime: 3,
        capturedAt: 4,
      },
    });
    expect(midi).toHaveLength(1);
    expect(restored).toEqual([{ bank: 2 }]);
    expect(runtime).toHaveLength(1);
    expect(transport).toHaveLength(1);

    bridge.sendMidi("notes-out", [0xd0, 80]);
    bridge.updateState({ bank: 3 });
    expect(frame.sent).toHaveLength(4);
    bridge.destroy();
    frame.emit(request);
    expect(frame.sent).toHaveLength(4);
  });

  it("rejects malformed and oversized messages", () => {
    expect(
      parseNoodlrPluginToHostMessage({
        channel: "noodlr:plugin",
        version: 2,
        type: "midi/message",
        packet: { portId: "out", data: [0x90, 200, 1] },
      }),
    ).toBeNull();
    expect(
      parseNoodlrPluginToHostMessage({
        channel: "noodlr:plugin",
        version: 2,
        type: "state/update",
        state: { value: "x".repeat(33_000) },
      }),
    ).toBeNull();
    expect(
      parseNoodlrPluginToHostMessage({
        channel: "noodlr:plugin",
        version: 99,
        type: "state/update",
        state: {},
      }),
    ).toBeNull();
    expect(
      parseNoodlrHostToPluginMessage({
        channel: "noodlr:plugin",
        version: 2,
        type: "state/restore",
        nodeId: "node-1",
        state: { value: "x".repeat(33_000) },
      }),
    ).toBeNull();
    expect(
      parseNoodlrHostToPluginMessage({
        channel: "noodlr:plugin",
        version: 2,
        type: "handshake/request",
        nodeId: "node-1",
        supportedVersions: [3],
      }),
    ).toBeNull();

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      parseNoodlrPluginToHostMessage({
        channel: "noodlr:plugin",
        version: 2,
        type: "state/update",
        state: cyclic,
      }),
    ).toBeNull();
  });
});

describe("appearance/state", () => {
  const message = (appearance: unknown) => ({
    channel: "noodlr:plugin",
    version: 2,
    type: "appearance/state",
    nodeId: "node-1",
    appearance,
  });

  it("parses a valid appearance message", () => {
    const parsed = parseNoodlrHostToPluginMessage(
      message({
        theme: "light",
        tokens: { "surface-1": "#ffffff" },
        reducedMotion: false,
      }),
    );
    expect(parsed?.type).toBe("appearance/state");
  });

  it.each([
    { theme: "purple", tokens: {}, reducedMotion: false },
    { theme: "light", tokens: { "Bad Key": "#fff" }, reducedMotion: false },
    { theme: "light", tokens: { ok: "x".repeat(201) }, reducedMotion: false },
    { theme: "light", tokens: { ok: 3 }, reducedMotion: false },
    { theme: "light", tokens: {}, reducedMotion: "no" },
    { theme: "light", tokens: [], reducedMotion: false },
    null,
  ])("rejects malformed appearance %#", (appearance) => {
    expect(parseNoodlrHostToPluginMessage(message(appearance))).toBeNull();
  });

  it("rejects more than 64 tokens", () => {
    const tokens = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`t${index}`, "#000000"]),
    );
    expect(
      parseNoodlrHostToPluginMessage(
        message({ theme: "dark", tokens, reducedMotion: false }),
      ),
    ).toBeNull();
  });

  it("delivers appearance to onAppearanceChange after the handshake", () => {
    const frame = fixture();
    const seen: unknown[] = [];
    createNoodlrWebAppBridge({
      endpoint: frame.endpoint,
      targetOrigin: "https://noodlr.test",
      manifest: {
        id: "fun.ypc2000.bridge-demo",
        name: "Bridge Demo",
        version: "1.0.0",
        ports: [],
      },
      onAppearanceChange: (appearance) => seen.push(appearance),
    });
    frame.emit(createNoodlrPluginHandshakeRequest("node-1"));
    frame.emit(
      message({
        theme: "light",
        tokens: { accent: "#007a5c" },
        reducedMotion: true,
      }),
    );
    frame.emit(message({ theme: "purple", tokens: {}, reducedMotion: false }));

    expect(seen).toEqual([
      { theme: "light", tokens: { accent: "#007a5c" }, reducedMotion: true },
    ]);
  });
});

describe("correlated plugin snapshots", () => {
  it("captures state from the trusted parent and correlates the reply", async () => {
    const frame = fixture();
    const bridge = createNoodlrWebAppBridge({
      endpoint: frame.endpoint,
      targetOrigin: "https://noodlr.test",
      manifest: {
        id: "co.uk.5of12.pulse",
        name: "Pulse",
        version: "1.0.0",
        features: { state: true },
      },
      getState: async () => ({ schemaVersion: 1, pattern: [1, 0, 1] }),
    });
    frame.emit(createNoodlrPluginHandshakeRequest("pulse"));
    const request = {
      channel: "noodlr:plugin",
      version: 2,
      type: "state/request",
      nodeId: "pulse",
      requestId: "snapshot-1",
    };
    frame.emit(request, frame.parent, "https://evil.test");
    frame.emit(request);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(frame.sent.at(-1)).toMatchObject({
      type: "state/update",
      requestId: "snapshot-1",
      state: { pattern: [1, 0, 1] },
    });
    bridge.destroy();
  });
});
