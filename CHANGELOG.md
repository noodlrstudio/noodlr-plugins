# Changelog

Notable changes to the packages in this repository. While the Play API is at
version `0`, minor releases may contain breaking changes; each one is recorded
here.

## Unreleased

- Repository scaffolded. Packages are being moved here from the main Noodlr
  codebase and are not on npm yet.
- Add `@noodlr/mcp`, a local MCP server for building plugins with coding
  agents: docs, schemas, UI catalogue and theme tokens as resources; scaffold,
  validate, capability and theme checks as tools.
- `@noodlr/plugin-sdk` and `@noodlr/ui` are now MIT, like the rest of the
  repository.
- `@noodlr/ui` 0.1.0 is publishable: it ships preprocessed components with
  type declarations from `dist` (built with `svelte-package`).
- The Play node JSON Schemas include the `MonitorPlay` icon, which the
  validator already accepted.
- `@noodlr/mcp` has a `server.json` for the MCP Registry.
