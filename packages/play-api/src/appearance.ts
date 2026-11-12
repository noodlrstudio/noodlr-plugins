export const PLAY_APPEARANCE_THEMES = ["dark", "light"] as const;
export type PlayAppearanceTheme = (typeof PLAY_APPEARANCE_THEMES)[number];

export const PLAY_APPEARANCE_TOKENS = [
  "surface-canvas",
  "surface-1",
  "surface-2",
  "surface-3",
  "surface-inset",
  "text-primary",
  "text-secondary",
  "text-tertiary",
  "text-on-accent",
  "text-on-record",
  "border",
  "border-strong",
  "accent",
  "accent-soft",
  "selection",
  "focus-ring",
  "positive",
  "warning",
  "danger",
  "record",
  "midi-learn",
  "shadow-1",
  "shadow-2",
  "shadow-3",
  "shadow-control",
  "shadow-color",
  "key-white",
  "key-black",
  "key-pressed",
  "paper",
  "ink",
  "hue-red",
  "hue-coral",
  "hue-orange",
  "hue-amber",
  "hue-gold",
  "hue-green",
  "hue-mint",
  "hue-sky",
  "hue-blue",
  "hue-violet",
  "hue-purple",
  "hue-pink",
  "font-sans",
  "font-mono",
  "radius-s",
  "radius-m",
  "radius-l",
] as const;
export type PlayAppearanceToken = (typeof PLAY_APPEARANCE_TOKENS)[number];

export type PlayAppearancePalette = Readonly<
  Record<PlayAppearanceToken, string>
>;

const SHARED_TOKENS = {
  "font-sans": '"SF Pro Display", "Avenir Next", "Segoe UI", sans-serif',
  "font-mono": '"SF Mono", "IBM Plex Mono", "Menlo", monospace',
  "radius-s": "0.35rem",
  "radius-m": "0.6rem",
  "radius-l": "0.9rem",
} as const;

export const PLAY_APPEARANCE_PALETTES: Readonly<
  Record<PlayAppearanceTheme, PlayAppearancePalette>
> = Object.freeze({
  dark: Object.freeze({
    "surface-canvas": "#0c0c0f",
    "surface-1": "#151518",
    "surface-2": "#222229",
    "surface-3": "#2a2a30",
    "surface-inset": "#101013",
    "text-primary": "#f1f2f4",
    "text-secondary": "#b9bbc2",
    "text-tertiary": "#93969e",
    "text-on-accent": "#06110e",
    "text-on-record": "#ffffff",
    border: "rgba(255, 255, 255, 0.08)",
    "border-strong": "#6b6f7a",
    accent: "#00d19b",
    "accent-soft": "rgba(0, 209, 155, 0.16)",
    selection: "#f4c64b",
    "focus-ring": "#7a70ff",
    positive: "#61e7bd",
    warning: "#f7d676",
    danger: "#ff8383",
    record: "#ef4444",
    "midi-learn": "#8e5cff",
    "shadow-1": "0 1px 2px rgba(0, 0, 0, 0.4)",
    "shadow-2": "0 28px 44px rgba(0, 0, 0, 0.36)",
    "shadow-3": "0 36px 60px rgba(0, 0, 0, 0.46)",
    "shadow-control": "0 9px 16px rgba(0, 0, 0, 0.3)",
    "shadow-color": "#000000",
    "key-white": "#f6f6f7",
    "key-black": "#1b1b20",
    "key-pressed": "#00d19b",
    paper: "#f9f5e4",
    ink: "#231f18",
    "hue-red": "#ff6363",
    "hue-coral": "#ff8652",
    "hue-orange": "#ffb253",
    "hue-amber": "#f4c64b",
    "hue-gold": "#d5b66f",
    "hue-green": "#78c17f",
    "hue-mint": "#52e2b8",
    "hue-sky": "#5fd8ff",
    "hue-blue": "#53a7ff",
    "hue-violet": "#8b82ff",
    "hue-purple": "#b07cff",
    "hue-pink": "#ff7fbf",
    ...SHARED_TOKENS,
  }),
  // Light is a soft studio grey rather than paper white, in the spirit of
  // Ableton Live's default theme: cards sit a step lighter than the board,
  // controls a step darker than their card, and wells are the lightest.
  light: Object.freeze({
    "surface-canvas": "#c5c6c9",
    "surface-1": "#dddee1",
    "surface-2": "#d2d3d6",
    "surface-3": "#c8c9cd",
    "surface-inset": "#e8e8ea",
    "text-primary": "#17181b",
    "text-secondary": "#3b3d42",
    "text-tertiary": "#505258",
    "text-on-accent": "#ffffff",
    "text-on-record": "#ffffff",
    border: "rgba(0, 0, 0, 0.12)",
    "border-strong": "#6c6e75",
    accent: "#00704f",
    "accent-soft": "rgba(0, 112, 79, 0.14)",
    selection: "#8f5f00",
    "focus-ring": "#4d42d6",
    positive: "#03492f",
    warning: "#523800",
    danger: "#761414",
    record: "#c62424",
    "midi-learn": "#5a32c8",
    "shadow-1": "0 1px 2px rgba(0, 0, 0, 0.14)",
    "shadow-2": "0 10px 26px rgba(20, 22, 30, 0.16)",
    "shadow-3": "0 20px 40px rgba(20, 22, 30, 0.22)",
    "shadow-control": "0 3px 8px rgba(20, 22, 30, 0.16)",
    "shadow-color": "rgba(20, 22, 30, 0.5)",
    "key-white": "#f1f1f2",
    "key-black": "#1f2023",
    "key-pressed": "#00704f",
    paper: "#f1ecda",
    ink: "#231f18",
    "hue-red": "#a8231d",
    "hue-coral": "#9c3f16",
    "hue-orange": "#8a4f08",
    "hue-amber": "#7f5800",
    "hue-gold": "#6e572a",
    "hue-green": "#2b6532",
    "hue-mint": "#0a664b",
    "hue-sky": "#085f7d",
    "hue-blue": "#1c58ab",
    "hue-violet": "#4a40c4",
    "hue-purple": "#6232ad",
    "hue-pink": "#9c2b63",
    ...SHARED_TOKENS,
  }),
});

