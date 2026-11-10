/**
 * The space's active song, which Play nodes follow. A song is made of parts
 * (Intro, Verse, Chorus…), each a few bars of chords, and plays either one
 * part on a loop or the whole arrangement. Every client in a live room hears
 * the same bar at the same moment.
 *
 * Times are local `performance.now()` milliseconds; convert to an
 * AudioContext time with `currentTime + (ms - performance.now()) / 1000`.
 * Songs play in 4/4 for now: a bar has 16 steps, and a split bar changes
 * chord at step 8.
 */

/** One chord, or two that split the bar in half. Stored spellings, e.g. "F#m7". */
export type PlaySongBar = readonly [string] | readonly [string, string];

export interface PlaySongPart {
  id: string;
  name: string;
  role: string;
  customRoleLabel: string | null;
  bars: readonly PlaySongBar[];
  /** True when a Song Sheet section is linked to this part. */
  linkedToSheet: boolean;
}

export interface PlaySongSlot {
  key: string;
  label: string;
  /** Null for a Song Sheet section with no part yet; it holds the last chord. */
  partId: string | null;
  repeats: number;
}

export interface PlayActiveSong {
  id: string;
  title: string;
  key: string | null;
  bpm: number;
  timeSignature: string;
  /** True when a linked Song Sheet supplies key, tempo or time. */
  fromSongSheet: boolean;
  parts: readonly PlaySongPart[];
  /** The order "Play song" follows. */
  slots: readonly PlaySongSlot[];
}

export type PlaySongMode = "loop-part" | "song";

export type PlaySongTarget = { partId: string } | { slotIndex: number };

export interface PlaySongPosition {
  bar: number;
  mode: PlaySongMode;
  partId: string | null;
  barInPart: number;
  barsInPart: number;
  slotIndex: number | null;
  slotRepeat: number;
  chords: PlaySongBar | null;
  /** True after the last slot of a song that doesn't loop. */
  ended: boolean;
}

export interface PlaySongQueued {
  target: PlaySongTarget;
  atBar: number;
}

export interface PlaySongPlayback {
  playing: boolean;
  bpm: number | null;
  /** The change waiting for its bar line, if any. */
  queued: PlaySongQueued | null;
}

export interface PlaySongSnapshot {
  /** False for commenters and viewers: write calls do nothing. */
  canEdit: boolean;
  songs: readonly { id: string; title: string }[];
  activeSongId: string | null;
  active: PlayActiveSong | null;
  playback: PlaySongPlayback;
}

export interface PlaySongPlayOptions {
  /** Song mode only: start again after the last slot. */
  loopSong?: boolean;
}

export interface PlaySongKeepPart {
  name?: string;
  role: string;
  customRoleLabel?: string | null;
  bars: readonly PlaySongBar[];
}

/** Durable edits to the space's songs; each is one undo step. Needs `song.write`. */
export interface PlaySongWriteApi {
  /** Adds a song and makes it active; returns its id, or null if refused. */
  createSong(title?: string): string | null;
  setActiveSong(songId: string): boolean;
  /** Written to the linked Song Sheet when there is one. */
  setTempo(bpm: number): boolean;
  /** Adds a part to the active song, creating "Untitled song" if there is none. */
  keepPart(part: PlaySongKeepPart): string | null;
  updatePartBars(partId: string, bars: readonly PlaySongBar[]): boolean;
  renamePart(
    partId: string,
    update: { name?: string; role?: string; customRoleLabel?: string | null },
  ): boolean;
  archivePart(partId: string): boolean;
}

export interface PlaySongApi {
  /** Needs `song.read`. */
  snapshot(): PlaySongSnapshot;
  subscribe(listener: (snapshot: PlaySongSnapshot) => void): () => void;
  /** When a bar starts, or null while stopped. */
  timeOfBar(bar: number): number | null;
  /** The fractional bar at a time, or null while stopped. */
  barAt(timeMs: number): number | null;
  position(timeMs?: number): PlaySongPosition | null;
  /** The chord at a step of a bar; null when nothing is playable. */
  chordAt(bar: number, step?: number): string | null;
  /** Needs `song.perform`. Starts playback, or queues if already playing. */
  play(target?: PlaySongTarget, options?: PlaySongPlayOptions): void;
  /** Lands at the end of the current part, or on the next bar line. */
  queue(
    target: PlaySongTarget,
    when: "part-end" | "next-bar",
    options?: PlaySongPlayOptions,
  ): void;
  stop(): void;
  readonly write: PlaySongWriteApi;
}
