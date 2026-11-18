// The Move tool (Edvard, 2026-11-18: "maybe we need a tool by just moving things around?"): find
// the mark under the pointer and shift it. Pure: marks and a page point in, a mark or a moved copy
// out. Pins are grabbed by their numbers and pasted images by their own layer, elsewhere.

import { type Crop, type Mark, type Shape, isCrop, isShape } from "../marks/types";
import type { Point, Rect } from "../shared/geometry";
import { moveShape, shapeBox } from "./state";

const SLACK = 8;

const inside = (r: Rect, p: Point, slack: number) =>
  p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;

/** The distance from p to the segment a–b. */
export function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hitsShape(s: Shape, p: Point): boolean {
  switch (s.kind) {
    case "pen":
      return s.points.some((q, i) => i > 0 && toSegment(p, s.points[i - 1] ?? q, q) <= SLACK);
    case "arrow":
      return toSegment(p, s.from, s.to) <= SLACK;
    case "box":
    case "ellipse":
    case "text":
      return inside(shapeBox(s), p, SLACK / 2);
  }
}

/** A free crop frame moves; a component's crop follows its element and does not. */
const movableCrop = (c: Crop) => c.el === null;

export type Movable = Shape | Crop;

/** The topmost mark the Move tool can grab at a page point. */
export function markAt(marks: readonly Mark[], p: Point): Movable | undefined {
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    if (!m) continue;
    if (isShape(m) && hitsShape(m, p)) return m;
    if (isCrop(m) && movableCrop(m) && inside(m.rect, p, SLACK / 2)) return m;
  }
  return undefined;
}

/** The mark as it started, shifted by (dx, dy). */
export function shifted<M extends Movable>(start: M, dx: number, dy: number): M {
  if (start.kind === "crop") return { ...start, rect: { ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy } };
  return moveShape(start, dx, dy) as M;
}
