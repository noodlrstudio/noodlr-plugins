import {
  manifestSchema,
  validateManifest,
  type Manifest,
} from "@audiframe/protocol";

/** The @audiframe/client version the docs and scaffold pin to. */
export const AUDIFRAME_CLIENT_VERSION = "0.1.0-alpha.3";

export { manifestSchema as audiframeManifestSchema };

const ID = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks an audiframe client manifest. audiframe's own validateManifest is the
 * authority; the field checks only explain why it failed, because it reports
 * schema problems as a bare INVALID_MESSAGE.
 */
export function checkAudiframeManifest(manifest: unknown): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!isObject(manifest)) {
    return { valid: false, issues: ["manifest: expected an object"] };
  }
  const { id, name, appVersion, protocolVersions, capabilities, ports } =
    manifest;
  if (typeof id !== "string" || !ID.test(id) || id.length > 256) {
    issues.push(
      "id: a dotted identifier such as com.example.drum-machine (letters, digits, - and _)",
    );
  }
  if (typeof name !== "string" || !name || name.length > 80) {
    issues.push("name: 1 to 80 characters");
  }
  if (typeof appVersion !== "string" || !VERSION.test(appVersion)) {
    issues.push("appVersion: semver, such as 1.0.0");
  }
  if (
    !Array.isArray(protocolVersions) ||
    !protocolVersions.some(
      (version) => isObject(version) && version.major === 1,
    )
  ) {
    issues.push("protocolVersions: include { major: 1, minor: 0 }");
  }
  if (
    !Array.isArray(capabilities) ||
    !capabilities.some(
      (capability) =>
        isObject(capability) &&
        capability.id === "lifecycle" &&
        capability.version === 1,
    )
  ) {
    issues.push(
      'capabilities: must include { id: "lifecycle", version: 1 }; list each capability as { id, version: 1 }',
    );
  }
  if (ports !== undefined) {
    if (!Array.isArray(ports)) {
      issues.push("ports: expected an array");
    } else {
      ports.forEach((port, index) => {
        if (
          !isObject(port) ||
          typeof port.id !== "string" ||
          typeof port.label !== "string" ||
          (port.direction !== "in" && port.direction !== "out") ||
          (port.type !== "midi1" && port.type !== "event")
        ) {
          issues.push(
            `ports[${index}]: needs id, label, direction "in" or "out", and type "midi1" or "event"`,
          );
        }
      });
    }
  }

  try {
    // audiframe's validator is the authority on the shape.
    validateManifest(manifest as unknown as Manifest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!issues.length) {
      issues.push(
        message === "INVALID_MESSAGE"
          ? "The manifest doesn't match audiframe's schema (check field types, unknown fields and limits)."
          : message,
      );
    }
    return { valid: false, issues };
  }
  return { valid: issues.length === 0, issues };
}
