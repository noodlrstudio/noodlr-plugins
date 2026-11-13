import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNoodlrMcpServer } from "./server";

let client: Client;
let workdir: string;

beforeAll(async () => {
  workdir = await mkdtemp(join(tmpdir(), "noodlr-mcp-"));
  const server = createNoodlrMcpServer({ cwd: workdir });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
});

afterAll(async () => {
  await client.close();
  await rm(workdir, { recursive: true, force: true });
});

function text(response: { content: unknown }) {
  const [first] = response.content as Array<{ type: string; text: string }>;
  return JSON.parse(first.text);
}

describe("noodlr MCP server", () => {
  it("lists its tools, resources and prompts", async () => {
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toEqual(
      expect.arrayContaining([
        "scaffold_plugin",
        "validate_play_node",
        "validate_audiframe_manifest",
        "validate_web_app_manifest",
        "validate_audio_plugin_manifest",
        "check_capabilities",
        "lint_theme",
      ]),
    );
    const resources = (await client.listResources()).resources.map(
      (r) => r.uri,
    );
    expect(resources).toContain("noodlr://docs/overview");
    expect(resources).toContain("noodlr://schemas/play-node/manifest");
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    expect(prompts).toContain("create-play-node");
  });

  it("ends create-play-node with the Mac app local build", async () => {
    const prompt = await client.getPrompt({
      name: "create-play-node",
      arguments: { idea: "a compressor", id: "com.example.compressor" },
    });
    const [message] = prompt.messages as Array<{
      content: { text: string };
    }>;
    expect(message.content.text).toContain("npm run build:local");
    expect(message.content.text).toContain("dist-local/com.example.compressor");
    expect(message.content.text).toContain("Developer › Show Plugins Folder");
    expect(message.content.text).toContain("Developer › Open Node Lab");
  });

  it("serves every resource", async () => {
    for (const resource of (await client.listResources()).resources) {
      const read = await client.readResource({ uri: resource.uri });
      const [content] = read.contents as Array<{ text: string }>;
      expect(content.text.length, resource.uri).toBeGreaterThan(100);
    }
  });

  it("lists the UI kit components with their props", async () => {
    const read = await client.readResource({ uri: "noodlr://ui/components" });
    const [content] = read.contents as Array<{ text: string }>;
    expect(content.text).toContain("## Knob");
    expect(content.text).toContain("onCommit");
  });

  it("validates a Play node definition", async () => {
    const manifest = {
      id: "com.example.test-node",
      name: "Test",
      version: "0.1.0",
      apiVersion: "0",
    };
    const ok = await client.callTool({
      name: "validate_play_node",
      arguments: {
        manifest,
        state: {
          version: 1,
          fields: {
            level: { type: "number", default: 1, scope: "local-persisted" },
          },
        },
      },
    });
    expect(text(ok)).toEqual({ valid: true });

    const bad = await client.callTool({
      name: "validate_play_node",
      arguments: {
        manifest: { ...manifest, icon: "NotAnIcon" },
        state: {
          version: 1,
          fields: {
            level: {
              type: "number",
              minimum: 0,
              maximum: 1,
              default: 5,
              scope: "local-persisted",
            },
          },
        },
      },
    });
    expect(bad.isError).toBe(true);
    expect(text(bad).issues.join("\n")).toContain("icon");
  });

  it("validates audiframe manifests with audiframe's own checks", async () => {
    const good = await client.callTool({
      name: "validate_audiframe_manifest",
      arguments: {
        manifest: {
          id: "com.example.drum-machine",
          name: "Drum Machine",
          appVersion: "1.0.0",
          protocolVersions: [{ major: 1, minor: 0 }],
          capabilities: [
            { id: "lifecycle", version: 1 },
            { id: "midi.input", version: 1 },
          ],
          ports: [
            { id: "midi-in", label: "MIDI In", direction: "in", type: "midi1" },
          ],
        },
      },
    });
    expect(text(good)).toEqual({ valid: true, issues: [] });

    const bad = await client.callTool({
      name: "validate_audiframe_manifest",
      arguments: {
        manifest: {
          id: "drum",
          name: "Drum Machine",
          appVersion: "1",
          protocolVersions: [{ major: 2, minor: 0 }],
          capabilities: [{ id: "midi.input", version: 1 }],
          ports: [
            { id: "midi-in", label: "In", direction: "in", type: "midi" },
          ],
        },
      },
    });
    expect(bad.isError).toBe(true);
    const issues = text(bad).issues.join("\n");
    for (const field of [
      "id:",
      "appVersion:",
      "protocolVersions:",
      "lifecycle",
      "ports[0]",
    ]) {
      expect(issues).toContain(field);
    }

    const web = await client.readResource({ uri: "noodlr://docs/web-apps" });
    const [content] = web.contents as Array<{ text: string }>;
    expect(content.text).toContain("@audiframe/client@0.1.0-alpha.2");
    expect(content.text).toContain("?audiframe=1");
  });

  it("validates legacy web app and audio plugin manifests", async () => {
    const web = await client.callTool({
      name: "validate_web_app_manifest",
      arguments: { manifest: { id: "bad", name: "x", version: "1" } },
    });
    expect(web.isError).toBe(true);

    const audio = await client.callTool({
      name: "validate_audio_plugin_manifest",
      arguments: { manifest: { schemaVersion: 1, format: "vst3" } },
    });
    expect(audio.isError).toBe(true);
    expect(text(audio).issues.length).toBeGreaterThan(1);
  });

  it("scaffolds a Play node that passes its own checks", async () => {
    const created = await client.callTool({
      name: "scaffold_plugin",
      arguments: {
        route: "play-node",
        id: "com.example.chord-pad",
        name: "Chord Pad",
        directory: "chord-pad",
      },
    });
    expect(text(created).created).toBe(true);
    expect(await readdir(join(workdir, "chord-pad", "src"))).toContain(
      "ChordPad.svelte",
    );

    const again = await client.callTool({
      name: "scaffold_plugin",
      arguments: {
        route: "play-node",
        id: "com.example.chord-pad",
        name: "Chord Pad",
        directory: "chord-pad",
      },
    });
    expect(again.isError).toBe(true);

    const capabilities = await client.callTool({
      name: "check_capabilities",
      arguments: { directory: "chord-pad" },
    });
    expect(text(capabilities).ok).toBe(true);

    const theme = await client.callTool({
      name: "lint_theme",
      arguments: { directory: "chord-pad" },
    });
    expect(text(theme).ok).toBe(true);
  });
});
