// Where each part of the picture goes: the regions (the crop frames, each captured in view by
// shots.ts, or the one auto crop) stacked top to bottom, each frame's letter tab above it, the
// text strip at the bottom, all inside what Claude reads at full size. Pure.

import { FRAME_TAB } from "../marks/svg";
import { type Rect, type Size, outputSize } from "../shared/geometry";
import { STRIP, stripHeight } from "./strip";

/** A part of the screen to show: a crop frame (label "A") or the auto crop (no label). */
export type Region = { label: string | null; rect: Rect };

/** A region in the picture: its image size, its top, and the height of its tab band above. */
export type Placed = { region: Region; size: Size; top: number; tab: number };

export const GAP = 10;

/**
 * Claude scales down an image over ~1568 px on its long edge or ~1.15 megapixels, and the strip's
 * text would shrink with it. The picture stays inside both; the regions give way, never the text.
 */
export const BUDGET = { edge: 1568, area: 1_150_000 } as const;

export type Stack = { width: number; height: number; placed: Placed[]; bottom: number };

function place(regions: readonly Region[], scale: number): { placed: Placed[]; bottom: number; widest: number } {
  const placed: Placed[] = [];
  let y = 0;
  for (const [i, region] of regions.entries()) {
    if (i > 0) y += GAP;
    const full = outputSize(region.rect);
    const size = { w: Math.max(1, Math.round(full.w * scale)), h: Math.max(1, Math.round(full.h * scale)) };
    // The tab is drawn by the same SVG as the frame, so it scales with the region.
    const tab = region.label ? Math.round((FRAME_TAB * size.w) / Math.max(1, region.rect.w)) : 0;
    y += tab;
    placed.push({ region, size, top: y, tab });
    y += size.h;
  }
  return { placed, bottom: y, widest: Math.max(1, ...placed.map((p) => p.size.w)) };
}

/**
 * The layout, shrinking the regions in 10% steps until the whole picture fits the budget (or
 * they reach a fifth of their size). `linesFor(width)` is how many strip lines the text wraps
 * to at a width; null means no strip.
 */
export function stackRegions(regions: readonly Region[], linesFor: ((width: number) => number) | null): Stack {
  for (let scale = 1; ; scale *= 0.9) {
    const { placed, bottom, widest } = place(regions, scale);
    const width = linesFor ? Math.max(widest, STRIP.minWidth) : widest;
    const stripLines = linesFor ? linesFor(width) : 0;
    const height = bottom + stripHeight(stripLines);
    const fits = width <= BUDGET.edge && height <= BUDGET.edge && width * height <= BUDGET.area;
    if (fits || scale < 0.2) return { width, height, placed, bottom };
  }
}
