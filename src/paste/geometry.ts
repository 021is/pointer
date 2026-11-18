// Pasted images, the pure part: where a pasted image lands, how big, how a drag moves or
// resizes it, and the see-through steps.

import type { Point, Rect, Size } from "../shared/geometry";

/** The corner handle: a drag that starts this close to the bottom-right corner resizes. */
export const HANDLE = 14;
export const MIN_SIDE = 24;

/**
 * A pasted image's first box, in page coordinates: its natural size in CSS pixels (a Retina
 * screenshot is 2 image pixels per CSS pixel), at most 60% of the viewport, centred on `at`.
 */
export function landing(natural: Size, ratio: number, at: Point, viewport: Size): Rect {
  let w = natural.w / Math.max(1, ratio);
  let h = natural.h / Math.max(1, ratio);
  const fit = Math.min(1, (viewport.w * 0.6) / w, (viewport.h * 0.6) / h);
  w = Math.round(w * fit);
  h = Math.round(h * fit);
  return { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h };
}

export type Grip = "move" | "resize";

/** What a press on an image grabs: its corner handle, or the image itself. */
export function gripAt(rect: Rect, p: Point): Grip | null {
  const inside = p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  if (!inside) return null;
  const corner = rect.x + rect.w - p.x <= HANDLE && rect.y + rect.h - p.y <= HANDLE;
  return corner ? "resize" : "move";
}

/** The box after dragging by (dx, dy). Resizing keeps the ratio unless `free` (Shift). */
export function dragged(start: Rect, grip: Grip, dx: number, dy: number, free: boolean): Rect {
  if (grip === "move") return { ...start, x: start.x + dx, y: start.y + dy };
  const w = Math.max(MIN_SIDE, start.w + dx);
  const h = free ? Math.max(MIN_SIDE, start.h + dy) : Math.max(MIN_SIDE, Math.round((w * start.h) / start.w));
  return { ...start, w: Math.round(w), h };
}

const STEPS = [0.25, 0.5, 0.75, 1];

/** [ and ]: one step more or less see-through, between 25% and 100%. */
export function stepOpacity(opacity: number, direction: -1 | 1): number {
  const i = STEPS.findIndex((s) => s >= opacity - 0.01);
  const at = i < 0 ? STEPS.length - 1 : i;
  return STEPS[Math.min(STEPS.length - 1, Math.max(0, at + direction))] ?? 1;
}