export function isPlayAppearanceTheme(
  value: unknown,
): value is PlayAppearanceTheme {
  return (PLAY_APPEARANCE_THEMES as readonly unknown[]).includes(value);
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function relativeLuminance(hex: string) {
  const match = HEX_COLOR.exec(hex);
  if (!match) throw new Error(`Expected a 6-digit hex colour, got "${hex}".`);
  const [red, green, blue] = match.slice(1).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2.1 contrast ratio. Both arguments must be 6-digit hex colours. */
export function contrastRatio(foreground: string, background: string) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const NAMED_COLORS: Readonly<Record<string, string>> = {
  black: "#000000",
  white: "#ffffff",
};

function toHexChannel(value: number) {
  const clamped = Math.round(Math.min(255, Math.max(0, value)));
  return clamped.toString(16).padStart(2, "0");
}

function parseRgbChannel(value: string) {
  return value.endsWith("%")
    ? (Number.parseFloat(value) / 100) * 255
    : Number.parseFloat(value);
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = Math.min(1, Math.max(0, saturation));
  const l = Math.min(1, Math.max(0, lightness));
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((v) => toHexChannel(v * 255)).join("")}`;
}

function parseAlpha(value: string | undefined) {
  if (value === undefined) return 1;
  const alpha = value.endsWith("%")
    ? Number.parseFloat(value) / 100
    : Number.parseFloat(value);
  return Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : null;
}

/**
 * Parses a CSS colour into 6-digit hex plus its alpha. Understands hex (3,
 * 4, 6 or 8 digits), `rgb()`/`rgba()`, `hsl()`/`hsla()`, `black` and
 * `white`. Returns null for anything else, such as `var(...)`.
 */
export function parseCssColor(
  value: string,
): { hex: string; alpha: number } | null {
  const input = value.trim().toLowerCase();
  if (NAMED_COLORS[input]) return { hex: NAMED_COLORS[input], alpha: 1 };

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(input)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map((d) => d + d).join("") : hex;
    const alpha =
      digits.length === 8 ? Number.parseInt(digits.slice(6), 16) / 255 : 1;
    return { hex: `#${digits.slice(0, 6)}`, alpha };
  }

  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(input);
  if (!fn) return null;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const alpha = parseAlpha(parts[3]);
  if (alpha === null) return null;

  if (fn[1].startsWith("rgb")) {
    const channels = parts.slice(0, 3).map(parseRgbChannel);
    if (channels.some((channel) => !Number.isFinite(channel))) return null;
    return { hex: `#${channels.map(toHexChannel).join("")}`, alpha };
  }

  const hue = Number.parseFloat(parts[0]);
  const saturation = Number.parseFloat(parts[1]) / 100;
  const lightness = Number.parseFloat(parts[2]) / 100;
  if (![hue, saturation, lightness].every(Number.isFinite)) return null;
  return {
    hex: hslToHex(((hue % 360) + 360) % 360, saturation, lightness),
    alpha,
  };
}

/** {@link parseCssColor} without the alpha: 6-digit hex, or null. */
export function normalizeCssColor(value: string) {
  return parseCssColor(value)?.hex ?? null;
}

