// What Edvard puts on a page. Shapes are drawings; pins are numbered (picks and comments) and
// carry a note and the element they point at. Shapes are stored in page coordinates, so they stay
// on what they mark when the page scrolls.

import type { Point, Rect } from "../shared/geometry";

export const COLORS = { red: "#ff3366", blue: "#2f7bff", yellow: "#ffc400" } as const;
export type Color = keyof typeof COLORS;

export type Shape =
  | { kind: "pen"; color: Color; points: Point[] }
  | { kind: "arrow"; color: Color; from: Point; to: Point }
  | { kind: "box"; color: Color; rect: Rect }
  | { kind: "ellipse"; color: Color; rect: Rect }
  | { kind: "text"; color: Color; at: Point; text: string };

/** A pick marks a whole element; a comment marks a point (and remembers the element under it). */
export type Pin = {
  kind: "pick" | "comment";
  color: Color;
  el: Element;
  /** Page coordinates of a comment's badge; a pick's badge follows its element. */
  at: Point;
  note: string;
};

export type Mark = Shape | Pin;

export function isPin(m: Mark): m is Pin {
  return m.kind === "pick" || m.kind === "comment";
}
