import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PLAY_NODE_CAPABILITIES,
  PlayNodeValidationError,
  curatedAudioPluginManifestSchema,
  playNodeSchemasAsJsonSchema,
  renderPlayAppearanceCss,
  validatePlayNodeDefinition,
  validatePlayNodeManifest,
} from "@noodlr/play-api";
import { sanitizeNoodlrWebAppPluginManifest } from "@noodlr/plugin-sdk/web-app";
import { z } from "zod";
import { checkCapabilities, findDeclaredCapabilities } from "./capabilities.js";
import {
  capabilitiesMarkdown,
  designRulesMarkdown,
  overviewMarkdown,
  submittingMarkdown,
  themeTokensMarkdown,
  uiComponentsMarkdown,
  webAppBridgeMarkdown,
} from "./knowledge.js";
import { readSourceFiles } from "./source-files.js";
import { lintTheme } from "./theme-lint.js";
import {
  localPluginSteps,
  scaffoldFiles,
  scaffoldIssues,
} from "./templates.js";

export const SERVER_NAME = "noodlr";
export const SERVER_VERSION = "0.1.0";

export interface NoodlrMcpServerOptions {
  /** Directory that relative paths in tool arguments resolve against. */
  cwd?: string;
}

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function result(value: unknown, isError = false): ToolResult {
  return {
    content: [
      {
        type: "text",
        text:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

function failure(error: unknown): ToolResult {
  if (error instanceof PlayNodeValidationError) {
    return result(
      { valid: false, message: error.message, issues: error.issues },
      true,
    );
  }
  return result(
    {
      valid: false,
      message: error instanceof Error ? error.message : String(error),
    },
    true,
  );
}

const jsonObject = z.record(z.string(), z.unknown());

export function createNoodlrMcpServer(options: NoodlrMcpServerOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Tools and reference for building Noodlr Board plugins: Play nodes (Svelte + @noodlr/play-api), web app bridge plugins (@noodlr/plugin-sdk) and audio plugins (WAM 2, Cmajor, WCLAP). Read noodlr://docs/overview first. After editing a Play node, run validate_play_node, check_capabilities and lint_theme.",
    },
  );

  // ---------------------------------------------------------------- resources

  const markdown = (
    name: string,
    uri: string,
    title: string,
    description: string,
    render: () => string,
  ) =>
    server.registerResource(
      name,
      uri,
      { title, description, mimeType: "text/markdown" },
      async () => ({
        contents: [{ uri, mimeType: "text/markdown", text: render() }],
      }),
    );

  const jsonResource = (
    name: string,
    uri: string,
    title: string,
    description: string,
    render: () => unknown,
  ) =>
    server.registerResource(
      name,
      uri,
      { title, description, mimeType: "application/schema+json" },
      async () => ({
        contents: [
          {
            uri,
            mimeType: "application/schema+json",
            text: JSON.stringify(render(), null, 2),
          },
        ],
      }),
    );

  markdown(
    "overview",
    "noodlr://docs/overview",
    "Building Noodlr plugins",
    "Plugin routes, when to use each, and the workflow with this server.",
    overviewMarkdown,
  );
  markdown(
    "design-rules",
    "noodlr://docs/design-rules",
    "Play node design rules",
    "Theming, capability, state and lifecycle rules reviewers check.",
    designRulesMarkdown,
  );
  markdown(
    "capabilities",
    "noodlr://docs/capabilities",
    "Play node capabilities",
    "Every capability, what it unlocks and the context API behind it.",
    capabilitiesMarkdown,
  );
  markdown(
    "ui-components",
    "noodlr://ui/components",
    "@noodlr/ui components",
    "Play node controls and their props, generated from the UI kit.",
    uiComponentsMarkdown,
  );
  markdown(
    "theme-tokens",
    "noodlr://theme/tokens",
    "Theme tokens",
    "The --noodlr-* CSS custom properties for Light and Dark themes.",
    () => themeTokensMarkdown(renderPlayAppearanceCss()),
  );
  markdown(
    "web-app-bridge",
    "noodlr://docs/web-app-bridge",
    "Web app bridge",
    "Connecting a hosted web app with @noodlr/plugin-sdk/web-app.",
    webAppBridgeMarkdown,
  );
  markdown(
    "submitting",
    "noodlr://docs/submitting",
    "Submitting for review",
    "What a review pull request needs.",
    submittingMarkdown,
  );
  jsonResource(
    "play-node-manifest-schema",
    "noodlr://schemas/play-node/manifest",
    "Play node manifest JSON Schema",
    "JSON Schema (draft 2020-12) for a Play node manifest.",
    () => playNodeSchemasAsJsonSchema().manifest,
  );
  jsonResource(
    "play-node-definition-schema",
    "noodlr://schemas/play-node/definition",
    "Play node definition JSON Schema",
    "JSON Schema for a Play node's manifest, state fields and ports.",
    () => playNodeSchemasAsJsonSchema().definition,
  );
  jsonResource(
    "audio-plugin-manifest-schema",
    "noodlr://schemas/audio-plugin/manifest",
    "Audio plugin manifest JSON Schema",
    "JSON Schema for a curated WAM 2, Cmajor or WCLAP plugin manifest.",
    () =>
      z.toJSONSchema(curatedAudioPluginManifestSchema, {
        target: "draft-2020-12",
      }),
  );

  // -------------------------------------------------------------------- tools

  server.registerTool(
    "scaffold_plugin",
    {
      title: "Scaffold a plugin",
      description:
        "Create a new Play node (Svelte, reviewed) or web app bridge plugin (no review). With `directory`, writes the files there (it must be empty or not exist); otherwise returns them.",
      inputSchema: {
        route: z.enum(["play-node", "web-app"]),
        id: z
          .string()
          .describe("Reverse-domain id, such as com.example.my-node"),
        name: z.string().describe("Display name, up to 80 characters"),
        description: z.string().optional(),
        directory: z
          .string()
          .optional()
          .describe(
            "Where to write the project, relative to the working directory",
          ),
      },
    },
    async ({ route, id, name, description, directory }) => {
      const scaffold = { route, id, name, description };
      const issues = scaffoldIssues(scaffold);
      if (issues.length) return result({ created: false, issues }, true);
      const files = scaffoldFiles(scaffold);
      if (!directory) return result({ created: false, files });
      const target = resolve(cwd, directory);
      const existing = await readdir(target).catch(() => null);
      if (existing && existing.length) {
        return result(
          {
            created: false,
            issues: [`${target} already exists and is not empty`],
          },
          true,
        );
      }
      for (const file of files) {
        const path = join(target, file.path);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.content);
      }
      return result({
        created: true,
        directory: target,
        files: files.map((file) => file.path),
        next: [
          `cd ${target} && npm install`,
          route === "play-node"
            ? "npm run validate"
            : "npm run dev, then add the URL to a board as a web app node",
        ],
      });
    },
  );

  server.registerTool(
    "validate_play_node",
    {
      title: "Validate a Play node definition",
      description:
        "Validate a Play node's manifest, state fields and ports against the host's rules, including that state defaults are valid. Pass the objects from your definePlayNode call as JSON.",
      inputSchema: {
        manifest: jsonObject,
        state: z
          .object({ version: z.number(), fields: jsonObject })
          .optional()
          .describe("The `state` object. Omit to validate the manifest alone."),
        ports: z.array(jsonObject).optional(),
      },
    },
    async ({ manifest, state, ports }) => {
      try {
        if (!state) {
          validatePlayNodeManifest(manifest);
        } else {
          validatePlayNodeDefinition({
            manifest,
            state,
            ports,
          } as unknown as Parameters<typeof validatePlayNodeDefinition>[0]);
        }
        return result({ valid: true });
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "validate_web_app_manifest",
    {
      title: "Validate a web app bridge manifest",
      description:
        "Check a manifest for createNoodlrWebAppBridge the way the host does. Returns the manifest as the host will see it.",
      inputSchema: { manifest: jsonObject },
    },
    async ({ manifest }) => {
      const sanitized = sanitizeNoodlrWebAppPluginManifest(manifest);
      if (!sanitized) {
        return result(
          {
            valid: false,
            message:
              "The host will reject this manifest. Read noodlr://docs/web-app-bridge for the rules: reverse-domain id, semver version, name up to 80 characters, at most 8 unique MIDI ports with direction in or out.",
          },
          true,
        );
      }
      return result({ valid: true, manifest: sanitized });
    },
  );

  server.registerTool(
    "validate_audio_plugin_manifest",
    {
      title: "Validate an audio plugin manifest",
      description:
        "Validate a curated WAM 2, Cmajor or WCLAP plugin manifest, including checksums and ports.",
      inputSchema: { manifest: jsonObject },
    },
    async ({ manifest }) => {
      const parsed = curatedAudioPluginManifestSchema.safeParse(manifest);
      if (parsed.success) return result({ valid: true });
      return result(
        {
          valid: false,
          issues: parsed.error.issues.map(
            (issue) =>
              `${issue.path.join(".") || "manifest"}: ${issue.message}`,
          ),
        },
        true,
      );
    },
  );

  server.registerTool(
    "check_capabilities",
    {
      title: "Check declared capabilities",
      description:
        "Compare the capabilities a Play node declares with the context APIs its source uses. Reports missing (the host will refuse the call) and unused (reviewers will ask) capabilities. Static heuristic: treat 'unused' as a prompt to check, not proof.",
      inputSchema: {
        directory: z
          .string()
          .describe("The Play node project or its src folder"),
        declared: z
          .array(z.string())
          .optional()
          .describe(
            "Declared capabilities. Omit to read them from the definePlayNode manifest.",
          ),
      },
    },
    async ({ directory, declared }) => {
      try {
        const files = await readSourceFiles(resolve(cwd, directory));
        const found = declared ? null : findDeclaredCapabilities(files);
        if (!declared && !found) {
          return result(
            {
              ok: false,
              message:
                "No definePlayNode call found. Pass `declared` explicitly.",
              knownCapabilities: PLAY_NODE_CAPABILITIES,
            },
            true,
          );
        }
        const report = checkCapabilities(
          declared ?? found!.capabilities,
          files,
        );
        return result(
          { ...report, manifestFile: found?.file, filesScanned: files.length },
          !report.ok,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "lint_theme",
    {
      title: "Find colour literals",
      description:
        "Find hex, rgb(), hsl(), oklch() and named colours in .css files and Svelte <style> blocks. Play nodes must use --noodlr-* tokens so they work in Light and Dark themes.",
      inputSchema: { directory: z.string() },
    },
    async ({ directory }) => {
      try {
        const files = await readSourceFiles(resolve(cwd, directory));
        const findings = lintTheme(files);
        return result(
          { ok: findings.length === 0, findings, filesScanned: files.length },
          findings.length > 0,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  // ------------------------------------------------------------------ prompts

  server.registerPrompt(
    "create-play-node",
    {
      title: "Create a Play node",
      description: "Build a new reviewed Play node from an idea.",
      argsSchema: {
        idea: z.string().describe("What the node should do"),
        id: z.string().optional().describe("Reverse-domain id"),
      },
    },
    ({ idea, id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Build a Noodlr Board Play node: ${idea}

1. Read noodlr://docs/overview, noodlr://docs/design-rules, noodlr://docs/capabilities and noodlr://ui/components.
2. Call scaffold_plugin with route "play-node"${id ? ` and id "${id}"` : ""}.
3. Implement the node. Use @noodlr/ui controls and --noodlr-* tokens only. Declare exactly the capabilities you use.
4. Add tests with createMockPlayNodeContext.
5. Run validate_play_node, check_capabilities and lint_theme, then the project's tests, and fix everything they report.
6. Run \`npm run build:local\` in the project to build it for the Noodlr Mac app. It writes dist-local/${id ?? "<id>"}/. Then tell the developer how to try it:

${localPluginSteps(id ?? "<id>")}`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "connect-web-app",
    {
      title: "Connect a web app to Noodlr",
      description: "Add the web app bridge to an existing web app.",
      argsSchema: {
        id: z.string().optional().describe("Reverse-domain id"),
      },
    },
    ({ id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Connect this web app to Noodlr Board with the web app bridge.

1. Read noodlr://docs/web-app-bridge.
2. Add @noodlr/plugin-sdk and create the bridge once at start-up${id ? ` with id "${id}"` : ""}. Declare only the MIDI ports the app needs.
3. Route incoming MIDI to the app, send its MIDI out with bridge.sendMidi, and save restorable state with bridge.updateState (JSON, at most 32 KB).
4. Apply onAppearanceChange tokens so the app matches the host theme.
5. Run validate_web_app_manifest on the manifest.

The bridge does not carry audio. If the app needs Noodlr's audio, say so and suggest a Play node or an audio plugin instead.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "prepare-for-review",
    {
      title: "Prepare a plugin for review",
      description:
        "Run every check and list what a review pull request still needs.",
      argsSchema: {
        directory: z.string().describe("The plugin project"),
      },
    },
    ({ directory }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Get the plugin in ${directory} ready for Noodlr review.

1. Read noodlr://docs/submitting and noodlr://docs/design-rules.
2. Run check_capabilities and lint_theme on ${directory}, and validate_play_node or validate_audio_plugin_manifest on its manifest.
3. Run the project's tests.
4. Fix what you can, then list anything left: missing licence, missing tests, missing checksums, capabilities you could not confirm.`,
          },
        },
      ],
    }),
  );

  return server;
}
