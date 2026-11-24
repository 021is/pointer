// Esc pressed with focus at an element, routed as Pointer's window-level look at Esc routes it
// (ui/keyboard.ts → shared/escape.ts): the innermost of Pointer's own controls around it closes.
import { escapeFor } from "../src/shared/escape";

/** True when one of Pointer's own controls took the Esc. */
export function pressEscape(el: Element): boolean {
  const path: EventTarget[] = [];
  for (let n: Node | null = el; n; n = n instanceof ShadowRoot ? n.host : n.parentNode) path.push(n);
  const close = escapeFor(path);
  close?.();
  return close !== undefined;
}
