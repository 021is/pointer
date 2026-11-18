// Pointer's state and the pure steps from it to a Scene (what svg.ts draws).

import type { DrawingSummary } from "../bundle/types";
import type { Scene, ScenePin } from "../marks/svg";
import { type Color, type Mark, type Pin, type Shape, isPin } from "../marks/types";
import type { Point, Rect } from "../shared/geometry";
import { boundsOf, dragRect, inflate } from "../shared/geometry";

export type Tool = "page" | "pick" | "comment" | "pen" | "arrow" | "box" | "ellipse" | "text";

export type State = {
  tool: Tool;
  color: Color;
  marks: Mark[];
  /** The shape being drawn right now, in page coordinates. */
  draft: Shape | null;
  hover: { el: Element; label: string } | null;
  /** Copy with a picture even when only picks and comments are on the page. */
  forceImage: boolean;
};

export function initialState(): State {
  return { tool: "pick", color: "red", marks: [], draft: null, hover: null, forceImage: false };
}

export const pinsOf = (marks: readonly Mark[]): Pin[] => marks.filter(isPin);
export const shapesOf = (marks: readonly Mark[]): Shape[] =>
  marks.filter((m): m is Shape => !isPin(m));

/** A shape moved by (dx, dy): page ↔ viewport coordinates. */
export function moveShape(s: Shape, dx: number, dy: number): Shape {
  const p = (q: Point): Point => ({ x: q.x + dx, y: q.y + dy });
  switch (s.kind) {
    case "pen":
      return { ...s, points: s.points.map(p) };
    case "arrow":
      return { ...s, from: p(s.from), to: p(s.to) };
    case "box":
    case "ellipse":
      return { ...s, rect: { ...s.rect, x: s.rect.x + dx, y: s.rect.y + dy } };
    case "text":
      return { ...s, at: p(s.at) };
  }
}

/** The box a shape covers, for the picture's crop. Text is measured roughly (no DOM here). */
export function shapeBox(s: Shape): Rect {
  switch (s.kind) {
    case "pen":
      return boundsOf(s.points) ?? { x: 0, y: 0, w: 0, h: 0 };
    case "arrow":
      return inflate(dragRect(s.from, s.to, false), 10);
    case "box":
    case "ellipse":
      return s.rect;
    case "text": {
      const lines = s.text.split("\n");
      const longest = Math.max(...lines.map((l) => l.length));
      return { x: s.at.x, y: s.at.y, w: longest * 11, h: lines.length * 22 };
    }
  }
}

export type Layout = {
  /** The page's scroll, to turn page coordinates into viewport ones. */
  scroll: Point;
  /** An element's box in the viewport, right now. */
  rectOf: (el: Element) => Rect;
};

/** Pins as drawn: a pick's badge sits on its element's top-left corner and follows it. */
export function scenePins(marks: readonly Mark[], layout: Layout): ScenePin[] {
  return pinsOf(marks).map((pin, i) => {
    if (pin.kind === "pick") {
      const outline = layout.rectOf(pin.el);
      return { n: i + 1, color: pin.color, badge: { x: outline.x, y: outline.y }, outline };
    }
    return {
      n: i + 1,
      color: pin.color,
      badge: { x: pin.at.x - layout.scroll.x, y: pin.at.y - layout.scroll.y },
    };
  });
}

/** What the overlay shows: marks, the draft, and in pick mode the hover with the rest dimmed. */
export function liveScene(state: State, layout: Layout): Scene {
  const toView = (s: Shape) => moveShape(s, -layout.scroll.x, -layout.scroll.y);
  const shapes = shapesOf(state.marks).map(toView);
  if (state.draft) shapes.push(toView(state.draft));
  const pins = scenePins(state.marks, layout);
  if (state.tool !== "pick" || !state.hover) return { shapes, pins };
  const rect = layout.rectOf(state.hover.el);
  return { shapes, pins, dim: { holes: [rect], alpha: 0.45 }, hover: { rect, label: state.hover.label } };
}

/** What the picture shows: the marks, with a light dim around picked elements. */
export function pictureScene(state: State, layout: Layout): Scene {
  const shapes = shapesOf(state.marks).map((s) => moveShape(s, -layout.scroll.x, -layout.scroll.y));
  const pins = scenePins(state.marks, layout);
  const holes = pins.flatMap((p) => (p.outline ? [p.outline] : []));
  return holes.length ? { shapes, pins, dim: { holes, alpha: 0.3 } } : { shapes, pins };
}

/** Every box the picture must hold, in viewport coordinates. */
export function pictureBoxes(scene: Scene): Rect[] {
  const badges = scene.pins.map((p) => ({ x: p.badge.x - 14, y: p.badge.y - 14, w: 28, h: 28 }));
  const outlines = scene.pins.flatMap((p) => (p.outline ? [p.outline] : []));
  return [...scene.shapes.map(shapeBox), ...outlines, ...badges];
}

export function summarize(shapes: readonly Shape[]): DrawingSummary {
  const count = (k: Shape["kind"]) => shapes.filter((s) => s.kind === k).length;
  return {
    arrows: count("arrow"),
    boxes: count("box"),
    ellipses: count("ellipse"),
    pens: count("pen"),
    texts: shapes.flatMap((s) => (s.kind === "text" ? [s.text] : [])),
  };
}

/** The picture is sent when something is drawn, when asked for, or when nothing is marked. */
export function wantsImage(state: State): boolean {
  return state.forceImage || shapesOf(state.marks).length > 0 || pinsOf(state.marks).length === 0;
}
