// Where each part of the picture goes: the regions (the crop frames, or the one auto crop)
// stacked top to bottom, a letter tab above each frame, the text strip at the bottom. Pure.

import { type Rect, type Size, outputSize } from "../shared/geometry";
import { STRIP } from "./strip";

/** A part of the screen to show: a crop frame (label "A") or the auto crop (no label). */
export type Region = { label: string | null; rect: Rect };

export type Placed = { region: Region; size: Size; top: number };

export const TAB = 22;
export const GAP = 10;

export type Stack = { width: number; placed: Placed[]; bottom: number };

export function stackRegions(regions: readonly Region[], withStrip: boolean): Stack {
  const placed: Placed[] = [];
  let y = 0;
  for (const [i, region] of regions.entries()) {
    if (i > 0) y += GAP;
    if (region.label) y += TAB;
    const size = outputSize(region.rect);
    placed.push({ region, size, top: y });
    y += size.h;
  }
  const widest = Math.max(1, ...placed.map((p) => p.size.w));
  return { width: withStrip ? Math.max(widest, STRIP.minWidth) : widest, placed, bottom: y };
}
