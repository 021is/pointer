// One renderer for both the live overlay and the picture the agent gets: marks → SVG markup.
// Pure (strings in, string out), so the copied image shows exactly what was on screen.

import type { Point, Rect } from "../shared/geometry";
import { COLORS, type Color, type GapLine, type Shape } from "./types";

/** A pin as drawn: its number, its badge position and, for a pick, the element's outline. An idea
 *  reads "n?"; a gap draws its measure |← 24px →| with the badge beside the label. */
export type ScenePin = { n: number; color: Color; badge: Point; outline?: Rect } & (
  | { look: "pin" }
  | { look: "idea" }
  | { look: "gap"; line: GapLine }
);

/** A crop frame as drawn on the page: its letter and its box ("" while it is being dragged). */
export type Frame = { label: string; rect: Rect };

/** Everything to draw, in viewport coordinates. */
export type Scene = {
  shapes: readonly Shape[];
  pins: readonly ScenePin[];
  /** Crop frames, shown on the page only (the picture is cut to them instead). */
  frames?: readonly Frame[];
  /** Darkens everything except the holes (the hovered or picked elements). */
  dim?: { holes: readonly Rect[]; alpha: number };
  /** The pick tool's hover: an outline and a label such as "ProfileCard · div.card 320×180". */
  hover?: { rect: Rect; label: string };
};

const STROKE = 3;
const BADGE_R = 11;

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const n = (v: number) => String(Math.round(v * 10) / 10);

/** The two back corners of an arrow's head, `size` long, at 28° off the shaft. */
export function arrowHead(from: Point, to: Point, size = 14): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = (28 * Math.PI) / 180;
  const corner = (a: number): Point => ({
    x: to.x - size * Math.cos(a),
    y: to.y - size * Math.sin(a),
  });
  return [corner(angle - spread), corner(angle + spread)];
}

function shapeSvg(s: Shape): string {
  const c = COLORS[s.color];
  const line = `fill="none" stroke="${c}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (s.kind) {
    case "pen":
      return `<polyline ${line} points="${s.points.map((p) => `${n(p.x)},${n(p.y)}`).join(" ")}"/>`;
    case "arrow": {
      const [a, b] = arrowHead(s.from, s.to);
      return (
        `<line ${line} x1="${n(s.from.x)}" y1="${n(s.from.y)}" x2="${n(s.to.x)}" y2="${n(s.to.y)}"/>` +
        `<polygon fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round" points="${n(s.to.x)},${n(s.to.y)} ${n(a.x)},${n(a.y)} ${n(b.x)},${n(b.y)}"/>`
      );
    }
    case "box":
      return (
        `<rect ${line} x="${n(s.rect.x)}" y="${n(s.rect.y)}" width="${n(s.rect.w)}" height="${n(s.rect.h)}" rx="4"/>` +
        noteSvg(s.note, s.rect, c)
      );
    case "ellipse": {
      const { x, y, w, h } = s.rect;
      return `<ellipse ${line} cx="${n(x + w / 2)}" cy="${n(y + h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"/>${noteSvg(s.note, s.rect, c)}`;
    }
    case "text":
      return words(s.text, s.at, c, 18, 22);
  }
}

/** Words on the page, white-haloed so they read on any background. */
function words(text: string, at: Point, c: string, size: number, step: number): string {
  return text
    .split("\n")
    .map(
      (t, i) =>
        `<text x="${n(at.x)}" y="${n(at.y + i * step)}" fill="${c}" stroke="#fff" stroke-width="4" paint-order="stroke" font-family="system-ui,sans-serif" font-size="${size}" font-weight="700" dominant-baseline="hanging">${escapeXml(t)}</text>`,
    )
    .join("");
}

/** A box's or an ellipse's note, written just under it. */
const noteSvg = (note: string | undefined, r: Rect, c: string) =>
  note?.trim() ? words(note.trim(), { x: r.x, y: r.y + r.h + 8 }, c, 15, 19) : "";

