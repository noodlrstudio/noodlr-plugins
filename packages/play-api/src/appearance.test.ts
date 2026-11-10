import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PLAY_APPEARANCE_PALETTES,
  PLAY_APPEARANCE_THEMES,
  PLAY_APPEARANCE_TOKENS,
  contrastRatio,
  createPlayAppearanceController,
  isPlayAppearanceTheme,
  renderPlayAppearanceCss,
  normalizeCssColor,
  parseCssColor,
  resolveOnAccentColor,
  resolveOnAccentCss,
} from "./appearance";

function mixHex(foreground: string, background: string, amount: number) {
  const channels = (hex: string) =>
    [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const top = channels(foreground);
  const bottom = channels(background);
  return `#${top
    .map((value, index) =>
      Math.round(value * amount + bottom[index] * (1 - amount))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
import { createMockPlayNodeContext } from "./testing";

describe("appearance palettes", () => {
  it("defines every token in every theme", () => {
    expect(PLAY_APPEARANCE_TOKENS).toHaveLength(48);
    for (const theme of PLAY_APPEARANCE_THEMES) {
      expect(Object.keys(PLAY_APPEARANCE_PALETTES[theme]).sort()).toEqual(
        [...PLAY_APPEARANCE_TOKENS].sort(),
      );
    }
  });

  it("keeps today's dark kit values", () => {
    expect(PLAY_APPEARANCE_PALETTES.dark["surface-1"]).toBe("#151518");
    expect(PLAY_APPEARANCE_PALETTES.dark["text-primary"]).toBe("#f1f2f4");
    expect(PLAY_APPEARANCE_PALETTES.dark.accent).toBe("#00d19b");
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(() => contrastRatio("rgba(0,0,0,1)", "#ffffff")).toThrow();
  });

  it.each(PLAY_APPEARANCE_THEMES)("meets contrast minimums in %s", (theme) => {
    const p = PLAY_APPEARANCE_PALETTES[theme];
    for (const surface of ["surface-1", "surface-2", "surface-3"] as const) {
      expect(
        contrastRatio(p["text-primary"], p[surface]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(p["text-secondary"], p[surface]),
      ).toBeGreaterThanOrEqual(4.5);
      // Tertiary text is used for small labels, so it needs body-text contrast.
      expect(
        contrastRatio(p["text-tertiary"], p[surface]),
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const token of ["border-strong", "focus-ring", "selection"] as const) {
      expect(contrastRatio(p[token], p["surface-1"])).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(p["text-on-accent"], p.accent)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(p.ink, p.paper)).toBeGreaterThanOrEqual(7);
  });

  it.each(PLAY_APPEARANCE_THEMES)(
    "keeps hue tokens visible on node and board surfaces in %s",
    (theme) => {
      const p = PLAY_APPEARANCE_PALETTES[theme];
      const hues = PLAY_APPEARANCE_TOKENS.filter((token) =>
        token.startsWith("hue-"),
      );
      expect(hues).toHaveLength(12);
      for (const hue of hues) {
        expect(contrastRatio(p[hue], p["surface-1"])).toBeGreaterThanOrEqual(
          4.5,
        );
        for (const surface of ["surface-3", "surface-canvas"] as const) {
          expect(contrastRatio(p[hue], p[surface])).toBeGreaterThanOrEqual(3);
        }
        expect(
          contrastRatio(p["text-on-accent"], p[hue]),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each(PLAY_APPEARANCE_THEMES)(
    "keeps status text legible on its own tint in %s",
    (theme) => {
      const p = PLAY_APPEARANCE_PALETTES[theme];
      // Status labels sit on a tint of up to 20% of their own colour.
      for (const status of ["positive", "warning", "danger"] as const) {
        for (const surface of [
          "surface-canvas",
          "surface-1",
          "surface-2",
        ] as const) {
          const tint = mixHex(p[status], p[surface], 0.2);
          expect(contrastRatio(p[status], tint)).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );

  it("validates theme names", () => {
    expect(isPlayAppearanceTheme("light")).toBe(true);
    expect(isPlayAppearanceTheme("system")).toBe(false);
    expect(isPlayAppearanceTheme(null)).toBe(false);
  });
});

describe("appearance CSS", () => {
  it("renders both theme blocks", () => {
    const css = renderPlayAppearanceCss();
    expect(css).toContain(':root,\n[data-noodlr-theme="dark"] {');
    expect(css).toContain('[data-noodlr-theme="light"] {');
    expect(css).toContain("--noodlr-surface-1: #151518;");
    expect(css).toContain("--noodlr-surface-1: #dddee1;");
    expect(css.match(/color-scheme:/g)).toHaveLength(2);
  });

  it("matches the checked-in tokens.css", () => {
    const file = new URL("../../ui/src/theme/tokens.css", import.meta.url);
    expect(readFileSync(file, "utf8")).toBe(renderPlayAppearanceCss());
  });
});

describe("appearance controller", () => {
  it("defaults to dark with dark tokens", () => {
    const { api } = createPlayAppearanceController();
    expect(api.snapshot()).toEqual({
      theme: "dark",
      tokens: PLAY_APPEARANCE_PALETTES.dark,
      reducedMotion: false,
    });
  });

  it("calls a subscriber immediately and once per change", () => {
    const controller = createPlayAppearanceController();
    const seen: string[] = [];
    const off = controller.api.subscribe((s) => seen.push(s.theme));
    controller.set({ theme: "light" });
    controller.set({ theme: "light" });
    off();
    controller.set({ theme: "dark" });
    expect(seen).toEqual(["dark", "light"]);
    expect(controller.api.snapshot().tokens).toBe(
      PLAY_APPEARANCE_PALETTES.dark,
    );
  });

  it("notifies when reduced motion changes", () => {
    const controller = createPlayAppearanceController();
    const seen: boolean[] = [];
    controller.api.subscribe((s) => seen.push(s.reducedMotion));
    controller.set({ reducedMotion: true });
    expect(seen).toEqual([false, true]);
  });

  it("keeps notifying other listeners when one throws", () => {
    const controller = createPlayAppearanceController();
    const seen: string[] = [];
    controller.api.subscribe((s) => {
      if (s.theme === "light") throw new Error("boom");
    });
    controller.api.subscribe((s) => seen.push(s.theme));
    expect(() => controller.set({ theme: "light" })).not.toThrow();
    expect(seen).toEqual(["dark", "light"]);
  });

  it("stops notifying after dispose", () => {
    const controller = createPlayAppearanceController();
    const seen: string[] = [];
    controller.api.subscribe((s) => seen.push(s.theme));
    controller.dispose();
    controller.set({ theme: "light" });
    expect(seen).toEqual(["dark"]);
  });

  it("is exposed on the mock context with setTheme", () => {
    const mock = createMockPlayNodeContext({ enabled: true });
    expect(mock.context.appearance.snapshot().theme).toBe("dark");
    mock.setTheme("light");
    expect(mock.context.appearance.snapshot().tokens["surface-1"]).toBe(
      "#dddee1",
    );
  });

  it("stops notifying mock subscribers once the mock lifecycle is disposed", async () => {
    const mock = createMockPlayNodeContext({ enabled: true });
    const seen: string[] = [];
    mock.context.appearance.subscribe((s) => seen.push(s.theme));
    await mock.lifecycle.dispose();
    mock.setTheme("light");
    expect(seen).toEqual(["dark"]);
  });
});

describe("resolveOnAccentColor", () => {
  it("picks dark text for bright accents and light text for deep ones", () => {
    expect(resolveOnAccentColor("#f4c64b")).toBe("#06110e");
    expect(resolveOnAccentColor("#007a5c")).toBe("#ffffff");
  });

  it("understands short hex, rgb() and hsl() accents", () => {
    expect(resolveOnAccentColor("#fff")).toBe("#06110e");
    expect(resolveOnAccentColor("white")).toBe("#06110e");
    expect(resolveOnAccentColor("rgb(255, 255, 255)")).toBe("#06110e");
    expect(resolveOnAccentColor("rgb(0 122 92)")).toBe("#ffffff");
    expect(resolveOnAccentColor("hsl(0, 0%, 100%)")).toBe("#06110e");
  });

  it("composites a translucent accent over the backdrop", () => {
    const darkSurface = PLAY_APPEARANCE_PALETTES.dark["surface-3"];
    expect(resolveOnAccentColor("rgba(255, 255, 255, 0.1)", darkSurface)).toBe(
      "#ffffff",
    );
    expect(resolveOnAccentColor("#ffffff1a", "#ffffff")).toBe("#06110e");
  });

  it("returns null for a translucent accent without a usable backdrop", () => {
    expect(resolveOnAccentColor("rgba(255, 255, 255, 0.1)")).toBeNull();
    expect(
      resolveOnAccentColor("rgba(255, 255, 255, 0.1)", "var(--x)"),
    ).toBeNull();
  });

  it("returns null when the accent cannot be resolved", () => {
    expect(resolveOnAccentColor("var(--noodlr-accent)")).toBeNull();
    expect(resolveOnAccentColor("rebeccapurple")).toBeNull();
  });
});

describe("resolveOnAccentCss", () => {
  it("returns a plain colour for opaque accents", () => {
    expect(resolveOnAccentCss("#fff")).toBe("#06110e");
    expect(resolveOnAccentCss("#007a5c")).toBe("#ffffff");
  });

  it("returns a light-dark pair for translucent accents", () => {
    expect(resolveOnAccentCss("rgba(255, 255, 255, 0.1)")).toBe(
      "light-dark(#06110e, #ffffff)",
    );
  });

  it("collapses the pair when both themes agree", () => {
    expect(resolveOnAccentCss("rgba(0, 0, 0, 0.95)")).toBe("#ffffff");
  });

  it("returns null when the accent cannot be resolved", () => {
    expect(resolveOnAccentCss("var(--noodlr-accent)")).toBeNull();
  });
});

describe("parseCssColor", () => {
  it.each([
    ["#00d19b", { hex: "#00d19b", alpha: 1 }],
    ["#00d19b80", { hex: "#00d19b", alpha: 128 / 255 }],
    ["#0008", { hex: "#000000", alpha: 136 / 255 }],
    ["rgba(0, 209, 155, 0.5)", { hex: "#00d19b", alpha: 0.5 }],
    ["rgb(0 209 155 / 25%)", { hex: "#00d19b", alpha: 0.25 }],
    ["hsla(120, 100%, 25%, 0.4)", { hex: "#008000", alpha: 0.4 }],
  ])("parses %s", (input, expected) => {
    expect(parseCssColor(input)).toEqual(expected);
  });

  it("rejects a malformed alpha", () => {
    expect(parseCssColor("rgba(0, 0, 0, x)")).toBeNull();
    expect(parseCssColor("rgba(0, 0, 0, 1, 2)")).toBeNull();
  });
});

describe("normalizeCssColor", () => {
  it.each([
    ["#ABC", "#aabbcc"],
    ["#abcd", "#aabbcc"],
    ["#00d19b", "#00d19b"],
    ["#00d19b80", "#00d19b"],
    ["rgb(0, 209, 155)", "#00d19b"],
    ["rgba(0,209,155,0.5)", "#00d19b"],
    ["rgb(0% 100% 50%)", "#00ff80"],
    ["hsl(120, 100%, 25%)", "#008000"],
    [" Black ", "#000000"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeCssColor(input)).toBe(expected);
  });

  it.each(["var(--x)", "#12", "rgb(1, 2)", "rgb(a, b, c)", "currentColor"])(
    "rejects %s",
    (input) => {
      expect(normalizeCssColor(input)).toBeNull();
    },
  );
});
