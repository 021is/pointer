// One renderer for both the live overlay and the picture the agent gets: marks → SVG markup.
// Pure (strings in, string out), so the copied image shows exactly what was on screen.

import type { Point, Rect } from "../shared/geometry";
import { COLORS, type Color, type Shape } from "./types";

/** A pin as drawn: its number, its badge position and, for a pick, the element's outline. */
export type ScenePin = { n: number; color: Color; badge: Point; outline?: Rect };

/** Everything to draw, in viewport coordinates. */
export type Scene = {
  shapes: readonly Shape[];
  pins: readonly ScenePin[];
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
      return `<rect ${line} x="${n(s.rect.x)}" y="${n(s.rect.y)}" width="${n(s.rect.w)}" height="${n(s.rect.h)}" rx="4"/>`;
    case "ellipse": {
      const { x, y, w, h } = s.rect;
      return `<ellipse ${line} cx="${n(x + w / 2)}" cy="${n(y + h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"/>`;
    }
    case "text":
      return s.text
        .split("\n")
        .map(
          (t, i) =>
            `<text x="${n(s.at.x)}" y="${n(s.at.y + i * 22)}" fill="${c}" stroke="#fff" stroke-width="4" paint-order="stroke" font-family="system-ui,sans-serif" font-size="18" font-weight="700" dominant-baseline="hanging">${escapeXml(t)}</text>`,
        )
        .join("");
  }
}

function pinSvg(p: ScenePin): string {
  const c = COLORS[p.color];
  const ink = p.color === "yellow" ? "#1a1a1a" : "#fff";
  const outline = p.outline
    ? `<rect x="${n(p.outline.x)}" y="${n(p.outline.y)}" width="${n(p.outline.w)}" height="${n(p.outline.h)}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="6 4"/>`
    : "";
  return (
    outline +
    `<circle cx="${n(p.badge.x)}" cy="${n(p.badge.y)}" r="${BADGE_R}" fill="${c}" stroke="#fff" stroke-width="2"/>` +
    `<text x="${n(p.badge.x)}" y="${n(p.badge.y)}" fill="${ink}" font-family="system-ui,sans-serif" font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="central">${p.n}</text>`
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

/** The scene as one SVG document covering `view` (the viewport, or the picture's crop). */
export function renderSvg(scene: Scene, view: Rect): string {
  const parts = [
    scene.dim ? dimSvg(view, scene.dim.holes, scene.dim.alpha) : "",
    ...scene.shapes.map(shapeSvg),
    scene.hover ? hoverSvg(view, scene.hover.rect, scene.hover.label) : "",
    ...scene.pins.map(pinSvg),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(view.w)}" height="${n(view.h)}" viewBox="${n(view.x)} ${n(view.y)} ${n(view.w)} ${n(view.h)}">${parts.join("")}</svg>`;
}
