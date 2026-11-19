// The bar's Styles button and S: every press does something the person sees (Edvard, 2026-11-19:
// "sometimes I click nothing happens"): it opens the last pick's style box, closes it, or says why
// it can't. The button names the element it would open and shows open / ready / empty.

import type { Pin } from "../marks/types";
import type { Extension, PanelAnswer } from "./extension";

export type StylesLook = { state: "open" | "ready" | "empty"; tip: string };

/** What the button says before a press: whose styles, and whether a press can open them. */
export function stylesLook(pick: Pin | undefined, open: Pin | null, name: (el: Element) => string): StylesLook {
  if (!pick) return { state: "empty", tip: "Styles: no pick yet (P, then click an element)" };
  if (!pick.el.isConnected) return { state: "empty", tip: "Styles: the picked element left the page, pick it again" };
  if (open === pick) return { state: "open", tip: `Styles of ${name(pick.el)} (open: press to close)` };
  return { state: "ready", tip: `Styles of ${name(pick.el)}` };
}

/** What a press that opened nothing says, in the toast. */
export function stylesMessage(answer: PanelAnswer): string | null {
  switch (answer) {
    case "opened":
    case "closed":
      return null;
    case "no-pick":
      return "No pick yet: press P, then click an element to change its styles.";
    case "gone":
      return "The picked element left the page (it re-rendered or reloaded): pick it again.";
  }
}

export function pressStyles(hooks: Extension, pick: Pin | undefined, say: (message: string) => void): void {
  const message = stylesMessage(hooks.togglePanel(pick));
  if (message) say(message);
}
