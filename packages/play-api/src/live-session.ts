import type { PlayMidiMessage } from "./types";

/**
 * Live-session performance for nodes that declare
 * `liveSession.performance: ["midi"]`. Events played on the node itself, such
 * as on-screen keys or pads, are shared with the room while the local user
 * holds the node; everyone else receives them through `subscribe` and renders
 * them locally.
 */
export interface PlayMidiLiveApi {
  share(message: PlayMidiMessage): void;
  subscribe(listener: (message: PlayMidiMessage) => void): () => void;
}

/** A step sequencer's exact cursor, carried to late joiners. */
export interface PlayLiveTransportPhase {
  tick: number;
  step: number;
  /** Milliseconds from the command's start moment until `step` fires. */
  offsetMs: number;
  /** Node-defined section (e.g. drum pattern) active at `step`. */
  section?: number;
}

export interface PlayLiveTransportCommand {
  targetId?: string;
  command: "play" | "pause" | "stop" | "seek";
  positionSeconds: number;
  /** Milliseconds until every participant applies the command together. */
  delayMs: number;
  /** Present on late-join snapshots from nodes that report a phase. */
  phase?: PlayLiveTransportPhase;
}

/**
 * Room-synchronised start/stop for nodes that declare
 * `liveSession.performance: ["transport"]`. Every participant, including the
 * sender, applies a command through `subscribe` at the same scheduled moment.
 */
export interface PlayLiveTransportApi {
  /** Returns false outside a live session; the node then acts locally. */
  request(
    command: PlayLiveTransportCommand["command"],
    positionSeconds?: number,
    targetId?: string,
  ): boolean;
  subscribe(
    listener: (command: PlayLiveTransportCommand) => void,
    cancel?: () => void,
  ): () => void;
  /**
   * Report the node's cursor at a `performance.now()` time, or null when it is
   * not playing, so late joiners resume on the same step.
   */
  providePhase(
    provider: (atMs: number) => PlayLiveTransportPhase | null,
  ): () => void;
}
