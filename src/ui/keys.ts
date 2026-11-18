// Keys → commands, as a pure table (tested). Single letters only without Ctrl/Alt/Meta, so the
// browser's and the page's own shortcuts keep working.

import type { Color } from "../marks/types";
import type { WalkKey } from "../pick/walk";
import { type Tool, targetsElements } from "./state";
import { COLOR_KEYS, TOOLS } from "./toolbar";

export type Command =
  | { type: "tool"; tool: Tool }
  | { type: "color"; color: Color }
  | { type: "image" }
  | { type: "undo" }
  | { type: "copy" }
  | { type: "escape" }
  | { type: "walk"; key: WalkKey }
  | { type: "pick-hover" }
  | { type: "panel" }
  /** [ and ]: the pasted image under the mouse more or less see-through. */
  | { type: "see"; direction: -1 | 1 }
  /** Delete / Backspace: the pasted image under the mouse goes. */
  | { type: "remove" };

export type KeyInput = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">;

const WALK = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export function commandFor(e: KeyInput, tool: Tool): Command | null {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === "z") return { type: "undo" };
    if (k === "c") return { type: "copy" };
    return null;
  }
  if (mod || e.altKey) return null;
  if (e.key === "Escape") return { type: "escape" };
  if (e.key === "[") return { type: "see", direction: -1 };
  if (e.key === "]") return { type: "see", direction: 1 };
  if (e.key === "Delete" || e.key === "Backspace") return { type: "remove" };
  if (targetsElements(tool) && WALK.has(e.key)) return { type: "walk", key: e.key as WalkKey };
  if (targetsElements(tool) && e.key === "Enter") return { type: "pick-hover" };
  const k = e.key.toUpperCase();
  const entry = TOOLS.find((t) => t.key === k);
  if (entry) return { type: "tool", tool: entry.tool };
  const color = COLOR_KEYS[Number(e.key) - 1];
  if (/^[1-9]$/.test(e.key) && color) return { type: "color", color };
  if (k === "I") return { type: "image" };
  if (k === "S") return { type: "panel" };
  return null;
}
