# Contributing

Thanks for your interest in building for Noodlr Board.

## Status

This repository is an early preview. During this phase the packages, schemas
and starters are synced in from the main Noodlr codebase, so a change made
only here can be overwritten by the next sync. Please open an issue before
starting on anything larger than a small fix, so the change can be made in
the right place.

## Setup

Requirements: Node.js 24 (see `.nvmrc`) and npm 11.

```sh
npm install
npm run build
npm test
```

## Before opening a pull request

- `npm run check` passes (type checks and `prettier --check`)
- `npm test` passes
- New behaviour has tests
- Changes to a published package have an entry in `CHANGELOG.md`

Run `npm run format` to apply the formatting rules.

## Submitting a plugin for review

Play nodes and audio plugins are reviewed before they ship. See the
"Submitting a plugin for review" section of the [README](README.md).

## Licence

By contributing you agree that your contribution is licensed under the
[MIT licence](LICENSE). The reference plugins in `wclap-plugins/` are
MIT OR Apache-2.0 and carry their own licence files.
