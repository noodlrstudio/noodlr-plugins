# Noodlr Plugin SDK

Use `@noodlrstudio/plugin-sdk/web-app` to connect an independently hosted web app to
Noodlr graph MIDI, runtime state, and board-restored JSON state. Transport
message types are reserved for a future authoritative board timeline.

The bridge does not move Web Audio nodes or PCM across an iframe boundary.
Graph-routed audio plugins use the reviewed WAM, CMajor, or WCLAP contribution
path; see "Curated audio plugins and WCLAP" in `docs/architecture.md`.

The package builds framework-neutral ESM and declarations into `dist`. Run
`npm run build`, then publish the workspace as a separate public npm release.
