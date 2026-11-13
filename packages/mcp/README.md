# @noodlrstudio/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for building
Noodlr Board plugins with a coding agent. It gives the agent the plugin
contracts, schemas, UI kit and theme tokens, and the checks reviewers run, so it
writes plugins against the real API instead of guessing.

It runs locally over stdio. It needs no account and sends nothing anywhere.

Full guide, with a walkthrough that builds a compressor:
[Building plugins with a coding agent](../../docs/mcp.md).

## Set up

Claude Code:

```sh
claude mcp add noodlr -- npx -y @noodlrstudio/mcp
```

Any other MCP client: run `npx -y @noodlrstudio/mcp` as a stdio server. For example,
in a project `.mcp.json`:

```json
{
  "mcpServers": {
    "noodlr": { "command": "npx", "args": ["-y", "@noodlrstudio/mcp"] }
  }
}
```

Paths in tool arguments are resolved against the directory the server starts
in, normally your project.

## What it provides

### Resources

| URI                                      | Contents                                              |
| ---------------------------------------- | ----------------------------------------------------- |
| `noodlr://docs/overview`                 | Plugin routes, when to use each, and the workflow     |
| `noodlr://docs/design-rules`             | Theming, capability, state and lifecycle rules        |
| `noodlr://docs/capabilities`             | Every capability and the context API behind it        |
| `noodlr://docs/web-app-bridge`           | The web app bridge and the rules the host enforces    |
| `noodlr://docs/submitting`               | What a review pull request needs                      |
| `noodlr://ui/components`                 | `@noodlrstudio/ui` Play node controls and their props |
| `noodlr://theme/tokens`                  | The `--noodlr-*` tokens for Light and Dark            |
| `noodlr://schemas/play-node/manifest`    | Play node manifest JSON Schema                        |
| `noodlr://schemas/play-node/definition`  | Play node definition JSON Schema                      |
| `noodlr://schemas/audio-plugin/manifest` | WAM 2 / Cmajor / WCLAP manifest JSON Schema           |

### Tools

| Tool                             | What it does                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| `scaffold_plugin`                | Creates a Play node or web app bridge project                      |
| `validate_play_node`             | Validates a manifest, state fields and ports, including defaults   |
| `validate_web_app_manifest`      | Checks a bridge manifest the way the host does                     |
| `validate_audio_plugin_manifest` | Validates a curated audio plugin manifest                          |
| `check_capabilities`             | Compares declared capabilities with the context APIs the code uses |
| `lint_theme`                     | Finds colour literals that should be `--noodlr-*` tokens           |

`check_capabilities` is a static check. A missing capability is reliable; an
"unused" one may be reached in a way the check cannot see, so treat it as a
prompt to look.

### Prompts

- `create-play-node`: build a Play node from an idea, end to end.
- `connect-web-app`: add the bridge to an existing web app.
- `prepare-for-review`: run every check and list what review still needs.

## Developing

```sh
npm run build   # regenerates the UI catalogue from packages/ui, then compiles
npm test
```

`src/generated/ui-catalogue.ts` is generated from `packages/ui/src/play-node`.
Do not edit it by hand.

To call the built server by hand, use `scripts/call.mjs` (run from the repo
root, so paths resolve there):

```sh
node packages/mcp/scripts/call.mjs tools
node packages/mcp/scripts/call.mjs check_capabilities '{"directory":"examples/compressor-play-node"}'
```

Or open it in the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):
`npx @modelcontextprotocol/inspector node packages/mcp/dist/bin.js`.

## Releasing

1. Bump `version` in `package.json`, `src/server.ts` (`SERVER_VERSION`) and
   both places in `server.json`, and add a `CHANGELOG.md` entry.
2. Publish to npm: `npm publish` in this folder.
3. In GitHub, run **Actions › Publish to MCP Registry › Run workflow**. It
   checks that `server.json` matches the version on npm, then publishes it to
   the [MCP Registry](https://registry.modelcontextprotocol.io) as
   `io.github.noodlrstudio/noodlr`, using GitHub's OIDC identity for the
   noodlrstudio organization.

`mcp-publisher login github` run on your own machine can't publish under the
organization: it only sees your personal account.
