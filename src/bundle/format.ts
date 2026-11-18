// The bundle as the agent reads it: short markdown lines, no JSON (fewer tokens, same meaning).
// Every line earns its place: what is unknown says why, what is empty is left out.

import { imageTokens } from "../shared/geometry";
import type { Bundle, CropInfo, DrawingSummary, PinInfo, Source } from "./types";

/** The page's address without query or hash: a URL can carry a token, and this goes into a chat. */
export function safeUrl(href: string): string {
  const u = new URL(href);
  return u.origin + u.pathname;
}

const TEXT_MAX = 80;
const CLASS_MAX = 160;

export function clip(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

export function formatSource(s: Source): string {
  if (s.line === undefined) return s.file;
  return s.column === undefined ? `${s.file}:${s.line}` : `${s.file}:${s.line}:${s.column}`;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export function formatDrawings(d: DrawingSummary): string | null {
  const parts = [
    d.arrows ? plural(d.arrows, "arrow") : "",
    d.boxes ? plural(d.boxes, "box", "boxes") : "",
    d.ellipses ? plural(d.ellipses, "ellipse") : "",
    d.pens ? plural(d.pens, "pen stroke") : "",
    ...d.texts.map((t) => `text "${clip(t, TEXT_MAX)}"`),
    d.pasted ? `${plural(d.pasted, "pasted image")} (a reference laid on the page, not the page)` : "",
  ].filter(Boolean);
  return parts.length ? `drawn: ${parts.join(", ")}` : null;
}

function formatPin(p: PinInfo): string[] {
  const c = p.component;
  const who = c.chain.length ? c.chain.join(" ← ") : p.el.tag;
  const lines = [`[${p.n}] ${p.kind} · ${who}`];
  const w = c.where;
  if (w.kind === "found") {
    lines.push(`   file: ${formatSource(w.source)}`);
    if (w.usedAt) lines.push(`   used at: ${formatSource(w.usedAt)}`);
  } else if (w.kind === "unknown") {
    lines.push(`   file: unknown (${w.why})`);
  }
  const text = p.el.text ? ` "${clip(p.el.text, TEXT_MAX)}"` : "";
  lines.push(`   el: ${p.el.selector}${text} · ${p.el.size.w}×${p.el.size.h}`);
  if (w.kind !== "found" && p.el.className) lines.push(`   class: "${clip(p.el.className, CLASS_MAX)}"`);
  // A comment is about its note; the look is a pick's business.
  if (p.el.style && p.kind === "pick") lines.push(`   style: ${p.el.style}`);
  if (p.changes.length) {
    lines.push(`   changed: ${p.changes[0]}`);
    for (const change of p.changes.slice(1)) lines.push(`            ${change}`);
  }
  if (p.note.trim()) lines.push(`   note: ${p.note.trim()}`);
  return lines;
}

/** "crop A · ProfileHeader ← ProfilePage · src/…/Header.tsx:42 · 320×180", or "crop B · frame 400×300". */
export function formatCrop(c: CropInfo): string {
  const size = `${c.size.w}×${c.size.h}`;
  const off = c.offScreen ? " (off screen, not in the picture)" : "";
  const info = c.component;
  if (!info) return `crop ${c.label} · frame ${size}${off}`;
  const who = info.chain.length ? `${info.chain.join(" ← ")} · ` : "";
  const file = info.where.kind === "found" ? `${formatSource(info.where.source)} · ` : "";
  return `crop ${c.label} · ${who}${file}${size}${off}`;
}

function headLine(b: Bundle): string {
  const components = [...b.pins.map((p) => p.component), ...b.crops.flatMap((c) => (c.component ? [c.component] : []))];
  const frameworks = [...new Set(components.map((c) => c.framework))].filter((f) => f !== "none");
  return [`Pointer · ${b.url} · viewport ${b.viewport.w}×${b.viewport.h}`, ...frameworks].join(" · ");
}

const fileOnly = (s: Source): string => formatSource({ ...s, file: s.file.split("/").pop() ?? s.file });

/** A pin in the strip: who and where on one line, then only its changes and its note. */
function stripPin(p: PinInfo): string[] {
  const w = p.component.where;
  const who = p.component.chain[0] ?? p.el.tag;
  const text = p.el.text ? ` "${clip(p.el.text, 40)}"` : "";
  const where =
    w.kind === "found"
      ? `${formatSource(w.source)}${w.usedAt ? ` (in ${fileOnly(w.usedAt)})` : ""}`
      : `${p.el.selector}${text}`;
  const lines = [`[${p.n}] ${p.kind} · ${who} · ${where}`];
  if (p.changes.length) lines.push(`   changed: ${p.changes.join("; ")}`);
  if (p.note.trim()) lines.push(`   note: ${p.note.trim()}`);
  return lines;
}

/**
 * The strip printed under the picture: what an agent needs to act (where, what changed, what
 * Edvard said), nothing it can read in the file itself. The copied text keeps every detail.
 */
export function formatStrip(b: Bundle): string {
  const lines = [headLine(b), ...b.crops.map(formatCrop)];
  const drawn = formatDrawings(b.drawings);
  if (drawn) lines.push(drawn);
  for (const pin of b.pins) lines.push(...stripPin(pin));
  return lines.join("\n");
}

export function formatBundle(b: Bundle): string {
  const lines = [headLine(b)];
  if (b.image) {
    lines.push(
      `image: ${b.image.w}×${b.image.h} (≈${imageTokens(b.image)} tokens), numbers on it match [n] below`,
    );
  }
  for (const crop of b.crops) lines.push(formatCrop(crop));
  const drawn = formatDrawings(b.drawings);
  if (drawn) lines.push(drawn);
  for (const pin of b.pins) lines.push(...formatPin(pin));
  return lines.join("\n");
}
