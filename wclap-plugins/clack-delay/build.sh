#!/usr/bin/env bash
# Builds the Clack Delay WCLAP and vendors it into the web app.
# Needs rustup with the wasm32-unknown-unknown target:
#   rustup target add wasm32-unknown-unknown
# After building, update the sha256 and checksums for "clack-delay" in
# apps/web/src/lib/curated-plugins/wclap/wclap-packages.ts with the values printed.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
version="$(sed -n 's/^version = "\(.*\)"/\1/p' "$here/Cargo.toml" | head -1)"
vendor="$here/../../apps/web/src/lib/curated-plugins/vendor/wclap/clack-delay/$version"

# Prefer rustup's toolchain over a Homebrew rustc without wasm targets.
if command -v rustup >/dev/null; then
  PATH="$(dirname "$(rustup which rustc)"):$PATH"
fi
(cd "$here" && cargo build --release --locked)

mkdir -p "$vendor"
cp "$here/target/wasm32-unknown-unknown/release/noodlr_clack_delay.wasm" "$vendor/module.wasm"

for file in LICENSE README.md module.wasm; do
  [ -f "$vendor/$file" ] || continue
  sri="sha256-$(openssl dgst -sha256 -binary "$vendor/$file" | openssl base64 -A)"
  echo "vendor/wclap/clack-delay/$version/$file: $sri"
done
echo "module.wasm sha256: $(shasum -a 256 "$vendor/module.wasm" | cut -d' ' -f1)"
