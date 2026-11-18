// Pure geometry: Shift snapping, the crop around the marks, and the move from CSS pixels to the
// screenshot's pixels. No DOM here, so every rule is unit-tested.

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

const STEP = Math.PI / 4;

/** Rounds away float noise (cos(π/2) is 6e-17, not 0) and turns -0 into 0. */
function clean(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
}

/**
 * Shift on a line or an arrow: the end moves onto the nearest 0/45/90° ray from the start, at
 * the cursor's projection on that ray (so a near-horizontal drag keeps the cursor's x).
 */
export function snapLine(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { ...to };
  const angle = Math.round(Math.atan2(dy, dx) / STEP) * STEP;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const along = dx * cos + dy * sin;
  return { x: clean(from.x + along * cos), y: clean(from.y + along * sin) };
}

/** A box or ellipse dragged from a to b; Shift makes it square, growing toward the cursor. */
export function dragRect(a: Point, b: Point, square: boolean): Rect {
  let w = b.x - a.x;
  let h = b.y - a.y;
  if (square) {
    const side = Math.max(Math.abs(w), Math.abs(h));
    w = (w < 0 ? -1 : 1) * side;
    h = (h < 0 ? -1 : 1) * side;
  }
  return {
    x: Math.min(a.x, a.x + w),
    y: Math.min(a.y, a.y + h),
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

/** The smallest rect holding every point. */
export function boundsOf(points: readonly Point[]): Rect | null {
  const first = points[0];
  if (!first) return null;
  let x0 = first.x;
  let y0 = first.y;
  let x1 = first.x;
  let y1 = first.y;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function union(rects: readonly Rect[]): Rect | null {
  return boundsOf(rects.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }]));
}

export function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

/** The part of r inside bounds, or null when they don't overlap. */
export function intersect(r: Rect, bounds: Rect): Rect | null {
  const x0 = Math.max(r.x, bounds.x);
  const y0 = Math.max(r.y, bounds.y);
  const x1 = Math.min(r.x + r.w, bounds.x + bounds.w);
  const y1 = Math.min(r.y + r.h, bounds.y + bounds.h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The picture's crop, in viewport CSS pixels: every mark's box plus a margin of context, kept
 * inside the viewport. Null when nothing is on screen (the caller then takes the whole view).
 */
export function cropFor(boxes: readonly Rect[], viewport: Size, margin = 24): Rect | null {
  const all = union(boxes);
  if (!all) return null;
  return intersect(inflate(all, margin), { x: 0, y: 0, w: viewport.w, h: viewport.h });
}

/**
 * A viewport rect in the screenshot's own pixels. `ratio` is the screenshot's width over the
 * viewport's CSS width (devicePixelRatio times page zoom), measured, never assumed. The result is
 * whole pixels that cover the rect and stay inside the image.
 */
export function toImagePixels(r: Rect, ratio: number, image: Size): Rect {
  const x0 = Math.max(0, Math.floor(r.x * ratio));
  const y0 = Math.max(0, Math.floor(r.y * ratio));
  const x1 = Math.min(image.w, Math.ceil((r.x + r.w) * ratio));
  const y1 = Math.min(image.h, Math.ceil((r.y + r.h) * ratio));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/**
 * The size of the picture the agent gets: one image pixel per CSS pixel (a 2× Retina capture
 * costs 4× the tokens and reads no better), the long edge capped.
 */
export function outputSize(crop: Size, maxEdge = 1000): Size {
  const scale = Math.min(1, maxEdge / Math.max(crop.w, crop.h, 1));
  return { w: Math.max(1, Math.round(crop.w * scale)), h: Math.max(1, Math.round(crop.h * scale)) };
}

/** Claude's price of an image in tokens: about width × height / 750. */
export function imageTokens(size: Size): number {
  return Math.ceil((size.w * size.h) / 750);
}

/** True when p is within `radius` of c. */
export function near(p: Point, c: Point, radius: number): boolean {
  return Math.hypot(p.x - c.x, p.y - c.y) <= radius;
}