function pinSvg(p: ScenePin): string {
  const c = COLORS[p.color];
  const ink = p.color === "yellow" ? "#1a1a1a" : "#fff";
  const outline = p.outline
    ? `<rect x="${n(p.outline.x)}" y="${n(p.outline.y)}" width="${n(p.outline.w)}" height="${n(p.outline.h)}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="6 4"/>`
    : "";
  const label = p.look === "idea" ? `${p.n}?` : String(p.n);
  // An idea's badge is a pill wide enough for its "?", the question it asks.
  const half = p.look === "idea" ? BADGE_R + 4 : BADGE_R;
  const badge =
    `<rect x="${n(p.badge.x - half)}" y="${n(p.badge.y - BADGE_R)}" width="${n(half * 2)}" height="${BADGE_R * 2}" rx="${BADGE_R}" fill="${c}" stroke="#fff" stroke-width="2"/>` +
    `<text x="${n(p.badge.x)}" y="${n(p.badge.y)}" fill="${ink}" font-family="system-ui,sans-serif" font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  return outline + (p.look === "gap" ? gapSvg(p.line, c) : "") + badge;
}

/** |← 24px →|: the measured line, its end ticks, small heads and the pixels on a white halo. */
function gapSvg(l: GapLine, c: string): string {
  const tick = 7;
  const [dx, dy] = l.axis === "x" ? [0, tick] : [tick, 0];
  const end = (p: Point) => `<line x1="${n(p.x - dx)}" y1="${n(p.y - dy)}" x2="${n(p.x + dx)}" y2="${n(p.y + dy)}"/>`;
  const head = (from: Point, to: Point) => {
    const [a, b] = arrowHead(from, to, 7);
    return `<polygon fill="${c}" stroke="none" points="${n(to.x)},${n(to.y)} ${n(a.x)},${n(a.y)} ${n(b.x)},${n(b.y)}"/>`;
  };
  const mid = { x: (l.from.x + l.to.x) / 2, y: (l.from.y + l.to.y) / 2 };
  const tx = l.axis === "x" ? mid.x : mid.x + 10;
  const ty = l.axis === "x" ? mid.y - 12 : mid.y;
  const anchor = l.axis === "x" ? "middle" : "start";
  return (
    `<g stroke="${c}" stroke-width="2" stroke-linecap="round">` +
    `<line x1="${n(l.from.x)}" y1="${n(l.from.y)}" x2="${n(l.to.x)}" y2="${n(l.to.y)}"/>${end(l.from)}${end(l.to)}</g>` +
    head(mid, l.from) +
    head(mid, l.to) +
    `<text x="${n(tx)}" y="${n(ty)}" fill="${c}" stroke="#fff" stroke-width="4" paint-order="stroke" font-family="system-ui,sans-serif" font-size="13" font-weight="700" text-anchor="${anchor}" dominant-baseline="central">${l.px}px</text>`
  );
}

function dimSvg(view: Rect, holes: readonly Rect[], alpha: number): string {
  const box = (r: Rect) => `M${n(r.x)} ${n(r.y)}h${n(r.w)}v${n(r.h)}h${n(-r.w)}Z`;
  return `<path fill="rgb(10,10,20)" fill-opacity="${alpha}" fill-rule="evenodd" d="${box(view)}${holes.map(box).join("")}"/>`;
}

function hoverSvg(view: Rect, rect: Rect, label: string): string {
  const text = escapeXml(label);
  const width = Math.min(view.w, 12 + label.length * 7.2);
  const above = rect.y - 24 >= view.y;
  const ly = above ? rect.y - 24 : rect.y + rect.h + 2;
  const lx = Math.max(view.x, Math.min(rect.x, view.x + view.w - width));
  return (
    `<rect x="${n(rect.x)}" y="${n(rect.y)}" width="${n(rect.w)}" height="${n(rect.h)}" fill="none" stroke="#7c5cff" stroke-width="2"/>` +
    `<rect x="${n(lx)}" y="${n(ly)}" width="${n(width)}" height="22" rx="4" fill="#7c5cff"/>` +
    `<text x="${n(lx + 6)}" y="${n(ly + 11)}" fill="#fff" font-family="ui-monospace,monospace" font-size="12" dominant-baseline="central">${text}</text>`
  );
}

/** The crop frames' green, on the page and in the picture. */
const FRAME = "#2fd67b";
/** The height of a frame's letter tab, drawn above the frame. */
export const FRAME_TAB = 20;

function frameSvg(f: Frame): string {
  const { x, y, w, h } = f.rect;
  const tab = f.label
    ? `<rect x="${n(x)}" y="${n(y - FRAME_TAB)}" width="${n(14 + f.label.length * 8)}" height="${FRAME_TAB}" rx="4" fill="${FRAME}"/>` +
      `<text x="${n(x + 7)}" y="${n(y - FRAME_TAB / 2)}" fill="#08130d" font-family="system-ui,sans-serif" font-size="12" font-weight="700" dominant-baseline="central">${escapeXml(f.label)}</text>`
    : "";
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${FRAME}" stroke-width="2" stroke-dasharray="8 4"/>${tab}`;
}

/** The scene as one SVG document covering `view` (the viewport, or the picture's crop). */
export function renderSvg(scene: Scene, view: Rect): string {
  const parts = [
    scene.dim ? dimSvg(view, scene.dim.holes, scene.dim.alpha) : "",
    ...(scene.frames ?? []).map(frameSvg),
    ...scene.shapes.map(shapeSvg),
    scene.hover ? hoverSvg(view, scene.hover.rect, scene.hover.label) : "",
    ...scene.pins.map(pinSvg),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(view.w)}" height="${n(view.h)}" viewBox="${n(view.x)} ${n(view.y)} ${n(view.w)} ${n(view.h)}">${parts.join("")}</svg>`;
}