function compositeHex(foreground: string, alpha: number, backdrop: string) {
  const channels = (hex: string) =>
    [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const top = channels(foreground);
  const bottom = channels(backdrop);
  return `#${top
    .map((value, index) =>
      toHexChannel(value * alpha + bottom[index] * (1 - alpha)),
    )
    .join("")}`;
}

function pickOnAccent(color: string) {
  const dark = PLAY_APPEARANCE_PALETTES.dark["text-on-accent"];
  const light = PLAY_APPEARANCE_PALETTES.light["text-on-accent"];
  return contrastRatio(dark, color) >= contrastRatio(light, color)
    ? dark
    : light;
}

/**
 * Text colour that stays legible on a node's own accent. A translucent
 * accent is composited over `backdrop` (a CSS colour) first. Returns null
 * when the accent cannot be resolved to a colour (for example a `var(...)`
 * reference), or is translucent and no usable backdrop is given; the
 * theme's `text-on-accent` then applies.
 */
export function resolveOnAccentColor(accent: string, backdrop?: string) {
  const color = parseCssColor(accent);
  if (!color) return null;
  if (color.alpha >= 1) return pickOnAccent(color.hex);
  const base = backdrop ? parseCssColor(backdrop) : null;
  if (!base || base.alpha < 1) return null;
  return pickOnAccent(compositeHex(color.hex, color.alpha, base.hex));
}

/**
 * CSS value for text on an accent drawn over a node surface (`surface-1`).
 * Opaque accents give a plain colour. Translucent ones give a
 * `light-dark()` pair, composited over each theme's `surface-1`, which the
 * browser picks from the theme's `color-scheme`. Returns null when the
 * accent cannot be resolved.
 */
export function resolveOnAccentCss(accent: string) {
  const color = parseCssColor(accent);
  if (!color) return null;
  if (color.alpha >= 1) return pickOnAccent(color.hex);
  const onLight = resolveOnAccentColor(
    accent,
    PLAY_APPEARANCE_PALETTES.light["surface-1"],
  );
  const onDark = resolveOnAccentColor(
    accent,
    PLAY_APPEARANCE_PALETTES.dark["surface-1"],
  );
  return onLight === onDark ? onLight : `light-dark(${onLight}, ${onDark})`;
}

function renderThemeBlock(selector: string, theme: PlayAppearanceTheme) {
  const palette = PLAY_APPEARANCE_PALETTES[theme];
  const declarations = PLAY_APPEARANCE_TOKENS.map(
    (token) => `  --noodlr-${token}: ${palette[token]};`,
  );
  return [
    `${selector} {`,
    `  color-scheme: ${theme};`,
    ...declarations,
    "}",
  ].join("\n");
}

/** CSS custom property declarations for both themes. */
export function renderPlayAppearanceCss() {
  return [
    "/* Generated by @noodlrstudio/play-api generate:theme. Do not edit. */",
    renderThemeBlock(':root,\n[data-noodlr-theme="dark"]', "dark"),
    "",
    renderThemeBlock('[data-noodlr-theme="light"]', "light"),
    "",
  ].join("\n");
}

export interface PlayAppearanceSnapshot {
  readonly theme: PlayAppearanceTheme;
  readonly tokens: PlayAppearancePalette;
  readonly reducedMotion: boolean;
}

export interface PlayAppearanceApi {
  snapshot(): PlayAppearanceSnapshot;
  /** Calls listener immediately with the current snapshot, then on every change. */
  subscribe(listener: (snapshot: PlayAppearanceSnapshot) => void): () => void;
}

export interface PlayAppearanceController {
  readonly api: PlayAppearanceApi;
  set(next: { theme?: PlayAppearanceTheme; reducedMotion?: boolean }): void;
  dispose(): void;
}

export function createPlayAppearanceController(
  initial: { theme?: PlayAppearanceTheme; reducedMotion?: boolean } = {},
): PlayAppearanceController {
  const listeners = new Set<(snapshot: PlayAppearanceSnapshot) => void>();
  let theme = initial.theme ?? "dark";
  let reducedMotion = initial.reducedMotion ?? false;
  let current = createSnapshot();

  function createSnapshot(): PlayAppearanceSnapshot {
    return Object.freeze({
      theme,
      tokens: PLAY_APPEARANCE_PALETTES[theme],
      reducedMotion,
    });
  }

  function notify(listener: (snapshot: PlayAppearanceSnapshot) => void) {
    try {
      listener(current);
    } catch {
      // One node's listener must not stop the others from updating.
    }
  }

  return {
    api: {
      snapshot: () => current,
      subscribe(listener) {
        listeners.add(listener);
        notify(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    set(next) {
      const nextTheme = next.theme ?? theme;
      const nextReducedMotion = next.reducedMotion ?? reducedMotion;
      if (nextTheme === theme && nextReducedMotion === reducedMotion) return;
      theme = nextTheme;
      reducedMotion = nextReducedMotion;
      current = createSnapshot();
      [...listeners].forEach(notify);
    },
    dispose() {
      listeners.clear();
    },
  };
}
