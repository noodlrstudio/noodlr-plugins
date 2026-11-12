// Calls the built server over stdio, the same way an MCP client does, and
// prints the result. For trying the server out and debugging it.
//
//   node packages/mcp/scripts/call.mjs tools
//   node packages/mcp/scripts/call.mjs read noodlr://docs/capabilities
//   node packages/mcp/scripts/call.mjs prompt create-play-node '{"idea":"a compressor"}'
//   node packages/mcp/scripts/call.mjs scaffold_plugin '{"route":"play-node",...}'
//
// Paths in tool arguments resolve against the current directory.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bin = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/bin.js");
const [command, first, second] = process.argv.slice(2);
if (!command) {
  console.error(
    "Usage: call.mjs tools | read <uri> | prompt <name> [json] | <tool> [json]",
  );
  process.exit(2);
}

const client = new Client({ name: "noodlr-mcp-call", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [bin],
    cwd: process.cwd(),
  }),
);

let exitCode = 0;
try {
  if (command === "tools") {
    for (const tool of (await client.listTools()).tools) {
      console.log(`${tool.name}: ${tool.description}`);
    }
  } else if (command === "read") {
    const result = await client.readResource({ uri: first });
    for (const content of result.contents) console.log(content.text);
  } else if (command === "prompt") {
    const result = await client.getPrompt({
      name: first,
      arguments: second ? JSON.parse(second) : {},
    });
    for (const message of result.messages) console.log(message.content.text);
  } else {
    const result = await client.callTool({
      name: command,
      arguments: first ? JSON.parse(first) : {},
    });
    for (const content of result.content) console.log(content.text);
    if (result.isError) exitCode = 1;
  }
} finally {
  await client.close();
}
process.exit(exitCode);
