// Kept marks are checked where they enter the worker and as they come back from the store: the
// envelope at once, then each mark field by field, its shape's own fields and a pick's CSS edits
// included. Something this version cannot read is refused or named, never drawn (a box without
// its rect would break every frame) and never passed to the style box.

import { COLORS } from "../marks/types";
import type { Saved, SavedMark } from "./saved";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isPoint = (v: unknown) => isObj(v) && isNum(v.x) && isNum(v.y);
const isRect = (v: unknown) => isObj(v) && isPoint(v) && isNum(v.w) && isNum(v.h);
const isTarget = (v: unknown) => isObj(v) && isStr(v.selector) && isStr(v.tag) && isStr(v.label);
const isColor = (v: unknown) => isStr(v) && Object.hasOwn(COLORS, v);
const every = (v: unknown, ok: (x: unknown) => boolean) => Array.isArray(v) && v.every(ok);

/** A drawn shape with the fields its own kind is drawn from. */
function isShape(v: unknown): boolean {
  if (!isObj(v) || !isColor(v.color)) return false;
  switch (v.kind) {
    case "pen":
      return every(v.points, isPoint);
    case "arrow":
      return isPoint(v.from) && isPoint(v.to);
    case "box":
    case "ellipse":
      return isRect(v.rect) && (v.note === undefined || isStr(v.note));
    case "text":
      return isPoint(v.at) && isStr(v.text);
    default:
      return false;
  }
}

/** A pick's style edits, as the style box replays them. */
function isChange(v: unknown): boolean {
  if (!isObj(v)) return false;
  return (v.kind === "set" && isStr(v.value)) || v.kind === "off" || v.kind === "removed";
}
function isEdits(v: unknown): boolean {
  if (v === null) return true;
  return (
    isObj(v) &&
    every(v.props, (p) => isObj(p) && isStr(p.prop) && isStr(p.before) && isChange(p.change)) &&
    every(v.removedClasses, isStr) &&
    every(v.addedClasses, (c) => isObj(c) && isStr(c.name) && typeof c.built === "boolean")
  );
}

const isPinish = (m: Record<string, unknown>) => isColor(m.color) && isPoint(m.at) && isStr(m.note) && isTarget(m.target);

/** The envelope: version 1, and every mark an object with a kind (each is checked as it returns). */
export function isSaved(value: unknown): value is Saved {
  const s = value as Partial<Saved> | null;
  return s?.v === 1 && every(s.marks, (m) => isObj(m) && isStr(m.kind));
}

/** One saved mark, field by field: a kind this version knows, with the fields it needs. */
export function isSavedMark(v: unknown): v is SavedMark {
  if (!isObj(v)) return false;
  switch (v.kind) {
    case "shape":
      return isShape(v.shape);
    case "pin":
      return ["pick", "comment", "idea"].includes(String(v.pin)) && isPinish(v) && isEdits(v.edits);
    case "gap":
      return isPinish(v) && isTarget(v.other) && isObj(v.line) && isPoint(v.line.from) && isPoint(v.line.to) && isNum(v.line.px) && (v.line.axis === "x" || v.line.axis === "y");
    case "icon":
      return isPinish(v) && isStr(v.name) && isNum(v.size);
    case "crop":
      return isRect(v.rect) && (v.target === null || isTarget(v.target));
    case "image":
      return isStr(v.src) && v.src.startsWith("data:image/") && isRect(v.rect) && isNum(v.opacity);
    default:
      return false;
  }
}
