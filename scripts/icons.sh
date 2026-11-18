#!/usr/bin/env bash
# The extension's icons from the 021 brand mark (icons/icon.svg, copied from 021is/021-site
# brand/icon.svg): rendered per size, every metadata chunk stripped (no image leaves us with
# metadata), then checked. Run after the SVG changes; the PNGs are committed.
set -euo pipefail
cd "$(dirname "$0")/.."
for size in 16 32 48 128; do
  rsvg-convert -w "$size" -h "$size" icons/icon.svg -o "icons/icon-$size.tmp.png"
  convert "icons/icon-$size.tmp.png" -strip "icons/icon-$size.png"
  rm "icons/icon-$size.tmp.png"
done
node scripts/png-chunks.mjs icons/icon-*.png
