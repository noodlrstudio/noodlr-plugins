/**
 * The space's shared clock, which nodes that keep time follow. One tempo
 * belongs to the whole space; every client in a live room hears the same bar
 * at the same moment. Requires the `clock.follow` capability.
 *
 * Times are local `performance.now()` milliseconds, as in `context.song`.
 * Bars are 4/4. For beats in seconds on the `context.transport.now()`
 * timebase, use `transport.timeOfBeat` and `transport.beatAt`.
 */

export interface PlayClockSnapshot {
  /** True while the space's clock is running. */
  playing: boolean;
  /** The space's tempo, 40 to 240. */
  bpm: number;
  /** "everything" started every following node; "node" only one. */
  scope: "everything" | "node" | null;
  /** True when this node follows the space's tempo. */
  follows: boolean;
  /** This node's stored Own speed, when the host keeps it. */
  ownBpm: number | null;
  /** False for commenters and viewers: write calls do nothing. */
  canEdit: boolean;
}

export interface PlayClockApi {
  /** The same object until something it reports changes. */
  snapshot(): PlayClockSnapshot;
  subscribe(listener: (snapshot: PlayClockSnapshot) => void): () => void;
  /** The bar playing at `timeMs`, fractional; null while the clock is stopped. */
  barAt(timeMs: number): number | null;
  /** When `bar` starts; null while the clock is stopped. */
  timeOfBar(bar: number): number | null;
  /** The first bar line at least `leadMs` from now. */
  nextBar(leadMs?: number): { bar: number; atMs: number } | null;
  /** Starts the clock for this node alone when nothing is running. */
  start(): void;
  /** Stops the clock when this was the last node using it. */
  stopIfIdle(): void;
  /** Tell the clock whether this node is playing. Cleared when the node ends. */
  running(isRunning: boolean): void;
  /** True while the clock is shared with a live room. */
  isLive(): boolean;
  /** Editors only; returns whether the choice changed. */
  setFollow(follows: boolean): boolean;
  /** Editors only; 40 to 240. Keeps this node on its own speed. */
  setOwnBpm(bpm: number): boolean;
}
