# Clack PolySynth (WCLAP source)

noodlr's curated WCLAP polysynth, written in Rust on
[Clack](https://github.com/prokopyl/clack) and compiled to `wasm32-unknown-unknown`.
It started from Clack's `polysynth` example and adds band-limited (PolyBLEP)
oscillators with detune and a sub, a resonant 4-pole state-variable filter with
its own envelope, an ADSR, drive, vibrato and stereo output.

- `src/params.rs` — the param table. Ids are persisted by noodlr and its presets,
  so never renumber them; append new ones.
- `src/synth.rs` — voices and rendering. `src/dsp.rs` — oscillators, filter, envelope.
- Presets are host-side: `apps/web/src/lib/curated-plugins/wclap/polysynth-presets.ts`.

## Build

```bash
rustup target add wasm32-unknown-unknown
./build.sh
```

`build.sh` vendors `module.wasm` into
`apps/web/src/lib/curated-plugins/vendor/wclap/clack-polysynth/<version>/` and prints
the checksums to paste into `wclap-packages.ts`. The build is reproducible, so an
unchanged source gives the same SHA-256. Changing the module changes its checksum,
and saved nodes from another build show as unavailable, so bump `version` in
`Cargo.toml` when the sound or params change.
