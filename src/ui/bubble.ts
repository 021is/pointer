// The small text box for a note, a comment or drawn text. Enter saves, Shift+Enter is a new line,
// Esc cancels. Resolves with the text, or null when cancelled.

import type { Point } from "../shared/geometry";
import { isTouch } from "../shared/platform";
import { visibleView } from "../shared/view";

export type BubbleOptions = { at: Point; placeholder: string; value?: string; hint: string };

/** The open bubble's way out: a new bubble cancels it (as Esc would), so no caller waits forever. */
let cancelOpen: (() => void) | null = null;

export function openBubble(root: ShadowRoot, options: BubbleOptions): Promise<string | null> {
  cancelOpen?.();
  root.querySelector(".bubble")?.remove();
  const box = document.createElement("div");
  box.className = "bubble";
  const input = document.createElement("textarea");
  input.placeholder = options.placeholder;
  input.value = options.value ?? "";
  input.rows = 2;
  const hint = document.createElement("div");
  hint.className = "hint";
  // A finger has no Esc: what a tap does (leaving the box keeps what is typed, as blur does below).
  hint.textContent = isTouch() ? "Enter, or a tap outside, keeps what you typed" : options.hint;
  box.append(input, hint);

  // Beside the spot, inside the part of the page the person sees (a 320 px phone too).
  const view = visibleView();
  const width = Math.min(300, view.w - 16);
  const x = Math.min(Math.max(view.x + 8, options.at.x + 16), view.x + view.w - width - 8);
  const y = Math.min(Math.max(view.y + 8, options.at.y + 16), view.y + view.h - 110);
  box.style.width = `${width}px`;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  root.append(box);
  input.focus();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      if (cancelOpen === cancel) cancelOpen = null;
      box.remove();
      resolve(value);
    };
    const cancel = () => finish(null);
    cancelOpen = cancel;
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finish(input.value.trim());
      }
    });
    input.addEventListener("blur", () => finish(input.value.trim()));
  });
}

export function isBubbleOpen(root: ShadowRoot): boolean {
  return root.querySelector(".bubble") !== null;
}
