import {
  getNoodlrPluginJsonByteSize,
  isNoodlrPluginJsonValue,
  type NoodlrPluginJsonValue,
} from "./plugin-json.js";
import { isSupportedMidi1ShortMessage } from "./plugin-midi.js";

export {
  getNoodlrPluginJsonByteSize,
  isNoodlrPluginJsonValue,
} from "./plugin-json.js";
export type {
  NoodlrPluginJsonPrimitive,
  NoodlrPluginJsonValue,
} from "./plugin-json.js";
export { isSupportedMidi1ShortMessage } from "./plugin-midi.js";

export const NOODLR_PLUGIN_CHANNEL = "noodlr:plugin" as const;
export const NOODLR_PLUGIN_PROTOCOL_VERSION = 2 as const;
export const MAX_NOODLR_PLUGIN_STATE_BYTES = 32 * 1024;

export interface NoodlrWebAppPluginPort {
  id: string;
  label: string;
  type: "midi";
  direction: "in" | "out";
}

export interface NoodlrWebAppPluginManifest {
  id: string;
  name: string;
  version: string;
  ports?: readonly NoodlrWebAppPluginPort[];
  features?: {
    runtimeControl?: boolean;
    transport?: boolean;
    state?: boolean;
  };
}

export interface NoodlrPluginMidiPacket {
  portId: string;
  data: readonly number[];
  timestamp?: number;
}

export interface NoodlrPluginRuntimeState {
  isEnabled: boolean;
  isMuted: boolean;
  isSoloed: boolean;
  isArmed: boolean;
  isAudible: boolean;
  shouldRecord: boolean;
}

export interface NoodlrPluginTransportSnapshot {
  state: "stopped" | "playing" | "paused";
  seconds: number;
  beat: number;
  bpm: number;
  audioTime: number;
  capturedAt: number;
}

export interface NoodlrPluginAppearance {
  theme: "dark" | "light";
  /** Resolved theme token values, keyed by token name (for example "surface-1"). */
  tokens: Record<string, string>;
  reducedMotion: boolean;
}

interface NoodlrPluginMessageBase {
  channel: typeof NOODLR_PLUGIN_CHANNEL;
  version: typeof NOODLR_PLUGIN_PROTOCOL_VERSION;
}

export type NoodlrHostToPluginMessage =
  | (NoodlrPluginMessageBase & {
      type: "handshake/request";
      nodeId: string;
      supportedVersions: readonly number[];
    })
  | (NoodlrPluginMessageBase & {
      type: "midi/message";
      nodeId: string;
      packet: NoodlrPluginMidiPacket;
    })
  | (NoodlrPluginMessageBase & {
      type: "runtime/state";
      nodeId: string;
      state: NoodlrPluginRuntimeState;
    })
  | (NoodlrPluginMessageBase & {
      type: "transport/state";
      nodeId: string;
      transport: NoodlrPluginTransportSnapshot;
    })
  | (NoodlrPluginMessageBase & {
      type: "appearance/state";
      nodeId: string;
      appearance: NoodlrPluginAppearance;
    })
  | (NoodlrPluginMessageBase & {
      type: "state/request";
      nodeId: string;
      requestId: string;
    })
  | (NoodlrPluginMessageBase & {
      type: "state/restore";
      nodeId: string;
      state: NoodlrPluginJsonValue;
    });

export type NoodlrPluginToHostMessage =
  | (NoodlrPluginMessageBase & {
      type: "handshake/ready";
      manifest: NoodlrWebAppPluginManifest;
    })
  | (NoodlrPluginMessageBase & {
      type: "midi/message";
      packet: NoodlrPluginMidiPacket;
    })
  | (NoodlrPluginMessageBase & {
      type: "state/update";
      requestId?: string;
      state: NoodlrPluginJsonValue;
    });

type MessageListener = (event: {
  data: unknown;
  source?: unknown;
  origin?: string;
}) => void;

export interface NoodlrWebAppBridgeEndpoint {
  addEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "message", listener: MessageListener): void;
  parent?: {
    postMessage(message: unknown, targetOrigin: string): void;
  } | null;
}

export interface CreateNoodlrWebAppBridgeOptions {
  manifest: NoodlrWebAppPluginManifest;
  endpoint?: NoodlrWebAppBridgeEndpoint;
  targetOrigin?: string;
  autoAnnounce?: boolean;
  onMidiMessage?: (packet: NoodlrPluginMidiPacket) => void;
  onRuntimeStateChange?: (state: NoodlrPluginRuntimeState) => void;
  onTransportChange?: (transport: NoodlrPluginTransportSnapshot) => void;
  getState?: () => NoodlrPluginJsonValue | Promise<NoodlrPluginJsonValue>;
  onRestoreState?: (state: NoodlrPluginJsonValue) => void;
  onAppearanceChange?: (appearance: NoodlrPluginAppearance) => void;
}

