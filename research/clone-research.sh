#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/repos.tsv"

usage() {
  cat <<'USAGE'
Usage:
  ./clone-research.sh                 Clone the six core research repos only.
  ./clone-research.sh core            Same as above.
  ./clone-research.sh optional NAME   Clone one optional repo by folder name.
  ./clone-research.sh optional all    Clone every optional repo.
  ./clone-research.sh list            Show the manifest.

Examples:
  ./clone-research.sh
  ./clone-research.sh optional discourse
  ./clone-research.sh optional flarum-framework
  ./clone-research.sh optional all
USAGE
}

clone_row() {
  local category="$1" folder="$2" repo="$3"
  local target="$SCRIPT_DIR/$category/$folder"

  if [[ -d "$target/.git" ]]; then
    echo "[skip] $category/$folder already cloned"
    return 0
  fi
  if [[ -e "$target" ]]; then
    echo "[warn] $target exists but is not a git clone; skipping"
    return 0
  fi

  echo "[clone] $category/$folder <- $repo"
  git clone --depth 1 --single-branch --no-tags "$repo" "$target"
}

clone_category() {
  local wanted="$1"
  while IFS=$'\t' read -r category folder repo size why; do
    [[ "$category" == "category" ]] && continue
    [[ "$category" == "$wanted" ]] || continue
    clone_row "$category" "$folder" "$repo"
  done < "$MANIFEST"
}

clone_optional_named() {
  local wanted="$1" found=0
  while IFS=$'\t' read -r category folder repo size why; do
    [[ "$category" == "category" ]] && continue
    [[ "$category" == "optional" ]] || continue
    [[ "$folder" == "$wanted" ]] || continue
    clone_row "$category" "$folder" "$repo"
    found=1
  done < "$MANIFEST"
  if [[ "$found" -eq 0 ]]; then
    echo "Unknown optional repo: $wanted" >&2
    echo "Available optional repos:" >&2
    awk -F'\t' 'NR>1 && $1=="optional" {print "  - "$2}' "$MANIFEST" >&2
    exit 2
  fi
}

mode="${1:-core}"
case "$mode" in
  core)
    clone_category core
    ;;
  optional)
    name="${2:-}"
    if [[ -z "$name" ]]; then usage; exit 2; fi
    if [[ "$name" == "all" ]]; then
      clone_category optional
    else
      clone_optional_named "$name"
    fi
    ;;
  list)
    column -t -s $'\t' "$MANIFEST" 2>/dev/null || cat "$MANIFEST"
    exit 0
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    usage
    exit 2
    ;;
esac

echo
echo "Done. Current research footprint:"
du -sh "$SCRIPT_DIR/core" "$SCRIPT_DIR/optional" 2>/dev/null || true
