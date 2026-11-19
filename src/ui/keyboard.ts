// The keydown edge: never while typing (the page's fields or Pointer's own), never over a text
// selection for Ctrl+C; every key Pointer takes is kept from the page.

import type { Color } from "../marks/types";
import type { WalkKey } from "../pick/walk";
import { commandFor } from "./keys";
import type { Tool } from "./state";

export type KeyActions = {
  tool: (t: Tool) => void;
  color: (c: Color) => void;
  image: () => void;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  escape: () => void;
  walk: (key: WalkKey) => void;
  take: () => void;
  panel: () => void;
  /** Cmd/Ctrl+V outside a field: the paste is steered to Pointer (the key itself is not taken). */
  beforePaste: () => void;
  /** True with a pasted image under the mouse: only then are [ and ] Pointer's. */
  overPasted: () => boolean;
  /** True with something removable under the mouse (a pasted image; any mark with Move): only then are Delete and Backspace Pointer's. */
  canRemove: () => boolean;
  see: (direction: -1 | 1) => void;
  remove: () => void;
  clear: () => void;
};

export const isEditable = (t: EventTarget | null | undefined) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

/** A part of Pointer's own UI that handles its keys itself (the draw menu: arrows, Enter, Esc). */
const ownsKeys = (e: KeyboardEvent) => e.composedPath().some((n) => n instanceof HTMLElement && n.hasAttribute("data-own-keys"));

export function keyHandler(tool: () => Tool, run: KeyActions): (e: KeyboardEvent) => void {
  return (e) => {
    if (isEditable(e.composedPath()[0]) || ownsKeys(e)) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "v") return run.beforePaste();
    const cmd = commandFor(e, tool());
    if (!cmd) return;
    if (cmd.type === "copy" && !getSelection()?.isCollapsed) return;
    if (cmd.type === "see" && !run.overPasted()) return;
    if (cmd.type === "remove" && !run.canRemove()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    switch (cmd.type) {
      case "tool":
        return run.tool(cmd.tool);
      case "color":
        return run.color(cmd.color);
      case "image":
        return run.image();
      case "undo":
        return run.undo();
      case "redo":
        return run.redo();
      case "copy":
        return run.copy();
      case "escape":
        return run.escape();
      case "walk":
        return run.walk(cmd.key);
      case "pick-hover":
        return run.take();
      case "panel":
        return run.panel();
      case "see":
        return run.see(cmd.direction);
      case "remove":
        return run.remove();
      case "clear":
        return run.clear();
    }
  };
}
