// What Pointer's keys do on a running Pointer: keys.ts maps a key to a command, keyboard.ts takes
// it from the page, and this wires each command to the app (app.ts).

import { iconAt } from "../icons/icons";
import type { Mark } from "../marks/types";
import type { PastedLayer } from "../paste/pasted";
import { viewRect } from "../pick/describe";
import { walk } from "../pick/walk";
import { scroll } from "../screen/surface";
import type { Point } from "../shared/geometry";
import type { History } from "./history";
import { keyHandler } from "./keyboard";
import { markAt } from "./move";
import { type Output, type State, type Tool, otherOutput } from "./state";

export type AppKeysHost = {
  state: State;
  hist: History;
  pasted: PastedLayer;
  setTool: (tool: Tool) => void;
  setOutput: (output: Output) => void;
  update: (change: () => void) => void;
  setHover: (el: Element | null) => void;
  pick: (el: Element, at: Point) => void;
  cropElement: (el: Element) => void;
  copy: () => void;
  panel: () => void;
  clear: () => void;
  close: () => void;
  /** The last point the mouse was on, on the marked page. */
  mouse: () => Point;
};

export function appKeys(h: AppKeysHost): (e: KeyboardEvent) => void {
  const { state, pasted, update } = h;
  const trail: Element[] = [];
  /** What Delete takes: a pasted image or an icon under the mouse, or with Move any mark there. */
  const removable = (): Mark | undefined =>
    pasted.hovered() ?? iconAt(state.marks, h.mouse()) ?? (state.tool === "move" ? markAt(state.marks, h.mouse()) : undefined);

  return keyHandler(() => state.tool, {
    tool: h.setTool,
    color: (c) => update(() => (state.color = c)),
    image: () => h.setOutput(otherOutput(state.output)),
    undo: h.hist.undo,
    redo: h.hist.redo,
    copy: h.copy,
    escape: () => (state.tool === "page" ? h.close() : h.setTool("page")),
    walk: (key) => {
      if (!state.hover) return;
      const next = walk(state.hover.el, key, trail);
      state.hover = null;
      h.setHover(next);
    },
    take: () => {
      const el = state.hover?.el;
      if (!el) return;
      if (state.tool === "crop") return h.cropElement(el);
      const r = viewRect(el);
      const s = scroll();
      h.pick(el, { x: r.x + s.x, y: r.y + s.y });
    },
    panel: h.panel,
    beforePaste: () => pasted.catchPaste(),
    overPasted: () => pasted.hovered() !== undefined,
    canRemove: () => removable() !== undefined,
    see: (direction) => {
      const p = pasted.hovered();
      if (p) pasted.see(p, direction);
    },
    remove: () => {
      const gone = removable();
      if (gone) update(() => (state.marks = state.marks.filter((m) => m !== gone)));
    },
    clear: h.clear,
  });
}
