// Esc pressed with focus at an element, as the browser sends it and Pointer takes it: a real
// keydown dispatched at the element, with Pointer's keyboard edge on the window's capture phase as
// app.ts puts it (ui/keyboard.ts → shared/escape.ts). Page tool, nothing of Pointer's open: only one
// of Pointer's own controls around the element can take it.
import { keyHandler } from "../src/ui/keyboard";
import { actions } from "./key-actions";

/** True when Pointer took the Esc (one of its own controls closed). */
export function pressEscape(el: Element): boolean {
  const keys = keyHandler(() => "page", actions(false));
  window.addEventListener("keydown", keys.keydown, true);
  try {
    const down = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, composed: true });
    el.dispatchEvent(down);
    return down.defaultPrevented;
  } finally {
    window.removeEventListener("keydown", keys.keydown, true);
  }
}
