// Where each part of the picture goes: the regions (the crop frames on screen, or the one auto
// crop) stacked top to bottom, each frame's letter tab above it, the text strip at the bottom. Pure.

import { FRAME_TAB, type Frame } from "../marks/svg";
import { type Rect, type Size, intersect, outputSize } from "../shared/geometry";
import { STRIP } from "./strip";

/** A part of the screen to show: a crop frame (label "A") or the auto crop (no label). */
export type Region = { label: string | null; rect: Rect };

/** A region in the picture: its image size, its top, and the height of its tab band above. */
export type Placed = { region: Region; size: Size; top: number; tab: number };

export const GAP = 10;

export type Stack = { width: number; placed: Placed[]; bottom: number };

/**
 * The frames the picture can show (the part of each inside the viewport) and the labels of
 * those scrolled out of view, which the bundle marks "off screen". With frames and none on
 * screen, the reason to stop.
 */
export function shownFrames(frames: readonly Frame[], viewport: Rect): { shown: Region[]; off: string[] } | Error {
  const shown: Region[] = [];
  const off: string[] = [];
  for (const f of frames) {
    const rect = intersect(f.rect, viewport);
    if (rect) shown.push({ label: f.label, rect });
    else off.push(f.label);
  }
  if (frames.length && !shown.length) return new Error("every crop is scrolled out of view: scroll one back in");
  return { shown, off };
}

export function stackRegions(regions: readonly Region[], withStrip: boolean): Stack {
  const placed: Placed[] = [];
  let y = 0;
  for (const [i, region] of regions.entries()) {
    if (i > 0) y += GAP;
    const size = outputSize(region.rect);
    // The tab is drawn by the same SVG as the frame, so it scales with the region.
    const tab = region.label ? Math.round((FRAME_TAB * size.w) / Math.max(1, region.rect.w)) : 0;
    y += tab;
    placed.push({ region, size, top: y, tab });
    y += size.h;
  }
  const widest = Math.max(1, ...placed.map((p) => p.size.w));
  return { width: withStrip ? Math.max(widest, STRIP.minWidth) : widest, placed, bottom: y };
}
