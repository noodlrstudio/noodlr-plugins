import {
  PLAY_NODE_CAPABILITIES,
  type PlayNodeCapability,
} from "@noodlr/play-api";
import type { SourceFile } from "./source-files.js";

interface UsagePattern {
  capability: PlayNodeCapability;
  pattern: RegExp;
  label: string;
}

/**
 * Context API calls that need a capability. The patterns match on the member
 * chain rather than on `context.` so destructured access (`const { midi } =
 * context`) is caught too. This is a static heuristic: it can miss dynamic
 * access and can flag an unrelated object with the same member names.
 */
const USAGE_PATTERNS: UsagePattern[] = [
  {
    capability: "midi.input",
    pattern: /\bmidi\.input\s*\(/,
    label: "midi.input()",
  },
  {
    capability: "midi.output",
    pattern: /\bmidi\.output\s*\(/,
    label: "midi.output()",
  },
  {
    capability: "midi.control-mapping",
    pattern: /\bmidi\.(control|trigger)\s*\(/,
    label: "midi.control() / midi.trigger()",
  },
  {
    capability: "midi.device-input",
    pattern: /\bdevices\.input\s*\(/,
    label: "midi.devices.input()",
  },
  {
    capability: "midi.device-output",
    pattern: /\bdevices\.output\s*\(/,
    label: "midi.devices.output()",
  },
  {
    capability: "transport.read",
    pattern: /\btransport\.(snapshot|subscribe|now|beatAt|timeOfBeat)\s*\(/,
    label: "transport read",
  },
  {
    capability: "transport.schedule",
    pattern: /\btransport\.schedule\s*\(/,
    label: "transport.schedule()",
  },
  {
    capability: "audio.input",
    pattern: /\baudio\.input\s*\(/,
    label: "audio.input()",
  },
  {
    capability: "audio.output",
    pattern: /\baudio\.(output|ensureReady|context)\s*\(/,
    label: "audio.output() / ensureReady() / context()",
  },
  {
    capability: "audio.decode",
    pattern: /\baudio\.decodeWaveform\s*\(/,
    label: "audio.decodeWaveform()",
  },
  {
    capability: "mixer.read",
    pattern: /\bmixer\.(snapshot|subscribe|outputAnalyser)\s*\(/,
    label: "mixer read",
  },
  {
    capability: "mixer.write",
    pattern: /\bmixer\.setMasterVolumeDb\s*\(/,
    label: "mixer.setMasterVolumeDb()",
  },
  {
    capability: "song.read",
    pattern:
      /\bsong\??\.(snapshot|subscribe|timeOfBar|barAt|position|chordAt)\s*\(/,
    label: "song read",
  },
  {
    capability: "song.perform",
    pattern: /\bsong\??\.(play|queue|stop)\s*\(/,
    label: "song.play() / queue() / stop()",
  },
  {
    capability: "song.write",
    pattern: /\bsong\??\.write\b/,
    label: "song.write",
  },
  {
    capability: "clock.follow",
    pattern:
      /\bcontext\.clock\b|\bclock\??\.(snapshot|subscribe|nextBar|barAt|timeOfBar)\s*\(/,
    label: "clock",
  },
  {
    capability: "network.fetch",
    pattern: /\bnetwork\.fetch\s*\(/,
    label: "network.fetch()",
  },
  {
    capability: "microphone.input",
    pattern: /\bmicrophone\.(request|devices|subscribeDevices)\s*\(/,
    label: "microphone",
  },
  {
    capability: "file.import",
    pattern: /\bfiles\.pick\s*\(/,
    label: "files.pick()",
  },
  {
    capability: "file.export",
    pattern: /\bfiles\.save\s*\(/,
    label: "files.save()",
  },
  {
    capability: "asset.read",
    pattern: /\bassets\.(load|prepare|status|localSyncStatus|subscribe)\s*\(/,
    label: "assets read",
  },
  {
    capability: "asset.write",
    pattern: /\bassets\.(store|remove)\s*\(/,
    label: "assets.store() / remove()",
  },
  {
    capability: "collaboration.shared-state",
    pattern: /scope\s*:\s*["']shared-persisted["']/,
    label: "shared-persisted state field",
  },
];

const CAPABILITY_LITERAL =
  /\b(?:hasCapability|requireCapability)\s*\(\s*["']([a-z.-]+)["']\s*\)/g;

export interface CapabilityUsage {
  capability: PlayNodeCapability;
  file: string;
  line: number;
  evidence: string;
}

export interface CapabilityReport {
  ok: boolean;
  declared: string[];
  used: PlayNodeCapability[];
  /** Used in code but not declared: the host will refuse these calls. */
  missing: PlayNodeCapability[];
  /** Declared but not detected in code: reviewers will ask why. */
  unused: string[];
  /** Declared values that are not capabilities at all. */
  unknown: string[];
  usages: CapabilityUsage[];
  notes: string[];
}

export function findCapabilityUsages(files: readonly SourceFile[]) {
  const usages: CapabilityUsage[] = [];
  for (const file of files) {
    const lines = file.content.split("\n");
    lines.forEach((text, index) => {
      if (/^\s*(\/\/|\*)/.test(text)) return;
      for (const usage of USAGE_PATTERNS) {
        if (usage.pattern.test(text)) {
          usages.push({
            capability: usage.capability,
            file: file.path,
            line: index + 1,
            evidence: usage.label,
          });
        }
      }
      for (const match of text.matchAll(CAPABILITY_LITERAL)) {
        const capability = match[1] as PlayNodeCapability;
        if (
          (PLAY_NODE_CAPABILITIES as readonly string[]).includes(capability)
        ) {
          usages.push({
            capability,
            file: file.path,
            line: index + 1,
            evidence: match[0],
          });
        }
      }
    });
  }
  return usages;
}

/** Finds `capabilities: [...]` in a definePlayNode manifest. */
export function findDeclaredCapabilities(files: readonly SourceFile[]) {
  for (const file of files) {
    if (!file.content.includes("definePlayNode")) continue;
    const match = file.content.match(/capabilities\s*:\s*\[([^\]]*)\]/);
    if (match) {
      return {
        file: file.path,
        capabilities: [...match[1].matchAll(/["']([^"']+)["']/g)].map(
          (m) => m[1],
        ),
      };
    }
    return { file: file.path, capabilities: [] as string[] };
  }
  return null;
}

export function checkCapabilities(
  declared: readonly string[],
  files: readonly SourceFile[],
): CapabilityReport {
  const usages = findCapabilityUsages(files);
  const used = [...new Set(usages.map((usage) => usage.capability))].sort();
  const known = PLAY_NODE_CAPABILITIES as readonly string[];
  const unknown = declared.filter((value) => !known.includes(value));
  const missing = used.filter((capability) => !declared.includes(capability));
  const unused = declared.filter(
    (value) =>
      known.includes(value) && !used.includes(value as PlayNodeCapability),
  );
  const notes: string[] = [];
  if (unused.length) {
    notes.push(
      "Unused capabilities may be reached through code this check cannot see (dynamic access, helpers in other packages). Remove them if they really are unused.",
    );
  }
  if (declared.length > 16) {
    notes.push("A manifest may declare at most 16 capabilities.");
  }
  return {
    ok: missing.length === 0 && unknown.length === 0 && declared.length <= 16,
    declared: [...declared],
    used,
    missing,
    unused,
    unknown,
    usages,
    notes,
  };
}
