export type NoodlrPluginJsonPrimitive = string | number | boolean | null;
export type NoodlrPluginJsonValue =
  | NoodlrPluginJsonPrimitive
  | NoodlrPluginJsonValue[]
  | { [key: string]: NoodlrPluginJsonValue };

export function isNoodlrPluginJsonValue(
  value: unknown,
): value is NoodlrPluginJsonValue {
  const pending: Array<{ value: unknown; depth: number }> = [
    { value, depth: 0 },
  ];
  const seen = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    const candidate = current.value;
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "boolean"
    ) {
      continue;
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) continue;
    if (typeof candidate !== "object" || current.depth >= 64) return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    if (!Array.isArray(candidate)) {
      const prototype = Object.getPrototypeOf(candidate);
      if (prototype !== Object.prototype && prototype !== null) return false;
    }
    for (const child of Object.values(candidate)) {
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return true;
}

export function getNoodlrPluginJsonByteSize(value: NoodlrPluginJsonValue) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
