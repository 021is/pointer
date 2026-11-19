// What Edvard puts on a page. Shapes are drawings; pins are numbered (picks and comments) and
// carry a note and the element they point at. Shapes are stored in page coordinates, so they stay
// on what they mark when the page scrolls.

import type { Point, Rect } from "../shared/geometry";

export const COLORS = { red: "#ff3366", blue: "#2f7bff", yellow: "#ffc400" } as const;
export type Color = keyof typeof COLORS;

export type Shape =
  | { kind: "pen"; color: Color; points: Point[] }
  | { kind: "arrow"; color: Color; from: Point; to: Point }
  /** A box or an ellipse may carry a note typed on it (a double-click), written under it, moving
   *  with it, and numbered in the text: "[5] box: make this one card". */
  | { kind: "box"; color: Color; rect: Rect; note?: string }
  | { kind: "ellipse"; color: Color; rect: Rect; note?: string }
  | { kind: "text"; color: Color; at: Point; text: string };

/**
 * A pick marks a whole element; a comment marks a point (and remembers the element under it); an
 * idea is a comment that asks the agent for ideas instead of a change (Edvard, 2026-11-19).
 */
export type PointKind = "pick" | "comment" | "idea";

/** The gap between two elements' facing edges (or a child and its container's), page coordinates
 *  and CSS pixels (Edvard, 2026-11-19: "the gap must be smaller or bigger"). */
export type GapLine = { axis: "x" | "y"; from: Point; to: Point; px: number };

type PinBase = {
  color: Color;
  el: Element;
  /** Page coordinates of the badge; a pick's badge follows its element instead. */
  at: Point;
  note: string;
};

/** Every numbered mark: [n] in the picture and in the text. */
export type Pin = (PinBase & { kind: PointKind }) | (PinBase & { kind: "gap"; other: Element; line: GapLine });

/**
 * A frame for the picture: a component (its box, followed live) or a dragged rectangle (page
 * coordinates). With frames, the picture is exactly the frames, stacked, labelled A, B, C.
 */
export type Crop = { kind: "crop"; el: Element | null; rect: Rect };

/**
 * An image Edvard pasted onto the page (a reference, a mockup): page coordinates, so it scrolls
 * with the page; `opacity` lets a mockup lie see-through over the real thing. Kept through a reload
 * like every mark (keep/), within the session store's room.
 */
export type Pasted = { kind: "image"; img: HTMLImageElement; rect: Rect; opacity: number };

export type Mark = Shape | Pin | Crop | Pasted;

export function isPin(m: Mark): m is Pin {
  return m.kind === "pick" || m.kind === "comment" || m.kind === "idea" || m.kind === "gap";
}

export function isCrop(m: Mark): m is Crop {
  return m.kind === "crop";
}

export function isPasted(m: Mark): m is Pasted {
  return m.kind === "image";
}

export function isShape(m: Mark): m is Shape {
  return !isPin(m) && !isCrop(m) && !isPasted(m);
}

/** A, B, … Z, then AA, AB: never confused with the pins' numbers. */
export function cropLabel(i: number): string {
  const letter = String.fromCharCode(65 + (i % 26));
  return i < 26 ? letter : cropLabel(Math.floor(i / 26) - 1) + letter;
}
