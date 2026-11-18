#!/usr/bin/env bash
# The extension's icons: icons/icon.svg (Pointer's mark: 021's ink tile, a white cursor, Pointer's
# violet "1" pin; Edvard chose it, 2026-11-18) for 32/48/128, and icons/icon-16.svg, drawn for 16 px
# (a "1" is unreadable there, so the pin is a plain dot). Every metadata chunk is stripped (no image
# leaves us with metadata), then checked. Run after an SVG changes; the PNGs are committed.
set -euo pipefail
cd "$(dirname "$0")/.."
render() { # <svg> <size>
  rsvg-convert -w "$2" -h "$2" "$1" -o "icons/icon-$2.tmp.png"
  convert "icons/icon-$2.tmp.png" -strip "icons/icon-$2.png"
  rm "icons/icon-$2.tmp.png"
}
render icons/icon-16.svg 16
for size in 32 48 128; do render icons/icon.svg "$size"; done
node scripts/png-chunks.mjs icons/icon-*.png
