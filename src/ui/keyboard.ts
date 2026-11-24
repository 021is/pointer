// The keyboard edge: never while typing (the page's fields or Pointer's own), never over a text
// selection for Ctrl+C; every key Pointer takes is kept from the page, its keyup too for Esc.
// Esc is Pointer's while it is open (Edvard, 2026-11-24: Esc sometimes closed his app's own sheet;
// then "Esc closes Pointer"): it closes Pointer's own control that has focus (shared/escape.ts),
// else an open menu or the sheet, else Pointer itself; only with the Page tool and nothing of
// Pointer's open does Esc pass to the page, untouched, for the page's own Esc.

import type { Color } from "../marks/types";
import type { WalkKey } from "../pick/walk";
import { escapeFor } from "../shared/escape";
import { commandFor } from "./keys";
import type { Tool } from "./state";

export type KeyActions = {
  tool: (t: Tool) => void;
  color: (c: Color) => void;
  image: () => void;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  /** Closes Pointer's open menu or sheet; false when none was open. */
  escape: () => boolean;
  /** Closes Pointer. */
  close: () => void;
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

export type KeyHandler = { keydown: (e: KeyboardEvent) => void; keyup: (e: KeyboardEvent) => void };

export const isEditable = (t: EventTarget | null | undefined) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

/** A part of Pointer's own UI that handles its keys itself (the draw menu: arrows, Enter). */
const ownsKeys = (e: KeyboardEvent) => e.composedPath().some((n) => n instanceof HTMLElement && n.hasAttribute("data-own-keys"));

/** A key Pointer takes: the page's listeners after Pointer's never see it, nor does the browser act. */
function take(e: KeyboardEvent) {
  e.preventDefault();
  e.stopImmediatePropagation();
}

const isEscape = (e: KeyboardEvent) => e.key === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey;

export function keyHandler(tool: () => Tool, run: KeyActions): KeyHandler {
  /** Whether Pointer took the Esc now down, so its keyup is Pointer's too. */
  let tookEscape = false;

  /** Esc, Pointer's in order; false only with the Page tool and nothing of Pointer's open. */
  function routeEscape(e: KeyboardEvent): boolean {
    const own = escapeFor(e.composedPath());
    if (own) {
      take(e);
      own();
      return true;
    }
    if (run.escape()) {
      take(e);
      return true;
    }
    if (tool() === "page") return false;
    take(e);
    run.close();
    return true;
  }

  function keydown(e: KeyboardEvent) {
    if (isEscape(e)) {
      tookEscape = routeEscape(e);
      return;
    }
    if (isEditable(e.composedPath()[0]) || ownsKeys(e)) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "v") return run.beforePaste();
    const cmd = commandFor(e, tool());
    if (!cmd) return;
    if (cmd.type === "copy" && !getSelection()?.isCollapsed) return;
    if (cmd.type === "see" && !run.overPasted()) return;
    if (cmd.type === "remove" && !run.canRemove()) return;
    take(e);
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
  }

  /** Some pages close on Esc's keyup: the keyup of an Esc Pointer took is Pointer's too, also when
   *  that Esc closed Pointer (app.ts keeps this listener on the window for the page's life, so it
   *  stays ahead of the page's later ones; it takes nothing else). */
  function keyup(e: KeyboardEvent) {
    if (!isEscape(e) || !tookEscape) return;
    tookEscape = false;
    take(e);
  }

  return { keydown, keyup };
}
