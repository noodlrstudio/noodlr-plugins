# Phase 1 migration guide

Working notes for moving the plugin developer surface out of the private
`5of12/noodlrboard` repo into `noodlr-plugins`. Written against noodlrboard
commit `ad381af`. Delete this file, or move it out of the public tree, before
the repo goes public.

## Goal

A developer with no access to noodlrboard can:

1. `npm install @noodlr/play-api @noodlr/ui @noodlr/plugin-sdk`
2. Copy a starter, type-check it and run its tests
3. Read the API reference and the submission process

Phase 1 does not give them a host to run a node in. That is Phase 3 (Node Lab).

## Scope

**In:**

| From noodlrboard | To noodlr-plugins | Files |
| --- | --- | --- |
| `packages/play-api` | `packages/play-api` | contract, validation, mock context, generators |
| `packages/ui` | `packages/ui` | 12 Svelte controls, `tokens.css` |
| `packages/plugin-sdk` | `packages/plugin-sdk` | web app bridge |
| `schemas/play-api/v0` | `schemas/play-api/v0` | 2 generated JSON Schemas |
| `examples/*` | `examples/*` | 4 starters |
| `wclap-plugins/*` | `wclap-plugins/*` | 2 Rust CLAP plugins |

About 87 files and 650 KB in total. Keep the same relative layout: the
generators in `packages/play-api/scripts` write to `../../../schemas/play-api/v0`
and read `../../ui/src/theme/tokens.css`, so they work unchanged.

**Out (later phases):**

- Shared node helpers (`PlayNodeHeader`, `MidiOutToggle`, `midi-out`, `scales`) and reference nodes: Phase 2
- Node Lab and the host runtime in `apps/web/src/lib/play-api`: Phase 3
- Any change to how noodlrboard consumes these packages: it keeps its workspace copies for now

## Decisions to make before starting

1. **Licence.** The README assumes MIT, matching audiframe. Apache-2.0 is the
   alternative if you want an explicit patent grant. Relicensing from AGPL is
   yours to do only for code you hold the copyright on, so confirm every
   contributor to these paths in the full history
   (`git log --format=%an -- packages/play-api packages/ui packages/plugin-sdk examples schemas | sort -u`).
2. **npm scope.** Confirm you own the `@noodlr` organisation on npm.
   `plugin-sdk` is already configured for public publishing under it.
3. **History.** Recommended: import as a fresh commit with the source SHA
   recorded. `git filter-repo` would keep history but also publishes old commit
   messages and any file that ever lived under those paths.
4. **GitHub owner.** audiframe lives under `noodlrstudio`; noodlrboard under
   `5of12`. Pick one for this repo before links are written into docs.

## Steps

Each step is one pull request or commit. Run the check at the end of each.

### 1. Scaffold the repo

- Root `package.json`: `private: true`, `workspaces: ["packages/*", "examples/*"]`,
  scripts `build`, `test`, `check`, `format`.
- `.nvmrc` with `24.11.0`, `.gitignore`, `.prettierrc` copied from noodlrboard.
- `LICENSE` (chosen licence), `CHANGELOG.md`, `CONTRIBUTING.md`.
- `UPSTREAM` file containing the noodlrboard commit SHA of the last sync.

Check: `npm install` succeeds on an empty workspace.

### 2. Add the sync script

`scripts/sync-from-monorepo.sh <path-to-noodlrboard>`:

- `rsync -a --delete` each path in the scope table, excluding `node_modules`,
  `dist` and `target`
- Leaves `package.json` files alone after the first import, because they
  diverge (see step 3)
- Writes the source SHA to `UPSTREAM`

The private repo stays the source of truth during Phase 1. Flip the direction
once outside pull requests start arriving.

Check: running it twice produces no diff.

### 3. Make `@noodlr/play-api` publishable

Current state: `private: true`, `main` points at `src/index.ts`, no build.

- Remove `private`; set `license`; add `publishConfig.access: "public"`,
  `files: ["dist", "README.md"]`, `sideEffects: false`.
- Add `tsconfig.build.json` modelled on `plugin-sdk`'s (ES2022, NodeNext,
  declarations). Exclude `*.test.ts`.
- Point `main`, `types` and `exports` at `dist`. Add a `./testing` export so
  `createMockPlayNodeContext` is not pulled into production bundles.
