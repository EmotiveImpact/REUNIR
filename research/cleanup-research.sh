#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-all}" in
  core)
    rm -rf "$SCRIPT_DIR/core"
    mkdir -p "$SCRIPT_DIR/core"
    echo "Core research clones removed."
    ;;
  optional)
    rm -rf "$SCRIPT_DIR/optional"
    mkdir -p "$SCRIPT_DIR/optional"
    echo "Optional research clones removed."
    ;;
  all)
    rm -rf "$SCRIPT_DIR/core" "$SCRIPT_DIR/optional"
    mkdir -p "$SCRIPT_DIR/core" "$SCRIPT_DIR/optional"
    echo "All research clones removed. Notes, manifest and scripts preserved."
    ;;
  *)
    echo "Usage: ./cleanup-research.sh [core|optional|all]" >&2
    exit 2
    ;;
esac
