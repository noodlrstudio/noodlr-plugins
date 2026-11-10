import { z } from "zod";
import {
  PLAY_API_VERSION,
  type PlayJsonObject,
  type PlayJsonValue,
  type PlayAssetReference,
  type PlayNodeCapability,
  type PlayNodeDefinition,
  type PlayNodeManifest,
  type PlayStateFieldDefinition,
  type PlayStateFields,
} from "./types";

export const MAX_PLAY_NODE_SHARED_STATE_BYTES = 32 * 1024;
export const MAX_PLAY_NODE_REALTIME_ENVELOPE_BYTES = 192 * 1024;

export const PLAY_NODE_CAPABILITIES = [
  "midi.input",
  "midi.output",
  "midi.control-mapping",
  "midi.device-input",
  "midi.device-output",
  "collaboration.shared-state",
  "transport.read",
  "transport.schedule",
  "audio.input",
  "audio.output",
  "audio.decode",
  "mixer.read",
  "mixer.write",
  "song.read",
  "song.perform",
  "song.write",
  "clock.follow",
  "network.fetch",
  "microphone.input",
  "file.import",
  "file.export",
  "asset.read",
  "asset.write",
] as const satisfies readonly PlayNodeCapability[];

export const PLAY_NODE_ICON_TOKENS = [
  "Activity",
  "AudioLines",
  "AudioWaveform",
  "BookOpenText",
  "Box",
  "CassetteTape",
  "FileMusic",
  "Globe",
  "Grid2x2",
  "Guitar",
  "KeyboardMusic",
  "ListMusic",
  "MicVocal",
  "MonitorPlay",
  "Music2",
  "NotebookPen",
  "Radio",
  "Repeat2",
  "ScrollText",
  "SlidersHorizontal",
  "Speech",
  "Waves",
] as const;

export type PlayNodeIconToken = (typeof PLAY_NODE_ICON_TOKENS)[number];

const reverseDomainId = /^[a-z0-9]+(?:[.-][a-z0-9]+){2,}$/;
const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const portId = /^[a-z][a-z0-9-]{0,63}$/;
const stateFieldId = /^[a-z][A-Za-z0-9-]{0,63}$/;

export const playNodeManifestSchema = z.strictObject({
  id: z.string().min(3).max(160).regex(reverseDomainId),
  name: z.string().trim().min(1).max(80),
  version: z.string().regex(semanticVersion),
  apiVersion: z.literal(PLAY_API_VERSION),
  description: z.string().trim().max(240).optional(),
  category: z.string().trim().min(1).max(48).optional(),
  author: z
    .strictObject({
      name: z.string().trim().min(1).max(80),
      url: z.url().optional(),
    })
    .optional(),
  icon: z.enum(PLAY_NODE_ICON_TOKENS).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(16).optional(),
  capabilities: z.array(z.enum(PLAY_NODE_CAPABILITIES)).max(16).optional(),
  liveSession: z
    .strictObject({
      performance: z
        .array(z.enum(["midi", "transport", "shared-loop"]))
        .max(3)
        .optional(),
    })
    .optional(),
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

export const playNodePortSchema = z.strictObject({
  id: z.string().regex(portId),
  type: z.enum(["midi.notes", "midi.messages", "audio"]),
  label: z.string().trim().min(1).max(64),
  direction: z.enum(["in", "out"]),
});

export const playStateFieldSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("string"),
    default: z.string(),
    scope: z.enum(["shared-persisted", "local-persisted", "local-ephemeral"]),
    label: z.string().optional(),
    description: z.string().optional(),
    liveSessionEditable: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    maxLength: z.number().int().positive().optional(),
  }),
  z.strictObject({
    type: z.literal("number"),
    default: z.number().finite(),
    scope: z.enum(["shared-persisted", "local-persisted", "local-ephemeral"]),
    label: z.string().optional(),
    description: z.string().optional(),
    liveSessionEditable: z.boolean().optional(),
    integer: z.boolean().optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    step: z.number().positive().optional(),
  }),
  z.strictObject({
    type: z.literal("boolean"),
    default: z.boolean(),
    scope: z.enum(["shared-persisted", "local-persisted", "local-ephemeral"]),
    label: z.string().optional(),
    description: z.string().optional(),
    liveSessionEditable: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal("json"),
    default: z.json(),
    scope: z.enum(["shared-persisted", "local-persisted", "local-ephemeral"]),
    label: z.string().optional(),
    description: z.string().optional(),
    liveSessionEditable: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal("asset"),
    default: z
      .strictObject({
        id: z.string().min(1),
        name: z.string().min(1).max(240),
        mimeType: z.string().min(1).max(120),
        byteSize: z.number().int().nonnegative(),
        createdAt: z.string().min(1),
        storage: z.record(z.string(), z.json()),
      })
      .nullable(),
    scope: z.enum(["shared-persisted", "local-persisted", "local-ephemeral"]),
    label: z.string().optional(),
    description: z.string().optional(),
    accept: z.array(z.string().min(1)).max(32).optional(),
    maximumBytes: z.number().int().positive().optional(),
  }),
]);

