# Changelog

Notable changes to the packages in this repository. While the Play API is at
version `0`, minor releases may contain breaking changes; each one is recorded
here.

## Unreleased

- `@noodlrstudio/mcp` 0.2.2: the local plugin steps (scaffold README, the
  `noodlr://docs` workflow and `docs/mcp.md`) cover **Developer › Open Local
  Room** in the Mac app 1.0.8, where a local plugin can be played with other
  nodes, and say local plugins need developer access.

## 2026-11-13: `@noodlrstudio/mcp` 0.2.1

- `@noodlrstudio/mcp` 0.2.1: uses `@audiframe/protocol` 0.1.0-alpha.3, whose
  type declarations now work with NodeNext, so its workaround is gone; the
  `web-app` scaffold and docs pin `@audiframe/client` 0.1.0-alpha.3.

## 2026-11-13: `@noodlrstudio/mcp` 0.2.0

- `@noodlrstudio/mcp` 0.2.0:
  - **Web apps use audiframe.** The `web-app` scaffold, the `connect-web-app`
    prompt and the `noodlr://docs/web-apps` guide (replacing
    `noodlr://docs/web-app-bridge`) use `@audiframe/client`, pinned to
    `0.1.0-alpha.2`, matching noodlr.xyz/developers. New tool
    `validate_audiframe_manifest` and resource
    `noodlr://schemas/audiframe/manifest`. `validate_web_app_manifest` stays,
    for apps on the earlier `@noodlrstudio/plugin-sdk` bridge.
  - **Browser preview.** Play node scaffolds include `index.html` and
    `src/preview.ts`: `npm run dev` shows the node with the mock host, the
    theme tokens, a Light / Dark switch and real Web Audio for audio ports,
    with a test tone.
  - `bin` points at `dist/bin.js` (no `./`), which npm normalizes to anyway; it
    stops a misleading publish warning.
- The starter and the compressor example have the same browser preview.
- The README covers installing from npm, developer access (with an issue form)
  and the current roadmap.

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
