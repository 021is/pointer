// The small text box for a note, a comment or drawn text. Enter saves, Shift+Enter is a new line,
// Esc cancels. Resolves with the text, or null when cancelled.

import type { Point } from "../shared/geometry";

export type BubbleOptions = { at: Point; placeholder: string; value?: string; hint: string };

export function openBubble(root: ShadowRoot, options: BubbleOptions): Promise<string | null> {
  root.querySelector(".bubble")?.remove();
  const box = document.createElement("div");
  box.className = "bubble";
  const input = document.createElement("textarea");
  input.placeholder = options.placeholder;
  input.value = options.value ?? "";
  input.rows = 2;
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = options.hint;
  box.append(input, hint);

  const width = 280;
  const x = Math.min(Math.max(8, options.at.x + 16), window.innerWidth - width - 8);
  const y = Math.min(Math.max(8, options.at.y + 16), window.innerHeight - 110);
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  root.append(box);
  input.focus();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      box.remove();
      resolve(value);
    };
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
