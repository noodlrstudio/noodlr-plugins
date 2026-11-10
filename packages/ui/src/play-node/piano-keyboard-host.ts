import type { Readable } from "svelte/store";

/**
 * Context key a host (such as a board node window) provides so the
 * keyboards inside it can be played from somewhere else, like a phone dock.
 * `Symbol.for` keeps the key identical across package boundaries.
 */
export const PIANO_KEYBOARD_HOST = Symbol.for("noodlr.piano-keyboard-host");

export type PianoNoteHandler = (
  note: number,
  event?: PointerEvent,
) => void | Promise<void>;

export interface PianoKeyboardState {
  startNote: number;
  keyCount: number;
  activeNotes: readonly number[];
  disabled: boolean;
  onNoteOn: PianoNoteHandler;
  onNoteOff: PianoNoteHandler;
}

/**
 * Desktop keyboard shelf: "available" offers to move the keyboard there, and
 * "holding" means the shelf plays it now, so the node shows where it went.
 */
export type PianoShelfPlacement = "off" | "available" | "holding";

export interface PianoKeyboardBinding {
  /** True while the host plays this keyboard elsewhere; the keyboard hides. */
  docked: Readable<boolean>;
  shelf?: Readable<PianoShelfPlacement>;
  moveToShelf?(): void;
  bringBackFromShelf?(): void;
  update(state: PianoKeyboardState): void;
  release(): void;
}

export interface PianoKeyboardHost {
  attach(state: PianoKeyboardState): PianoKeyboardBinding;
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function isBlackPianoNote(note: number) {
  return BLACK_PITCH_CLASSES.has(((note % 12) + 12) % 12);
}

/** Octave numbering follows the common C4 = middle C (MIDI 60). */
export function pianoNoteOctave(note: number) {
  return Math.floor(note / 12) - 1;
}

/**
 * Tracks which notes are held by which pointers (fingers, mouse, keys), so
 * two fingers on one key sound once and release only when both lift.
 */
export class HeldPianoNotes {
  private notesBySource = new Map<string, number>();

  get notes() {
    return [...new Set(this.notesBySource.values())];
  }

  noteFor(source: string) {
    return this.notesBySource.get(source) ?? null;
  }

  /** Returns true when the note was not already sounding. */
  press(source: string, note: number) {
    const sounding = this.isSounding(note);
    this.notesBySource.set(source, note);
    return !sounding;
  }

  /** Returns the note to release, or null while another source holds it. */
  release(source: string) {
    const note = this.notesBySource.get(source);
    if (note === undefined) return null;
    this.notesBySource.delete(source);
    return this.isSounding(note) ? null : note;
  }

  releaseAll() {
    const notes = this.notes;
    this.notesBySource.clear();
    return notes;
  }

  private isSounding(note: number) {
    for (const held of this.notesBySource.values()) {
      if (held === note) return true;
    }
    return false;
  }
}
