// The Gap tool's measure (Edvard, 2026-11-19: "when I want to show the space of two element I
// like to have a shape for it |----|"). A drag from one element to another snaps to their facing
// edges, across or down, and measures the space between in CSS pixels; a drag from a child to its
// container measures the inner space on that side. Pure: rectangles in, one line out.

import type { Point, Rect } from "../shared/geometry";
import type { GapLine } from "../marks/types";

const right = (r: Rect) => r.x + r.w;
const bottom = (r: Rect) => r.y + r.h;
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && right(inner) <= right(outer) && bottom(inner) <= bottom(outer);

/** The middle of where two ranges overlap, or of the drag when they don't. */
function across(a0: number, a1: number, b0: number, b1: number, fallback: number): number {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return lo <= hi ? (lo + hi) / 2 : fallback;
}

/** CSS pixels, whole: getBoundingClientRect is in CSS pixels at any zoom, only fractional. */
const px = (v: number) => Math.round(v);

export type GapAnswer = { kind: "line"; line: GapLine } | { kind: "none"; why: string };

/**
 * The gap the drag means, in the coordinates the rectangles are in. `a` is the element under the
 * drag's start, `b` under its end.
 */
export function measureGap(a: Rect, b: Rect, start: Point, end: Point): GapAnswer {
  const across_ = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const outer = contains(a, b) ? a : contains(b, a) ? b : null;
  if (outer) {
    const inner = outer === a ? b : a;
    if (inner === outer || (a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)) {
      return { kind: "none", why: "drag from one element to another (or from an element to its container)" };
    }
    const toward = outer === a ? start : end;
    if (across_) {
      const y = inner.y + inner.h / 2;
      const leftSide = toward.x < inner.x + inner.w / 2;
      const [x0, x1] = leftSide ? [outer.x, inner.x] : [right(inner), right(outer)];
      return { kind: "line", line: { axis: "x", from: { x: x0, y }, to: { x: x1, y }, px: px(x1 - x0) } };
    }
    const x = inner.x + inner.w / 2;
    const topSide = toward.y < inner.y + inner.h / 2;
    const [y0, y1] = topSide ? [outer.y, inner.y] : [bottom(inner), bottom(outer)];
    return { kind: "line", line: { axis: "y", from: { x, y: y0 }, to: { x, y: y1 }, px: px(y1 - y0) } };
  }
  const apartX = right(a) <= b.x || right(b) <= a.x;
  const apartY = bottom(a) <= b.y || bottom(b) <= a.y;
  if (apartX && (across_ || !apartY)) {
    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
    const y = across(l.y, bottom(l), r.y, bottom(r), (start.y + end.y) / 2);
    return { kind: "line", line: { axis: "x", from: { x: right(l), y }, to: { x: r.x, y }, px: px(r.x - right(l)) } };
  }
  if (apartY) {
    const [t, u] = a.y <= b.y ? [a, b] : [b, a];
    const x = across(t.x, right(t), u.x, right(u), (start.x + end.x) / 2);
    return { kind: "line", line: { axis: "y", from: { x, y: bottom(t) }, to: { x, y: u.y }, px: px(u.y - bottom(t)) } };
  }
  return { kind: "none", why: "these two overlap: there is no space between them" };
}

/** A line moved by (dx, dy): viewport ↔ page coordinates. */
export function shiftLine(l: GapLine, dx: number, dy: number): GapLine {
  return { ...l, from: { x: l.from.x + dx, y: l.from.y + dy }, to: { x: l.to.x + dx, y: l.to.y + dy } };
}

export const midpoint = (l: GapLine): Point => ({ x: (l.from.x + l.to.x) / 2, y: (l.from.y + l.to.y) / 2 });