- NodeNext needs `.js` extensions on relative imports; `index.ts` currently
  uses `./appearance` style paths. Either add the extensions or build with
  `moduleResolution: "Bundler"`.
- Keep `zod` as a dependency and `svelte` as a peer dependency (type-only use).
- Write a package README.

Check: `npm run build && npm test -w packages/play-api`, then
`npm pack --dry-run` lists only `dist` and the README.

### 4. Make `@noodlr/ui` publishable

Current state: `private: true`, version `0.0.0`, exports raw `.svelte` source.

- Build with `@sveltejs/package` (`svelte-package -i src -o dist`), which emits
  preprocessed components plus `.d.ts`.
- Exports: `.`, `./play-node`, `./theme.css`, each with `types` and `svelte`
  conditions.
- Version `0.1.0`; depend on `@noodlr/play-api` by published range.
- `svelte` stays a peer dependency. This matters: a node and the host must
  share one Svelte runtime.

Check: `svelte-check` passes; `npm pack --dry-run` contains `dist/theme/tokens.css`.

### 5. Bring over `@noodlr/plugin-sdk`

Already publishable. Change the `license` field and README links only.

Check: `npm test -w packages/plugin-sdk`.

### 6. Fix the starters

- Update dependency ranges (`@noodlr/ui` is `^0.0.0` in `play-node-starter`).
- `play-node-starter` has an `npm run dev` script but no `index.html`, so it
  has nothing to serve. Either add a minimal preview page that mounts the node
  with `createMockPlayNodeContext`, or remove the script until Node Lab exists.
- Rewrite the README lines that describe copying into "a reviewed development
  workspace" and "Noodlr's trusted allowlist" for an outside reader.
- Fix links to docs that do not exist yet: `docs/play-api/api-reference.md`,
  `docs/plugin-sdk/audio-plugins.md`, `docs/plugin-sdk/submitting.md`,
  `docs/architecture.md`.

Check: from a clean clone, `npm install && npm run validate -w examples/play-node-starter`.

### 7. Bring over the WCLAP plugins

- Both `build.sh` scripts write into
  `apps/web/src/lib/curated-plugins/vendor/wclap/...`. Change them to take an
  output directory (default `./dist`) and print the checksums.
- Both READMEs reference private paths (`wclap-packages.ts`,
  `polysynth-presets.ts`). Reword or remove.
- Keep their existing MIT OR Apache-2.0 licence files and the Clack attribution.

Check: `cargo test` in each; `./build.sh` produces `module.wasm` locally.

### 8. Write the docs

There is no markdown source for these today; the content lives in Svelte pages
under `apps/web/src/routes/developers/`.

- `docs/play-api/api-reference.md`: capabilities, state scopes, context APIs,
  theming tokens. Generate the type tables from `packages/play-api/src/types.ts`
  where possible so they cannot drift.
- `docs/plugin-sdk/web-apps.md` and `docs/plugin-sdk/audio-plugins.md`.
- `docs/submitting.md`: what a review pull request must contain.
- `docs/compatibility.md`: the version-0 stability promise.

### 9. CI and release

- GitHub Actions on pull request: install, build, test, `svelte-check`,
  `prettier --check`, and a "schemas are up to date" job that runs
  `generate:schemas` and fails on diff.
- Release with Changesets or a tag-triggered workflow using npm provenance.
- First publish order: `play-api`, then `ui`, then `plugin-sdk`.

### 10. Pre-publication review

Before making the repo public:

- Replace the two `https://github.com/5of12/noodlrboard` URLs in the moved code.
- Grep for `apps/web`, `$lib`, `allowlist`, `supabase` and internal names.
  At `ad381af` the only hits are in the WCLAP build scripts and READMEs
  (step 7) and the starter READMEs (step 6).
- `noodlr.test` and `evil.test` appear in test fixtures; these are fine.
- Remove this file.

## Done when

- A fresh machine can `npm create`/copy the Play node starter, install from the
  public registry, and pass `npm run validate`
- CI is green on `main`
- `UPSTREAM` matches the noodlrboard commit the packages were synced from
- Nothing in the repo refers to a private path or repository

## Follow-up in noodlrboard (not Phase 1)

- Decide when the app switches from workspace copies to the npm packages
- Each `$lib/...` import inside a first-party Play node is a capability a
  third party does not have; list them as Play API gaps for Phase 2
