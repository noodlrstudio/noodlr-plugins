export function isSupportedMidi1ShortMessage(data: readonly number[]) {
  if (data.length < 1 || data.length > 3) return false;
  if (
    !data.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    return false;
  }
  const status = data[0] ?? 0;
  if (status < 0x80 || status === 0xf0 || status === 0xf7) return false;
  if (data.slice(1).some((byte) => byte > 0x7f)) return false;
  if ([0xf8, 0xfa, 0xfb, 0xfc, 0xfe, 0xff].includes(status)) {
    return data.length === 1;
  }
  if (status === 0xf1 || status === 0xf3) return data.length === 2;
  if (status === 0xf2) return data.length === 3;
  if (status === 0xf6) return data.length === 1;
  const kind = status & 0xf0;
  if (kind === 0xc0 || kind === 0xd0) return data.length === 2;
  return status < 0xf0 && data.length === 3;
}
