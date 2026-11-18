// Pointer's state and the pure steps from it to a Scene (what svg.ts draws).

import type { DrawingSummary } from "../bundle/types";
import type { Frame, Scene, ScenePin } from "../marks/svg";
import {
  type Color,
  type Crop,
  type Mark,
  type Pasted,
  type Pin,
  type Shape,
  cropLabel,
  isCrop,
  isPasted,
  isPin,
  isShape,
} from "../marks/types";
import type { Point, Rect } from "../shared/geometry";
import { boundsOf, dragRect, inflate } from "../shared/geometry";

export type Tool = "page" | "pick" | "comment" | "crop" | "pen" | "arrow" | "box" | "ellipse" | "text";

export type State = {
  tool: Tool;
  color: Color;
  marks: Mark[];
  /** The shape being drawn right now, in page coordinates. */
  draft: Shape | null;
  /** The crop frame being dragged right now, in page coordinates. */
  framing: Rect | null;
  hover: { el: Element; label: string } | null;
  /**
   * What Copy gives, switched on the bar (Edvard, 2026-11-18): the picture with the text strip,
   * or the compact text only, about 3× cheaper when his words say enough.
   */
  output: Output;
};

export type Output = "picture" | "text";

export function initialState(): State {
  return { tool: "pick", color: "red", marks: [], draft: null, framing: null, hover: null, output: "picture" };
}

export const pinsOf = (marks: readonly Mark[]): Pin[] => marks.filter(isPin);
export const shapesOf = (marks: readonly Mark[]): Shape[] => marks.filter(isShape);
export const cropsOf = (marks: readonly Mark[]): Crop[] => marks.filter(isCrop);
export const pastedOf = (marks: readonly Mark[]): Pasted[] => marks.filter(isPasted);

/** Picking and cropping both hover elements, walk them with the arrows and take them with Enter. */
export const targetsElements = (tool: Tool) => tool === "pick" || tool === "crop";

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

/** Crop frames in the viewport: a component's box (with 4px of air), or the dragged rectangle. */
export function sceneFrames(marks: readonly Mark[], layout: Layout): Frame[] {
  return cropsOf(marks).map((c, i) => ({
    label: cropLabel(i),
    rect: c.el?.isConnected
      ? inflate(layout.rectOf(c.el), 4)
      : { ...c.rect, x: c.rect.x - layout.scroll.x, y: c.rect.y - layout.scroll.y },
  }));
}

/**
 * What the overlay shows: marks, the draft, the frames. Picking or cropping dims all but the
 * hovered element; otherwise frames dim what lies outside them.
 */
export function liveScene(state: State, layout: Layout): Scene {
  const toView = (s: Shape) => moveShape(s, -layout.scroll.x, -layout.scroll.y);
  const shapes = shapesOf(state.marks).map(toView);
  if (state.draft) shapes.push(toView(state.draft));
  const pins = scenePins(state.marks, layout);
  const frames = sceneFrames(state.marks, layout);
  if (state.framing) {
    const f = state.framing;
    frames.push({ label: "", rect: { ...f, x: f.x - layout.scroll.x, y: f.y - layout.scroll.y } });
  }
  if (targetsElements(state.tool) && state.hover) {
    const rect = layout.rectOf(state.hover.el);
    return { shapes, pins, frames, dim: { holes: [rect], alpha: 0.45 }, hover: { rect, label: state.hover.label } };
  }
  return frames.length ? { shapes, pins, frames, dim: { holes: frames.map((f) => f.rect), alpha: 0.35 } } : { shapes, pins };
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

export function summarize(marks: readonly Mark[]): DrawingSummary {
  const shapes = shapesOf(marks);
  const count = (k: Shape["kind"]) => shapes.filter((s) => s.kind === k).length;
  return {
    arrows: count("arrow"),
    boxes: count("box"),
    ellipses: count("ellipse"),
    pens: count("pen"),
    texts: shapes.flatMap((s) => (s.kind === "text" ? [s.text] : [])),
    pasted: pastedOf(marks).length,
  };
}

/** Pasted images as they lie on screen now (viewport coordinates). */
export function laidOf(marks: readonly Mark[], layout: Layout): { img: HTMLImageElement; rect: Rect; opacity: number }[] {
  return pastedOf(marks).map((p) => ({
    img: p.img,
    rect: { ...p.rect, x: p.rect.x - layout.scroll.x, y: p.rect.y - layout.scroll.y },
    opacity: p.opacity,
  }));
}

/** The bar's switch decides: a picture, or text only. */
export function wantsImage(state: State): boolean {
  return state.output === "picture";
}

/** The switch's other side. */
export const otherOutput = (o: Output): Output => (o === "picture" ? "text" : "picture");
