// Undo, Redo and Clear everything, the one way: the bar's buttons, the keys, the toast and "clear
// after copy" all come here (Edvard, 2026-11-19: "I couldn't redo what I undo"). Undo takes back
// the last mark, or the last Clear everything; Redo puts back what Undo took, in order, with the
// picks' CSS edits. Any other change to the marks after an undo starts a new story: Redo empties.

import { type Mark, isPin } from "../marks/types";
import { IS_MAC } from "../shared/platform";
import type { Extension } from "./extension";
import { type State, pinsOf } from "./state";
import type { ToastAction } from "./toast";

export type HistoryHost = {
  state: State;
  hooks: () => Extension;
  update: (change: () => void) => void;
  say: (message: string, kind?: "ok" | "error", action?: ToastAction) => void;
};

/** What Redo puts back: one mark (and its edits), or a Clear everything done again. */
type Step = { kind: "mark"; mark: Mark; restore: () => void } | { kind: "clear" };

export const UNDO_KEY = IS_MAC ? "⌘Z" : "Ctrl+Z";
export const REDO_KEY = IS_MAC ? "⌘⇧Z" : "Ctrl+Shift+Z";

/** The same marks, one by one: a move replaces its mark, so it counts as a change. */
export const sameMarks = (a: readonly Mark[], b: readonly Mark[]) => a.length === b.length && a.every((m, i) => m === b[i]);

export type History = {
  undo: () => void;
  redo: () => void;
  clear: (message: string) => void;
  /** Another page's marks came in (screen/sheets.ts): nothing of before can be undone or redone. */
  restart: () => void;
};

export function createHistory(h: HistoryHost): History {
  let redos: Step[] = [];
  /** The last Clear everything, while nothing has changed since: Undo brings it back. */
  let cleared: { before: Mark[]; restore: () => void } | null = null;
  /** The marks as Undo, Redo or Clear left them; anything else changed them since. */
  let left: Mark[] = [];

  const settle = () => {
    left = h.state.marks.slice();
  };
  const fresh = () => {
    if (sameMarks(left, h.state.marks)) return;
    redos = [];
    cleared = null;
  };

  function clearNow(): boolean {
    if (h.state.marks.length === 0) return false;
    const before = h.state.marks.slice();
    const restore = h.hooks().park(pinsOf(before));
    h.update(() => (h.state.marks = []));
    cleared = { before, restore };
    settle();
    return true;
  }

  const redoAction: ToastAction = { label: "Redo", run: () => redo() };
  const undoAction: ToastAction = { label: "Undo", run: () => undo() };

  function undo() {
    fresh();
    if (cleared) {
      const { before, restore } = cleared;
      cleared = null;
      h.update(() => {
        h.state.marks = before.slice();
        restore();
      });
      redos.push({ kind: "clear" });
      settle();
      return h.say("Everything is back.", "ok", redoAction);
    }
    const mark = h.state.marks.at(-1);
    if (!mark) return;
    const restore = isPin(mark) ? h.hooks().park([mark]) : () => {};
    h.update(() => h.state.marks.pop());
    redos.push({ kind: "mark", mark, restore });
    settle();
  }

  function redo() {
    fresh();
    const step = redos.pop();
    if (!step) return h.say(`Nothing to redo: Redo (${REDO_KEY}) puts back what Undo took.`);
    if (step.kind === "clear") {
      clearNow();
      return h.say("Cleared again.", "ok", undoAction);
    }
    h.update(() => {
      h.state.marks.push(step.mark);
      step.restore();
    });
    settle();
  }

  return {
    undo,
    redo,
    clear(message) {
      fresh();
      if (!clearNow()) return;
      redos = [];
      h.say(message, "ok", undoAction);
    },
    restart() {
      redos = [];
      cleared = null;
      settle();
    },
  };
}
