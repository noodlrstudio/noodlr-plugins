import { z } from "zod";
import type { PlayNodePortDefinition } from "./types";

export type CuratedAudioPluginFormat = "wam2" | "cmajor-webaudio" | "wclap";

export interface CuratedAudioPluginManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  format: CuratedAudioPluginFormat;
  description: string;
  author: { name: string; url?: string };
  sourceUrl: string;
  license: string;
  entry: string;
  checksums: Record<string, string>;
  ports: readonly PlayNodePortDefinition[];
  state: "json-shared";
  minimumSize?: { width: number; height: number };
  preferredSize?: { width: number; height: number };
}

const reverseDomainId = /^[a-z0-9]+(?:[.-][a-z0-9]+){2,}$/;
const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const portId = /^[a-z][a-z0-9-]{0,63}$/;

export const curatedAudioPluginManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().min(3).max(160).regex(reverseDomainId),
  name: z.string().trim().min(1).max(80),
  version: z.string().regex(semanticVersion),
  format: z.enum(["wam2", "cmajor-webaudio", "wclap"]),
  description: z.string().trim().min(1).max(240),
  author: z.strictObject({
    name: z.string().trim().min(1).max(80),
    url: z.url().optional(),
  }),
  sourceUrl: z.url(),
  license: z.string().trim().min(1).max(80),
  entry: z
    .string()
    .min(1)
    .max(240)
    .refine((value) => !value.includes("..")),
  checksums: z.record(
    z.string().min(1).max(240),
    z.string().regex(/^sha256-[A-Za-z0-9+/]{43}=$/),
  ),
  ports: z
    .array(
      z.strictObject({
        id: z.string().regex(portId),
        type: z.enum(["midi.notes", "midi.messages", "audio"]),
        label: z.string().trim().min(1).max(64),
        direction: z.enum(["in", "out"]),
      }),
    )
    .min(1)
    .max(8)
    .refine(
      (ports) => new Set(ports.map((port) => port.id)).size === ports.length,
    )
    .refine(
      (ports) => {
        const routes = ports.map(
          (port) =>
            `${port.type === "audio" ? "audio" : "midi"}:${port.direction}`,
        );
        return new Set(routes).size === routes.length;
      },
      {
        message:
          "Curated plugins support one audio and one MIDI port per direction.",
      },
    ),
  state: z.literal("json-shared"),
  minimumSize: z
    .strictObject({
      width: z.number().int().min(120).max(2048),
      height: z.number().int().min(96).max(2048),
    })
    .optional(),
  preferredSize: z
    .strictObject({
      width: z.number().int().min(120).max(4096),
      height: z.number().int().min(96).max(4096),
    })
    .optional(),
});

export function validateCuratedAudioPluginManifest(value: unknown) {
  return curatedAudioPluginManifestSchema.parse(
    value,
  ) as CuratedAudioPluginManifest;
}
