/** Optional host integration for exclusive, consent-based live performance. */
export interface PlayPerformanceAdapter {
  typingNotes?: readonly number[];
  noteOn?(note: number, velocity: number): void | Promise<void>;
  noteOff?(note: number): void;
  trigger?(note: number, velocity: number): void | Promise<void>;
  transport?(command: "play" | "pause" | "stop"): void | Promise<void>;
  /** Immediately cancel pending work and silence sounding voices. */
  panic(): void;
}
export interface PlayPerformanceApi {
  readonly canPerform: boolean;
  readonly assigned: boolean;
  readonly canEdit: boolean;
  register(adapter: PlayPerformanceAdapter): () => void;
  activity(): void;
}
