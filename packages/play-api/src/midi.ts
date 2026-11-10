export function clampMidi7Bit(value: number) {
  return Math.max(0, Math.min(127, Math.round(value)));
}

export function midiCcToUnit(value: number) {
  return clampMidi7Bit(value) / 127;
}

export function midiCcToRange(
  value: number,
  minimum: number,
  maximum: number,
  step?: number,
) {
  const scaled = minimum + midiCcToUnit(value) * (maximum - minimum);
  if (!step || step <= 0) return scaled;
  const stepped = Math.round((scaled - minimum) / step) * step + minimum;
  return Math.max(minimum, Math.min(maximum, Number(stepped.toFixed(8))));
}

export function midiCcToBoolean(value: number) {
  return clampMidi7Bit(value) >= 64;
}

export function midiCcToIndex(value: number, count: number) {
  const safeCount = Math.max(1, Math.round(count));
  return Math.min(safeCount - 1, Math.floor(midiCcToUnit(value) * safeCount));
}
