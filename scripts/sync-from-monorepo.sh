#!/usr/bin/env bash
#
# Sync the plugin developer surface from a noodlrboard checkout into this repo.
#
#   scripts/sync-from-monorepo.sh <path-to-noodlrboard> [git-ref]
#
# Copies the committed contents of each path in SYNC_PATHS at <git-ref>
# (default: HEAD), so uncommitted or ignored files in the checkout are never
# imported. Files removed upstream are removed here. The source commit SHA is
# written to UPSTREAM.
#
# package.json files are copied only when they do not exist here yet, because
# they diverge from the monorepo once a package is made publishable.

set -euo pipefail

SYNC_PATHS=(
  packages/play-api
  packages/ui
  packages/plugin-sdk
  schemas/play-api/v0
  examples
  wclap-plugins
)

# Files that exist only in this repo, inside a synced path. They are never
# overwritten or deleted by a sync. Paths are relative to the repo root.
LOCAL_ONLY=(
  packages/play-api/README.md
  packages/play-api/tsconfig.build.json
  packages/play-api/scripts/add-js-extensions.mjs
  packages/ui/README.md
  packages/ui/svelte.config.js
  packages/ui/tsconfig.json
  examples/compressor-play-node
)

# The monorepo's workspace packages are @noodlr/*; they are published from
# here as @noodlrstudio/*. Every synced file is rewritten, so nothing published
# depends on the @noodlr scope, which this project doesn't control.
MONOREPO_SCOPE='@noodlr/'
PUBLISHED_SCOPE='@noodlrstudio/'

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <path-to-noodlrboard> [git-ref]" >&2
  exit 64
fi

source_repo=$1
source_ref=${2:-HEAD}
dest_root=$(cd "$(dirname "$0")/.." && pwd)

if ! git -C "$source_repo" rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: $source_repo is not a git checkout" >&2
  exit 1
fi

source_sha=$(git -C "$source_repo" rev-parse --verify "${source_ref}^{commit}")

staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT

git -C "$source_repo" archive "$source_sha" -- "${SYNC_PATHS[@]}" | tar -x -C "$staging"

# Rename the package scope in every text file before anything is copied.
# (Passed through the environment so Perl doesn't read "@noodlr" as an array.)
grep -rlI --null -F "$MONOREPO_SCOPE" "$staging" |
  FROM="$MONOREPO_SCOPE" TO="$PUBLISHED_SCOPE" \
    xargs -0 -r perl -pi -e 's/\Q$ENV{FROM}\E/$ENV{TO}/g'
if grep -rqI -F "$MONOREPO_SCOPE" "$staging"; then
  echo "error: $MONOREPO_SCOPE references remain after renaming" >&2
  exit 1
fi

for path in "${SYNC_PATHS[@]}"; do
  excludes=(
    --exclude=node_modules
    --exclude=dist
    --exclude=target
    --exclude=.DS_Store
    --exclude=package.json
  )
  for keep in ${LOCAL_ONLY[@]+"${LOCAL_ONLY[@]}"}; do
    if [[ $keep == "$path"/* ]]; then
      excludes+=("--exclude=/${keep#"$path"/}")
    fi
  done

  mkdir -p "$dest_root/$path"
  rsync -a --delete "${excludes[@]}" "$staging/$path/" "$dest_root/$path/"

  # First import only: bring over package.json files that are not here yet.
  while IFS= read -r manifest; do
    relative=${manifest#"$staging"/}
    if [[ ! -e "$dest_root/$relative" ]]; then
      cp "$manifest" "$dest_root/$relative"
      echo "added $relative"
    fi
  done < <(find "$staging/$path" -name package.json -not -path '*/node_modules/*')
done

printf '%s\n' "$source_sha" > "$dest_root/UPSTREAM"
echo "synced from $source_sha"