export const playNodeDescriptorSchema = z.strictObject({
  manifest: playNodeManifestSchema,
  state: z.strictObject({
    version: z.number().int().positive(),
    fields: z.record(z.string().regex(stateFieldId), playStateFieldSchema),
  }),
  ports: z.array(playNodePortSchema).optional(),
});

export class PlayNodeValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = "PlayNodeValidationError";
  }
}

export function validatePlayNodeManifest(value: unknown): PlayNodeManifest {
  const result = playNodeManifestSchema.safeParse(value);
  if (result.success) return result.data;
  throw new PlayNodeValidationError(
    "The Play node manifest is invalid.",
    result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  );
}

function isJsonValue(value: unknown): value is PlayJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every(isJsonValue)
  );
}

export function isPlayAssetReference(
  value: unknown,
): value is PlayAssetReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<PlayAssetReference>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    typeof candidate.mimeType === "string" &&
    candidate.mimeType.length > 0 &&
    typeof candidate.byteSize === "number" &&
    Number.isInteger(candidate.byteSize) &&
    candidate.byteSize >= 0 &&
    typeof candidate.createdAt === "string" &&
    candidate.createdAt.length > 0 &&
    isJsonValue(candidate.storage)
  );
}

export function validatePlayStateField(
  field: PlayStateFieldDefinition,
  value: unknown,
) {
  if (!isJsonValue(value)) return false;
  if (field.type === "asset") {
    return value === null || isPlayAssetReference(value);
  }
  if (field.type === "json") return true;
  if (field.type === "boolean") return typeof value === "boolean";
  if (field.type === "string") {
    return (
      typeof value === "string" &&
      (!field.options || field.options.includes(value)) &&
      (!field.maxLength || value.length <= field.maxLength)
    );
  }
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (!field.integer || Number.isInteger(value)) &&
    (field.minimum == null || value >= field.minimum) &&
    (field.maximum == null || value <= field.maximum)
  );
}

export function validatePlayNodeState(
  fields: PlayStateFields,
  value: unknown,
): PlayJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PlayNodeValidationError("Play node state must be an object.", [
      "state: expected an object",
    ]);
  }
  const candidate = value as Record<string, unknown>;
  const issues = Object.entries(fields).flatMap(([key, field]) =>
    validatePlayStateField(field, candidate[key])
      ? []
      : [`state.${key}: does not match the declared ${field.type} field`],
  );
  const unknown = Object.keys(candidate).filter((key) => !fields[key]);
  issues.push(...unknown.map((key) => `state.${key}: unknown field`));
  if (issues.length) {
    throw new PlayNodeValidationError(
      "The Play node state is invalid.",
      issues,
    );
  }
  const state = candidate as PlayJsonObject;
  if (serializedPlayStateBytes(state) > MAX_PLAY_NODE_SHARED_STATE_BYTES) {
    throw new PlayNodeValidationError("The Play node state is too large.", [
      `state: exceeds ${MAX_PLAY_NODE_SHARED_STATE_BYTES} bytes`,
    ]);
  }
  return state;
}

export function validatePlayNodeSharedState(
  fields: PlayStateFields,
  value: unknown,
) {
  const sharedFields = Object.fromEntries(
    Object.entries(fields).filter(
      ([, field]) => field.scope === "shared-persisted",
    ),
  );
  return validatePlayNodeState(sharedFields, value);
}

export function serializedPlayStateBytes(state: PlayJsonObject) {
  return new TextEncoder().encode(JSON.stringify(state)).byteLength;
}

export function validatePlayNodeDefinition<
  TFields extends PlayStateFields,
  TController,
>(definition: PlayNodeDefinition<TFields, TController>) {
  const descriptor = {
    manifest: definition.manifest,
    state: {
      version: definition.state.version,
      fields: definition.state.fields,
    },
    ports: definition.ports,
  };
  const result = playNodeDescriptorSchema.safeParse(descriptor);
  if (!result.success) {
    throw new PlayNodeValidationError(
      `Play node ${definition.manifest?.id ?? "definition"} is invalid.`,
      result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    );
  }
  const ids = new Set<string>();
  for (const port of definition.ports ?? []) {
    if (ids.has(port.id)) {
      throw new PlayNodeValidationError("Play node ports must be unique.", [
        `ports.${port.id}: duplicate port id`,
      ]);
    }
    ids.add(port.id);
  }
  const defaults = Object.fromEntries(
    Object.entries(definition.state.fields).map(([key, field]) => [
      key,
      field.default,
    ]),
  );
  validatePlayNodeState(definition.state.fields, defaults);
  return definition;
}

export function playNodeSchemasAsJsonSchema() {
  return {
    manifest: z.toJSONSchema(playNodeManifestSchema, {
      target: "draft-2020-12",
    }),
    definition: z.toJSONSchema(playNodeDescriptorSchema, {
      target: "draft-2020-12",
    }),
  };
}