export interface NoodlrWebAppBridge {
  announceReady(): void;
  sendMidi(portId: string, data: readonly number[], timestamp?: number): void;
  updateState(state: NoodlrPluginJsonValue): void;
  destroy(): void;
}

const PORT_ID = /^[a-z][a-z0-9-]{0,63}$/;
const PLUGIN_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+){2,}$/;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeNoodlrPluginMidiPacket(
  value: unknown,
): NoodlrPluginMidiPacket | null {
  if (!isObject(value) || typeof value.portId !== "string") return null;
  if (!PORT_ID.test(value.portId) || !Array.isArray(value.data)) return null;
  if (!isSupportedMidi1ShortMessage(value.data as number[])) return null;
  if (
    value.timestamp !== undefined &&
    (typeof value.timestamp !== "number" || !Number.isFinite(value.timestamp))
  ) {
    return null;
  }
  return {
    portId: value.portId,
    data: [...(value.data as number[])],
    timestamp:
      typeof value.timestamp === "number" ? value.timestamp : undefined,
  };
}

export function sanitizeNoodlrWebAppPluginManifest(
  value: unknown,
): NoodlrWebAppPluginManifest | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string" || !PLUGIN_ID.test(value.id)) return null;
  if (typeof value.name !== "string" || !value.name.trim()) return null;
  if (value.name.length > 80) return null;
  if (typeof value.version !== "string" || !SEMVER.test(value.version)) {
    return null;
  }
  if (value.ports !== undefined && !Array.isArray(value.ports)) return null;
  const ports: NoodlrWebAppPluginPort[] = [];
  const ids = new Set<string>();
  for (const candidate of (value.ports ?? []) as unknown[]) {
    if (!isObject(candidate)) return null;
    if (typeof candidate.id !== "string" || !PORT_ID.test(candidate.id)) {
      return null;
    }
    if (ids.has(candidate.id) || ports.length >= 8) return null;
    if (
      typeof candidate.label !== "string" ||
      !candidate.label.trim() ||
      candidate.label.length > 64 ||
      candidate.type !== "midi" ||
      (candidate.direction !== "in" && candidate.direction !== "out")
    ) {
      return null;
    }
    ids.add(candidate.id);
    ports.push({
      id: candidate.id,
      label: candidate.label,
      type: "midi",
      direction: candidate.direction,
    });
  }
  const features = isObject(value.features)
    ? {
        runtimeControl: value.features.runtimeControl === true,
        transport: value.features.transport === true,
        state: value.features.state === true,
      }
    : undefined;
  return {
    id: value.id,
    name: value.name.trim(),
    version: value.version,
    ports,
    features,
  };
}

function sanitizeRuntimeState(value: unknown): NoodlrPluginRuntimeState | null {
  if (!isObject(value)) return null;
  const keys = [
    "isEnabled",
    "isMuted",
    "isSoloed",
    "isArmed",
    "isAudible",
    "shouldRecord",
  ] as const;
  if (keys.some((key) => typeof value[key] !== "boolean")) return null;
  return Object.fromEntries(
    keys.map((key) => [key, value[key]]),
  ) as unknown as NoodlrPluginRuntimeState;
}

const APPEARANCE_TOKEN_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_APPEARANCE_TOKENS = 64;
const MAX_APPEARANCE_TOKEN_LENGTH = 200;

function sanitizeAppearance(value: unknown): NoodlrPluginAppearance | null {
  if (!isObject(value)) return null;
  if (value.theme !== "dark" && value.theme !== "light") return null;
  if (typeof value.reducedMotion !== "boolean") return null;
  if (!isObject(value.tokens)) return null;
  const entries = Object.entries(value.tokens);
  if (entries.length > MAX_APPEARANCE_TOKENS) return null;
  const valid = entries.every(
    ([name, token]) =>
      APPEARANCE_TOKEN_NAME.test(name) &&
      typeof token === "string" &&
      token.length <= MAX_APPEARANCE_TOKEN_LENGTH,
  );
  if (!valid) return null;
  return {
    theme: value.theme,
    tokens: Object.fromEntries(entries) as Record<string, string>,
    reducedMotion: value.reducedMotion,
  };
}

