// Clear everything, the one way: the bar's button, ⇧⌫, and "clear after copy" all come here. The
// marks and the style edits go at once, and Undo in the message brings both back.

import type { Mark } from "../marks/types";
import type { Extension } from "./extension";
import { type State, pinsOf } from "./state";
import type { ToastAction } from "./toast";

export type ClearHost = {
  state: State;
  hooks: () => Extension;
  update: (change: () => void) => void;
  say: (message: string, kind?: "ok" | "error", action?: ToastAction) => void;
};

export function clearAll(h: ClearHost, message: string): void {
  if (h.state.marks.length === 0) return;
  const before: Mark[] = h.state.marks.slice();
  const restoreEdits = h.hooks().park(pinsOf(before));
  h.update(() => (h.state.marks = []));
  h.say(message, "ok", {
    label: "Undo",
    run: () =>
      h.update(() => {
        h.state.marks = before;
        restoreEdits();
      }),
  });
}
