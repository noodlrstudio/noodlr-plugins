import { describe, expect, it } from "vitest";
import { validateCuratedAudioPluginManifest } from "./curated-plugins";

describe("curated audio plugin manifests", () => {
  it("accepts pinned reviewed bundles and rejects remote path traversal", () => {
    const manifest = {
      schemaVersion: 1,
      id: "xyz.noodlr.community.gain",
      name: "Community Gain",
      version: "1.0.0",
      format: "wam2",
      description: "Reference gain plugin.",
      author: { name: "Noodlr", url: "https://noodlr.xyz" },
      sourceUrl: "https://github.com/5of12/noodlrboard",
      license: "AGPL-3.0-or-later",
      entry: "vendor/community-gain/index.js",
      checksums: {
        "vendor/community-gain/index.js":
          "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
      ports: [
        { id: "audio-out", type: "audio", label: "Audio", direction: "out" },
      ],
      state: "json-shared",
    } as const;
    expect(validateCuratedAudioPluginManifest(manifest).id).toBe(manifest.id);
    expect(() =>
      validateCuratedAudioPluginManifest({
        ...manifest,
        entry: "../remote.js",
      }),
    ).toThrow();
  });

  it("rejects port topologies the host cannot completely route", () => {
    const manifest = {
      schemaVersion: 1,
      id: "xyz.noodlr.community.multi-output",
      name: "Multi Output",
      version: "1.0.0",
      format: "cmajor-webaudio",
      description: "Plugin with unsupported duplicate routes.",
      author: { name: "Noodlr" },
      sourceUrl: "https://github.com/5of12/noodlrboard",
      license: "AGPL-3.0-or-later",
      entry: "vendor/multi-output/index.js",
      checksums: {
        "vendor/multi-output/index.js":
          "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
      state: "json-shared",
    } as const;

    expect(() =>
      validateCuratedAudioPluginManifest({
        ...manifest,
        ports: [
          { id: "left", type: "audio", label: "Left", direction: "out" },
          { id: "right", type: "audio", label: "Right", direction: "out" },
        ],
      }),
    ).toThrow(/one audio and one MIDI port per direction/);

    expect(() =>
      validateCuratedAudioPluginManifest({
        ...manifest,
        ports: [
          { id: "notes", type: "midi.notes", label: "Notes", direction: "in" },
          {
            id: "messages",
            type: "midi.messages",
            label: "Messages",
            direction: "in",
          },
        ],
      }),
    ).toThrow(/one audio and one MIDI port per direction/);
  });

  it("accepts reviewed WCLAP modules", () => {
    expect(
      validateCuratedAudioPluginManifest({
        schemaVersion: 1,
        id: "xyz.noodlr.community.wclap-reverb",
        name: "Reverb",
        version: "1.0.0",
        format: "wclap",
        description: "A WCLAP plugin running in noodlr.",
        author: { name: "Signalsmith Audio" },
        sourceUrl: "https://github.com/Signalsmith-Audio/basics",
        license: "MIT",
        entry: "vendor/wclap/signalsmith-basics/1.0.0/module.wasm",
        checksums: {
          "vendor/wclap/signalsmith-basics/1.0.0/module.wasm":
            "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        },
        ports: [
          { id: "audio-in", type: "audio", label: "Audio In", direction: "in" },
          {
            id: "audio-out",
            type: "audio",
            label: "Audio Out",
            direction: "out",
          },
        ],
        state: "json-shared",
      }).format,
    ).toBe("wclap");
  });
});
