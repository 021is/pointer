// A drag turned into a shape, Shift rules included. Pure: points in, shape out.

import type { Color, Shape } from "../marks/types";
import { type Point, dragRect, near, snapLine } from "../shared/geometry";

export type DrawTool = "pen" | "arrow" | "box" | "ellipse";

export function startShape(tool: DrawTool, color: Color, at: Point): Shape {
  switch (tool) {
    case "pen":
      return { kind: "pen", color, points: [at] };
    case "arrow":
      return { kind: "arrow", color, from: at, to: at };
    case "box":
    case "ellipse":
      return { kind: tool, color, rect: { x: at.x, y: at.y, w: 0, h: 0 } };
  }
}

/** The shape as the pointer moves to `to`. Shift: straight pen, 45° arrow, square box. */
export function extendShape(s: Shape, start: Point, to: Point, shift: boolean): Shape {
  switch (s.kind) {
    case "pen": {
      if (shift) return { ...s, points: [start, snapLine(start, to)] };
      const last = s.points.at(-1);
      return last && near(last, to, 2) ? s : { ...s, points: [...s.points, to] };
    }
    case "arrow":
      return { ...s, to: shift ? snapLine(s.from, to) : to };
    case "box":
    case "ellipse":
      return { ...s, rect: dragRect(start, to, shift) };
    case "text":
      return s;
  }
}

/** A click without a real drag leaves nothing behind. */
export function isMeaningful(s: Shape): boolean {
  switch (s.kind) {
    case "pen":
      return s.points.length >= 2;
    case "arrow":
      return !near(s.from, s.to, 6);
    case "box":
    case "ellipse":
      return s.rect.w >= 4 && s.rect.h >= 4;
    case "text":
      return s.text.trim().length > 0;
  }
}
