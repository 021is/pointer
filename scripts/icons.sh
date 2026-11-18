#!/usr/bin/env bash
# The extension's icons from icons/icon.svg (Pointer's own mark: 021's ink tile, a white cursor,
# Pointer's violet "1" pin; Edvard chose it, 2026-11-18): rendered per size, every metadata chunk
# stripped (no image leaves us with metadata), then checked. Run after the SVG changes; the PNGs
# are committed.
set -euo pipefail
cd "$(dirname "$0")/.."
for size in 16 32 48 128; do
  rsvg-convert -w "$size" -h "$size" icons/icon.svg -o "icons/icon-$size.tmp.png"
  convert "icons/icon-$size.tmp.png" -strip "icons/icon-$size.png"
  rm "icons/icon-$size.tmp.png"
done
node scripts/png-chunks.mjs icons/icon-*.png
