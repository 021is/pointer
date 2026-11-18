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
  copy: () => void;
  escape: () => void;
  walk: (key: WalkKey) => void;
  take: () => void;
  panel: () => void;
  see: (direction: -1 | 1) => void;
  remove: () => void;
};

export const isEditable = (t: EventTarget | null | undefined) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

export function keyHandler(tool: () => Tool, run: KeyActions): (e: KeyboardEvent) => void {
  return (e) => {
    if (isEditable(e.composedPath()[0])) return;
    const cmd = commandFor(e, tool());
    if (!cmd) return;
    if (cmd.type === "copy" && !getSelection()?.isCollapsed) return;
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
    }
  };
}