function sanitizeTransport(
  value: unknown,
): NoodlrPluginTransportSnapshot | null {
  if (!isObject(value)) return null;
  if (!["stopped", "playing", "paused"].includes(String(value.state))) {
    return null;
  }
  const numeric = ["seconds", "beat", "bpm", "audioTime", "capturedAt"];
  if (
    numeric.some(
      (key) => typeof value[key] !== "number" || !Number.isFinite(value[key]),
    )
  ) {
    return null;
  }
  return value as unknown as NoodlrPluginTransportSnapshot;
}

export function parseNoodlrPluginToHostMessage(
  value: unknown,
): NoodlrPluginToHostMessage | null {
  if (!isObject(value)) return null;
  if (
    value.channel !== NOODLR_PLUGIN_CHANNEL ||
    value.version !== NOODLR_PLUGIN_PROTOCOL_VERSION
  ) {
    return null;
  }
  if (value.type === "handshake/ready") {
    const manifest = sanitizeNoodlrWebAppPluginManifest(value.manifest);
    return manifest
      ? ({ ...value, manifest } as NoodlrPluginToHostMessage)
      : null;
  }
  if (value.type === "midi/message") {
    const packet = sanitizeNoodlrPluginMidiPacket(value.packet);
    return packet ? ({ ...value, packet } as NoodlrPluginToHostMessage) : null;
  }
  if (value.type === "state/update") {
    if (
      value.requestId !== undefined &&
      (typeof value.requestId !== "string" || value.requestId.length > 128)
    )
      return null;
    if (!isNoodlrPluginJsonValue(value.state)) return null;
    if (
      getNoodlrPluginJsonByteSize(value.state) > MAX_NOODLR_PLUGIN_STATE_BYTES
    ) {
      return null;
    }
    return value as unknown as NoodlrPluginToHostMessage;
  }
  return null;
}

export function parseNoodlrHostToPluginMessage(
  value: unknown,
): NoodlrHostToPluginMessage | null {
  if (!isObject(value)) return null;
  if (
    value.channel !== NOODLR_PLUGIN_CHANNEL ||
    value.version !== NOODLR_PLUGIN_PROTOCOL_VERSION ||
    typeof value.nodeId !== "string"
  ) {
    return null;
  }
  if (value.type === "handshake/request") {
    if (
      !Array.isArray(value.supportedVersions) ||
      !value.supportedVersions.every(Number.isInteger) ||
      !value.supportedVersions.includes(NOODLR_PLUGIN_PROTOCOL_VERSION)
    ) {
      return null;
    }
    return value as unknown as NoodlrHostToPluginMessage;
  }
  if (value.type === "midi/message") {
    const packet = sanitizeNoodlrPluginMidiPacket(value.packet);
    return packet ? ({ ...value, packet } as NoodlrHostToPluginMessage) : null;
  }
  if (value.type === "runtime/state") {
    const state = sanitizeRuntimeState(value.state);
    return state ? ({ ...value, state } as NoodlrHostToPluginMessage) : null;
  }
  if (value.type === "transport/state") {
    const transport = sanitizeTransport(value.transport);
    return transport
      ? ({ ...value, transport } as NoodlrHostToPluginMessage)
      : null;
  }
  if (value.type === "appearance/state") {
    const appearance = sanitizeAppearance(value.appearance);
    return appearance
      ? ({ ...value, appearance } as NoodlrHostToPluginMessage)
      : null;
  }
  if (value.type === "state/request") {
    return typeof value.requestId === "string" && value.requestId.length <= 128
      ? (value as unknown as NoodlrHostToPluginMessage)
      : null;
  }
  if (value.type === "state/restore") {
    if (!isNoodlrPluginJsonValue(value.state)) return null;
    if (
      getNoodlrPluginJsonByteSize(value.state) > MAX_NOODLR_PLUGIN_STATE_BYTES
    ) {
      return null;
    }
    return value as unknown as NoodlrHostToPluginMessage;
  }
  return null;
}

export function createNoodlrPluginHandshakeRequest(
  nodeId: string,
): NoodlrHostToPluginMessage {
  return {
    channel: NOODLR_PLUGIN_CHANNEL,
    version: NOODLR_PLUGIN_PROTOCOL_VERSION,
    type: "handshake/request",
    nodeId,
    supportedVersions: [NOODLR_PLUGIN_PROTOCOL_VERSION],
  };
}

function defaultEndpoint(): NoodlrWebAppBridgeEndpoint {
  if (typeof window === "undefined") {
    throw new Error(
      "createNoodlrWebAppBridge must run inside a browser frame.",
    );
  }
  return window as unknown as NoodlrWebAppBridgeEndpoint;
}

function inferParentOrigin() {
  if (typeof document === "undefined" || !document.referrer) return "*";
  try {
    return new URL(document.referrer).origin;
  } catch {
    return "*";
  }
}

