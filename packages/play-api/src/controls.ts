import type { PlayStateFieldDefinition, PlayStateFields } from "./types";

/**
 * Every Play node opens on a simple, playable view. Advanced controls sit
 * behind a header toggle whose visibility lives in this field. It is stored
 * per viewer, so hiding controls never edits the shared space.
 */
export const PLAY_NODE_CONTROLS_FIELD = "showControls";

export const playNodeControlsField = {
  type: "boolean",
  default: true,
  scope: "local-persisted",
  label: "Show Controls",
} as const satisfies PlayStateFieldDefinition;

export const playNodeControlsHiddenField = {
  type: "boolean",
  default: false,
  scope: "local-persisted",
  label: "Show Controls",
} as const satisfies PlayStateFieldDefinition;

export function playNodeHasControlsToggle(fields: PlayStateFields) {
  const field = fields[PLAY_NODE_CONTROLS_FIELD];
  return field?.type === "boolean" && field.scope === "local-persisted";
}
