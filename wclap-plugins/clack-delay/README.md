# Clack Delay (WCLAP source)

noodlr's curated tempo-synced delay, written in Rust on
[Clack](https://github.com/prokopyl/clack) and compiled to `wasm32-unknown-unknown`.

- Two Hermite-interpolated lines. Clean crossfades to a new time; Tape glides
  to it (a pitch bend) and adds wow and flutter set by Age.
- Low and high cut inside the feedback loop, so repeats thin and darken.
  Feedback runs to 110 % under a soft limiter, so it can self-oscillate safely.
- Modes: Stereo, Ping-pong (input enters left and bounces), Dual (its own right time).
- Freeze holds the loop at unity with no new input; Ducking dips the echoes
  while you play; Width narrows the wet signal.
- Sync reads the tempo from the host's CLAP transport (noodlr sends the space tempo).

- `src/params.rs` — the param table. Ids are persisted by noodlr, so never
  renumber them; append new ones.
- `src/delay.rs` — the DSP and its tests.

## Build and test

```bash
rustup target add wasm32-unknown-unknown
cargo test --target "$(rustc -vV | sed -n 's/host: //p')" --release
./build.sh
```

`build.sh` vendors `module.wasm` into
`apps/web/src/lib/curated-plugins/vendor/wclap/clack-delay/<version>/` and prints
the checksums to paste into `wclap-packages.ts`. The build is reproducible, so an
unchanged source gives the same SHA-256. Bump `version` in `Cargo.toml` when the
sound or params change.
