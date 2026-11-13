# Changelog

Notable changes to the packages in this repository. While the Play API is at
version `0`, minor releases may contain breaking changes; each one is recorded
here.

## Unreleased

- `@noodlrstudio/mcp`: `bin` points at `dist/bin.js` (no `./`), which npm
  normalizes to anyway; it stops a misleading publish warning.

## 2026-11-12: first npm release

Published as `@noodlrstudio/play-api` 0.3.0, `@noodlrstudio/ui` 0.1.0,
`@noodlrstudio/plugin-sdk` 0.1.0 and `@noodlrstudio/mcp` 0.1.0. The `@noodlr`
npm scope belongs to someone else, so the packages use `@noodlrstudio`.

- Repository scaffolded. Packages moved here from the main Noodlr codebase.
- Add `@noodlrstudio/mcp`, a local MCP server for building plugins with coding
  agents: docs, schemas, UI catalogue and theme tokens as resources; scaffold,
  validate, capability and theme checks as tools.
- `@noodlrstudio/plugin-sdk` and `@noodlrstudio/ui` are now MIT, like the rest of the
  repository.
- `@noodlrstudio/ui` 0.1.0 is publishable: it ships preprocessed components with
  type declarations from `dist` (built with `svelte-package`).
- The Play node JSON Schemas include the `MonitorPlay` icon, which the
  validator already accepted.
- `@noodlrstudio/mcp` has a `server.json` for the MCP Registry.
