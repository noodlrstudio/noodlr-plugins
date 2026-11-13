import { describe, expect, it } from "vitest";
import { checkCapabilities, findDeclaredCapabilities } from "./capabilities";
import { scaffoldFiles, scaffoldIssues } from "./templates";
import { lintTheme } from "./theme-lint";

describe("checkCapabilities", () => {
  const files = [
    {
      path: "src/Node.svelte",
      content: `<script>
  const out = context.midi.output("notes");
  context.transport.subscribe(() => {});
  // context.network.fetch("ignored in a comment")
  if (context.hasCapability("song.read")) context.song?.chordAt(1);
</script>`,
    },
  ];

  it("reports used capabilities that are not declared", () => {
    const report = checkCapabilities(["midi.output"], files);
    expect(report.ok).toBe(false);
    expect(report.missing).toEqual(["song.read", "transport.read"]);
    expect(report.used).not.toContain("network.fetch");
  });

  it("reports declared capabilities the code does not use", () => {
    const report = checkCapabilities(
      ["midi.output", "transport.read", "song.read", "mixer.write"],
      files,
    );
    expect(report.ok).toBe(true);
    expect(report.unused).toEqual(["mixer.write"]);
  });

  it("rejects values that are not capabilities", () => {
    const report = checkCapabilities(
      ["midi.output", "transport.read", "song.read", "midi.everything"],
      files,
    );
    expect(report.ok).toBe(false);
    expect(report.unknown).toEqual(["midi.everything"]);
  });

  it("needs collaboration.shared-state for shared-persisted fields", () => {
    const report = checkCapabilities(
      [],
      [
        {
          path: "src/index.ts",
          content: `level: { scope: "shared-persisted" }`,
        },
      ],
    );
    expect(report.missing).toEqual(["collaboration.shared-state"]);
  });

  it("sees shared-persisted scopes set through a constant", () => {
    const report = checkCapabilities(
      ["collaboration.shared-state"],
      [
        {
          path: "src/index.ts",
          content: `const shared = "shared-persisted" as const;\nlevel: { scope: shared }`,
        },
      ],
    );
    expect(report.unused).toEqual([]);
  });

  it("reads declared capabilities from definePlayNode", () => {
    const found = findDeclaredCapabilities([
      {
        path: "src/index.ts",
        content: `definePlayNode({ manifest: { capabilities: ["midi.input", 'audio.output'] } })`,
      },
    ]);
    expect(found).toEqual({
      file: "src/index.ts",
      capabilities: ["midi.input", "audio.output"],
    });
  });
});

describe("lintTheme", () => {
  it("flags colour literals in Svelte styles only", () => {
    const findings = lintTheme([
      {
        path: "src/Node.svelte",
        content: `<script>
  const accent = "#ff0000";
</script>
<div></div>
<style>
  .a { color: var(--noodlr-text-primary); }
  .b { background: #101010; }
  .c { border-color: rgba(0, 0, 0, 0.5); }
  .d { color: white; }
  .e { box-shadow: var(--noodlr-shadow-1, #000); }
</style>`,
      },
    ]);
    expect(findings.map((finding) => [finding.line, finding.value])).toEqual([
      [7, "#101010"],
      [8, "rgba("],
      [9, "white"],
    ]);
  });

  it("checks whole .css files", () => {
    expect(
      lintTheme([
        { path: "src/app.css", content: "body { color: hsl(0 0% 0%); }" },
      ]),
    ).toHaveLength(1);
  });
});

describe("scaffold", () => {
  it("rejects ids that are not reverse-domain", () => {
    expect(
      scaffoldIssues({ route: "play-node", id: "MyNode", name: "My Node" }),
    ).toHaveLength(1);
  });

  it("creates a Play node whose own styles pass the theme lint", () => {
    const files = scaffoldFiles({
      route: "play-node",
      id: "com.example.drum-grid",
      name: "Drum Grid",
    });
    expect(files.map((file) => file.path)).toContain("src/DrumGrid.svelte");
    expect(lintTheme(files)).toEqual([]);
    const declared = findDeclaredCapabilities(files);
    expect(checkCapabilities(declared!.capabilities, files).ok).toBe(true);
  });

  it("includes a build for the Mac app's local plugins folder", () => {
    const files = scaffoldFiles({
      route: "play-node",
      id: "com.example.drum-grid",
      name: "Drum Grid",
    });
    const file = (path: string) =>
      files.find((candidate) => candidate.path === path)?.content ?? "";
    expect(JSON.parse(file("package.json")).scripts["build:local"]).toBe(
      "vite build --config vite.local.config.ts",
    );
    expect(file("vite.local.config.ts")).toContain(
      'const id = "com.example.drum-grid"',
    );
    expect(file("src/local-plugin.ts")).toContain(
      "const { view, ...definition } = drumGrid",
    );
    expect(file(".gitignore")).toContain("dist-local");
    expect(file("README.md")).toContain("Developer › Open Node Lab");
  });

  it("creates a web app on audiframe, pinned to the exact client version", () => {
    const files = scaffoldFiles({
      route: "web-app",
      id: "com.example.harmoniser",
      name: "Harmoniser",
    });
    const main = files.find((file) => file.path === "src/main.ts");
    expect(main?.content).toContain('from "@audiframe/client"');
    expect(main?.content).toContain('const APP_ID = "com.example.harmoniser"');
    expect(main?.content).not.toContain("plugin-sdk");
    const pkg = JSON.parse(
      files.find((file) => file.path === "package.json")!.content,
    );
    expect(pkg.dependencies).toEqual({ "@audiframe/client": "0.1.0-alpha.3" });
    expect(files.find((file) => file.path === "README.md")?.content).toContain(
      "?audiframe=1",
    );
  });
});
