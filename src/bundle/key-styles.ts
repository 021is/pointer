// The handful of computed styles that tell an agent what an element looks like now, in one line,
// defaults left out ("font 15px/21px Inter 600 · color #1a1a2e · padding 16px 24px").

import { cssColorToHex } from "./color";

/** The computed values read from getComputedStyle, by CSS property name. */
export type StyleValues = Readonly<Record<string, string>>;

export const KEY_PROPS = [
  "display",
  "font-size",
  "line-height",
  "font-family",
  "font-weight",
  "color",
  "background-color",
  "padding",
  "margin",
  "gap",
  "border-radius",
  "border",
] as const;

const hex2 = (v: number) => Math.round(v).toString(16).padStart(2, "0");

/** rgb()/rgba()/lab()/oklch() → #rrggbb or #rrggbbaa; anything else (a keyword) as it is. */
export function toHex(color: string): string {
  const m = color.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!m) return cssColorToHex(color) ?? color;
  const [, r, g, b, a] = m;
  const rgb = `#${hex2(Number(r))}${hex2(Number(g))}${hex2(Number(b))}`;
  if (a === undefined) return rgb;
  const alpha = a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a);
  return alpha >= 1 ? rgb : `${rgb}${hex2(alpha * 255)}`;
}

const isTransparent = (c: string) =>
  c === "transparent" || /^rgba\(.*[,/]\s*0(\.0+)?%?\s*\)$/.test(c);

/** The first family, unquoted: '"Inter", system-ui' → Inter. */
export function firstFamily(family: string): string {
  return (family.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
}

const ZERO = /^0(px)?( 0(px)?)*$/;

export function keyStyles(v: StyleValues): string {
  const parts: string[] = [];
  const get = (p: string) => (v[p] ?? "").trim();
  const display = get("display");
  if (display && display !== "block" && display !== "inline") parts.push(display);
  const size = get("font-size");
  if (size) {
    const lh = get("line-height");
    const lead = lh && lh !== "normal" ? `${size}/${lh}` : size;
    parts.push(`font ${[lead, firstFamily(get("font-family")), get("font-weight")].filter(Boolean).join(" ")}`);
  }
  const color = get("color");
  if (color) parts.push(`color ${toHex(color)}`);
  const bg = get("background-color");
  if (bg && !isTransparent(bg)) parts.push(`bg ${toHex(bg)}`);
  for (const p of ["padding", "margin"] as const) {
    const val = get(p);
    if (val && !ZERO.test(val)) parts.push(`${p} ${val}`);
  }
  const gap = get("gap");
  if (gap && gap !== "normal" && !ZERO.test(gap)) parts.push(`gap ${gap}`);
  const radius = get("border-radius");
  if (radius && !ZERO.test(radius)) parts.push(`radius ${radius}`);
  const border = get("border");
  if (border && !/^0px|none/.test(border)) parts.push(`border ${border.replace(/(rgba?|lab|lch|oklab|oklch)\([^)]*\)/g, toHex)}`);
  return parts.join(" · ");
}
