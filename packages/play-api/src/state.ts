import type {
  InferPlayState,
  PlayJsonObject,
  PlayNodeStateDefinition,
  PlayStateFields,
} from "./types";
import { PlayNodeValidationError, validatePlayNodeState } from "./validation";

export function createPlayNodeDefaults<TFields extends PlayStateFields>(
  fields: TFields,
): InferPlayState<TFields> {
  return structuredClone(
    Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.default]),
    ),
  ) as InferPlayState<TFields>;
}

export function createPlayNodeSharedDefaults<TFields extends PlayStateFields>(
  fields: TFields,
) {
  return structuredClone(
    Object.fromEntries(
      Object.entries(fields)
        .filter(([, field]) => field.scope === "shared-persisted")
        .map(([key, field]) => [key, field.default]),
    ),
  ) as PlayJsonObject;
}

export function selectPlayNodeSharedState(
  fields: PlayStateFields,
  state: PlayJsonObject,
) {
  return Object.fromEntries(
    Object.keys(fields)
      .filter((key) => fields[key]?.scope === "shared-persisted")
      .map((key) => [key, state[key]]),
  ) as PlayJsonObject;
}

export interface PlayNodeStateMigrationResult {
  state: PlayJsonObject;
  version: number;
  migrated: boolean;
}

export function migratePlayNodeState<TFields extends PlayStateFields>(
  definition: PlayNodeStateDefinition<TFields>,
  state: PlayJsonObject,
  fromVersion: number,
): PlayNodeStateMigrationResult {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new PlayNodeValidationError("The state version is invalid.", [
      `stateVersion: expected a positive integer, received ${fromVersion}`,
    ]);
  }
  if (fromVersion > definition.version) {
    throw new PlayNodeValidationError(
      "This node was saved by a newer state version.",
      [`stateVersion: ${fromVersion} is newer than ${definition.version}`],
    );
  }

  let current = structuredClone(state);
  let version = fromVersion;
  while (version < definition.version) {
    const migrate = definition.migrations?.[version];
    if (!migrate) {
      throw new PlayNodeValidationError("A state migration is missing.", [
        `migrations.${version}: must migrate v${version} to v${version + 1}`,
      ]);
    }
    current = migrate(structuredClone(current));
    version += 1;
  }

  return {
    state: validatePlayNodeState(definition.fields, current),
    version,
    migrated: version !== fromVersion,
  };
}
