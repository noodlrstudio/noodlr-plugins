export * from "./appearance";
export * from "./audio-input";
export * from "./clock";
export * from "./controls";
export * from "./curated-plugins";
export * from "./lifecycle";
export * from "./live-session";
export * from "./midi";
export * from "./song";
export * from "./state";
export * from "./testing";
export * from "./types";
export * from "./validation";

import type { PlayNodeDefinition, PlayStateFields } from "./types";
import { validatePlayNodeDefinition } from "./validation";

export function definePlayNode<
  const TFields extends PlayStateFields,
  TController = void,
>(definition: PlayNodeDefinition<TFields, TController>) {
  return validatePlayNodeDefinition(definition);
}

export * from "./performance";
