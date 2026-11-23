// The page Pointer marks right now: the tab's own, or its copy framed at a screen size (stage.ts).
// Every gesture, hit test and picture reads its window, scroll and viewport here, never the tab's
// globals: on Mobile the page is the frame's, and a point on the tab is mapped into it.
//
// Coordinates: "client" is the tab's viewport (a PointerEvent's clientX/Y, where Pointer's own UI
// lives); "view" is the surface's viewport (where its elements' getBoundingClientRect are); "page"
// is view + the surface's scroll (where marks are kept). On Full, client and view are the same.

import type { Point, Rect, Size } from "../shared/geometry";
import { type Box, clientToView, rectToClient, viewToClient } from "./sizes";

export type Surface = {
  /** The marked page's window: the tab's, or the frame's (same origin, so reachable). */
  win: Window;
  /** Where its viewport lies on the tab, measured now. */
  box: () => Box;
};

/** The framed page, or null for the tab's own (read lazily: `window` is only there in a page). */
let framed: Surface | null = null;
const TAB_BOX: Box = { x: 0, y: 0, scale: 1 };

/** The framed page from now on, or the tab's own again (null). */
export function setSurface(s: Surface | null): void {
  framed = s;
}

export const isFramedSurface = () => framed !== null;
export const surfaceWin = (): Window => framed?.win ?? window;
export const surfaceDoc = (): Document => surfaceWin().document;
export const surfaceBox = (): Box => framed?.box() ?? TAB_BOX;
export const scroll = (): Point => ({ x: surfaceWin().scrollX, y: surfaceWin().scrollY });
export const viewport = (): Size => ({ w: surfaceWin().innerWidth, h: surfaceWin().innerHeight });

/** A pointer event's spot in the surface's viewport. */
export const viewAt = (e: { clientX: number; clientY: number }): Point => clientToView(surfaceBox(), { x: e.clientX, y: e.clientY });

/** A pointer event's spot on the surface's page. */
export function pageAt(e: { clientX: number; clientY: number }): Point {
  const v = viewAt(e);
  const s = scroll();
  return { x: v.x + s.x, y: v.y + s.y };
}

/** A page point in the surface's viewport. */
export function toView(page: Point): Point {
  const s = scroll();
  return { x: page.x - s.x, y: page.y - s.y };
}

/** A page point on the tab: where Pointer's own boxes (a note) open beside it. */
export const pageToClient = (page: Point): Point => viewToClient(surfaceBox(), toView(page));

/** A surface viewport rect on the tab: where the screenshot has it. */
export const viewRectToClient = (r: Rect): Rect => rectToClient(surfaceBox(), r);