export function createNoodlrWebAppBridge(
  options: CreateNoodlrWebAppBridgeOptions,
): NoodlrWebAppBridge {
  const sanitizedManifest = sanitizeNoodlrWebAppPluginManifest(
    options.manifest,
  );
  if (!sanitizedManifest) {
    throw new TypeError("The Noodlr plugin manifest is invalid.");
  }
  const manifest: NoodlrWebAppPluginManifest = sanitizedManifest;
  const endpoint = options.endpoint ?? defaultEndpoint();
  const targetOrigin = options.targetOrigin ?? inferParentOrigin();
  const inputPorts = new Set(
    manifest.ports
      ?.filter((port) => port.direction === "in")
      .map((port) => port.id),
  );
  const outputPorts = new Set(
    manifest.ports
      ?.filter((port) => port.direction === "out")
      .map((port) => port.id),
  );
  let activeNodeId: string | null = null;
  let destroyed = false;

  function post(message: NoodlrPluginToHostMessage) {
    if (!destroyed) endpoint.parent?.postMessage(message, targetOrigin);
  }

  function announceReady() {
    post({
      channel: NOODLR_PLUGIN_CHANNEL,
      version: NOODLR_PLUGIN_PROTOCOL_VERSION,
      type: "handshake/ready",
      manifest,
    });
  }

  const listener: MessageListener = (event) => {
    if (
      endpoint.parent &&
      event.source !== undefined &&
      event.source !== endpoint.parent
    ) {
      return;
    }
    if (
      targetOrigin !== "*" &&
      event.origin !== undefined &&
      event.origin !== targetOrigin
    ) {
      return;
    }
    const message = parseNoodlrHostToPluginMessage(event.data);
    if (!message) return;
    if (message.type === "handshake/request") {
      activeNodeId = message.nodeId;
      if (options.autoAnnounce !== false) announceReady();
    } else if (message.nodeId !== activeNodeId) {
      return;
    } else if (message.type === "midi/message") {
      if (inputPorts.has(message.packet.portId))
        options.onMidiMessage?.(message.packet);
    } else if (message.type === "runtime/state") {
      if (manifest.features?.runtimeControl) {
        options.onRuntimeStateChange?.(message.state);
      }
    } else if (message.type === "transport/state") {
      if (manifest.features?.transport) {
        options.onTransportChange?.(message.transport);
      }
    } else if (message.type === "appearance/state") {
      options.onAppearanceChange?.(message.appearance);
    } else if (
      message.type === "state/request" &&
      manifest.features?.state &&
      options.getState
    ) {
      void Promise.resolve()
        .then(() => options.getState!())
        .then((state) => {
          if (
            isNoodlrPluginJsonValue(state) &&
            getNoodlrPluginJsonByteSize(state) <= MAX_NOODLR_PLUGIN_STATE_BYTES
          ) {
            post({
              channel: NOODLR_PLUGIN_CHANNEL,
              version: NOODLR_PLUGIN_PROTOCOL_VERSION,
              type: "state/update",
              requestId: message.requestId,
              state,
            });
          }
        })
        .catch(() => {});
    } else if (message.type === "state/restore" && manifest.features?.state) {
      options.onRestoreState?.(message.state);
    }
  };

  endpoint.addEventListener("message", listener);
  if (options.autoAnnounce !== false) announceReady();

  return {
    announceReady,
    sendMidi(portId, data, timestamp) {
      const packet = sanitizeNoodlrPluginMidiPacket({
        portId,
        data,
        timestamp,
      });
      if (!packet || !outputPorts.has(portId)) {
        throw new TypeError("The outbound Noodlr MIDI packet is invalid.");
      }
      post({
        channel: NOODLR_PLUGIN_CHANNEL,
        version: NOODLR_PLUGIN_PROTOCOL_VERSION,
        type: "midi/message",
        packet,
      });
    },
    updateState(state) {
      if (!manifest.features?.state) {
        throw new Error("The plugin did not declare state support.");
      }
      if (!isNoodlrPluginJsonValue(state)) {
        throw new TypeError("Noodlr plugin state must be JSON-safe.");
      }
      if (getNoodlrPluginJsonByteSize(state) > MAX_NOODLR_PLUGIN_STATE_BYTES) {
        throw new RangeError("Noodlr plugin state exceeds 32 KiB.");
      }
      post({
        channel: NOODLR_PLUGIN_CHANNEL,
        version: NOODLR_PLUGIN_PROTOCOL_VERSION,
        type: "state/update",
        state,
      });
    },
    destroy() {
      destroyed = true;
      endpoint.removeEventListener("message", listener);
    },
  };
}
