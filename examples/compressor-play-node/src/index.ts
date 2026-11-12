import { definePlayNode } from "@noodlr/play-api";
import Compressor from "./Compressor.svelte";
import { createCompressorController } from "./compressor-controller";

const shared = "shared-persisted" as const;

export const compressor = definePlayNode({
  manifest: {
    id: "com.example.compressor",
    name: "Compressor",
    version: "0.1.0",
    apiVersion: "0",
    description: "A stereo compressor with a gain-reduction meter.",
    icon: "Activity",
    // Declare every capability the node uses, and nothing else.
    capabilities: ["audio.input", "audio.output", "collaboration.shared-state"],
    minimumSize: { width: 260, height: 220 },
    preferredSize: { width: 340, height: 260 },
  },
  state: {
    version: 1,
    fields: {
      threshold: {
        type: "number",
        minimum: -60,
        maximum: 0,
        default: -24,
        scope: shared,
        label: "Threshold",
      },
      ratio: {
        type: "number",
        minimum: 1,
        maximum: 20,
        default: 4,
        scope: shared,
        label: "Ratio",
      },
      attack: {
        type: "number",
        minimum: 0,
        maximum: 1000,
        default: 10,
        scope: shared,
        label: "Attack",
      },
      release: {
        type: "number",
        minimum: 10,
        maximum: 1000,
        default: 250,
        scope: shared,
        label: "Release",
      },
      knee: {
        type: "number",
        minimum: 0,
        maximum: 40,
        default: 6,
        scope: shared,
        label: "Knee",
      },
      makeup: {
        type: "number",
        minimum: 0,
        maximum: 24,
        default: 0,
        scope: shared,
        label: "Makeup",
      },
      bypass: {
        type: "boolean",
        default: false,
        scope: shared,
        label: "Bypass",
      },
    },
  },
  ports: [
    { id: "audio-in", type: "audio", label: "In", direction: "in" },
    { id: "audio-out", type: "audio", label: "Out", direction: "out" },
  ],
  setup: (context) => createCompressorController(context),
  view: Compressor,
});
