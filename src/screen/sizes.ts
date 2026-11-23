// The screens Pointer can show the page at (Edvard, 2026-11-23: "a switch between full width,
// tablet and mobile, plus a custom one"), what each is called, the custom size's limits, and where
// the framed page sits in the tab. Pure: no DOM, every rule unit-tested.

import type { Point, Rect, Size } from "../shared/geometry";

export type Screen = { kind: "full" } | { kind: "tablet" } | { kind: "mobile" } | { kind: "custom"; size: Size };
export type ScreenKind = Screen["kind"];
export type Framed = Exclude<Screen, { kind: "full" }>;

export const TABLET: Size = { w: 768, h: 1024 };
export const MOBILE: Size = { w: 390, h: 844 };
/** A custom side, in CSS pixels: narrower than the smallest phones makes no layout worth checking,
 *  wider than a 4K screen none worth showing. */
export const SIDE = { min: 240, max: 3840 } as const;

export const FULL: Screen = { kind: "full" };

const NAMES: Record<ScreenKind, string> = { full: "Full", tablet: "Tablet", mobile: "Mobile", custom: "Custom" };

export const nameOf = (s: Screen) => NAMES[s.kind];

/** The framed page's size; Full has none of its own (it is the tab's). */
export function sizeOf(s: Framed): Size {
  switch (s.kind) {
    case "tablet":
      return TABLET;
    case "mobile":
      return MOBILE;
    case "custom":
      return s.size;
  }
}

export const isFramed = (s: Screen): s is Framed => s.kind !== "full";

/** "390 × 844" */
export const sizeText = (size: Size) => `${size.w} × ${size.h}`;

/** "Mobile · 390 × 844": the label above the frame and in the bar's tip. */
export const screenLabel = (s: Screen) => (isFramed(s) ? `${nameOf(s)} · ${sizeText(sizeOf(s))}` : "Full: the page as it is");

/** Two screens are the same choice: the same kind, and for Custom the same size. */
export function sameScreen(a: Screen, b: Screen): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== "custom" || (b.kind === "custom" && a.size.w === b.size.w && a.size.h === b.size.h);
}

export type SizeCheck = { ok: true; size: Size } | { ok: false; why: string };

/** One side typed by the person: a whole number of CSS pixels within SIDE, or why not. */
function side(raw: string, name: "Width" | "Height"): number | string {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return `${name}: type a whole number of pixels, like ${name === "Width" ? 1280 : 720}.`;
  const n = Number(text);
  if (n < SIDE.min || n > SIDE.max) return `${name}: between ${SIDE.min} and ${SIDE.max} pixels.`;
  return n;
}

/** The custom size as typed, checked where it enters. */
export function checkCustom(w: string, h: string): SizeCheck {
  const width = side(w, "Width");
  if (typeof width === "string") return { ok: false, why: width };
  const height = side(h, "Height");
  if (typeof height === "string") return { ok: false, why: height };
  return { ok: true, size: { w: width, h: height } };
}

/** The saved custom size, read back from chrome.storage.local: a size within SIDE, or null. */
export function readSaved(value: unknown): Size | null {
  const v = value as Partial<Size> | null;
  if (typeof v !== "object" || v === null) return null;
  const ok = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= SIDE.min && (n as number) <= SIDE.max;
  return ok(v.w) && ok(v.h) ? { w: v.w, h: v.h } : null;
}

/** Room kept around the frame in the tab: its label above, Pointer's bar below. */
export const MARGIN = { top: 44, bottom: 96, side: 24 } as const;

/** Where the framed page goes in a tab of `room`: centred between the label and the bar, shrunk
 *  (never grown) to fit. `scale` is what one CSS pixel of the framed page is on the tab. */
export function placeFrame(size: Size, room: Size): { x: number; y: number; scale: number } {
  const w = Math.max(1, room.w - 2 * MARGIN.side);
  const h = Math.max(1, room.h - MARGIN.top - MARGIN.bottom);
  const scale = Math.min(1, w / size.w, h / size.h);
  const x = Math.round((room.w - size.w * scale) / 2);
  const y = Math.round(MARGIN.top + (h - size.h * scale) / 2);
  return { x, y, scale };
}

/** Where a surface (the tab's own page, or the framed one) lies on the tab: its viewport's
 *  top-left in the tab's viewport, and its zoom. The tab's own page is { 0, 0, 1 }. */
export type Box = { x: number; y: number; scale: number };

/** A point on the tab → the same point in the surface's viewport. */
export const clientToView = (b: Box, c: Point): Point => ({ x: (c.x - b.x) / b.scale, y: (c.y - b.y) / b.scale });

/** A point in the surface's viewport → the same point on the tab. */
export const viewToClient = (b: Box, v: Point): Point => ({ x: b.x + v.x * b.scale, y: b.y + v.y * b.scale });

/** A rect in the surface's viewport → the same rect on the tab (where the screenshot has it). */
export const rectToClient = (b: Box, r: Rect): Rect => ({ x: b.x + r.x * b.scale, y: b.y + r.y * b.scale, w: r.w * b.scale, h: r.h * b.scale });
