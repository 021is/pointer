// The seam between the app and the style panel: what the panel hooks into, and what it gets.

import type { Pin } from "../marks/types";

export type Extension = {
  changesOf: (pin: Pin) => string[];
  onPick: (pin: Pin) => void;
  onRemove: (pin: Pin) => void;
  /** Clear everything: onRemove for each pin, but the returned function takes it back (Undo). */
  park: (pins: Pin[]) => () => void;
  /** S or 🎨: the panel for the last pick, or away again; the answer says which, or why neither. */
  togglePanel: (lastPick: Pin | undefined) => PanelAnswer;
  /** The pick whose style box is open (collapsed or not), for the bar's button. */
  panelFor: () => Pin | null;
};

/** What a press on Styles did: every press does something the person sees (Edvard, 2026-11-19:
 *  "sometimes I click nothing happens"). */
export type PanelAnswer = "opened" | "closed" | "no-pick" | "gone";

/** What the app gives the panel: a redraw, and a pin's number as the bundle shows it. */
export type ExtensionHost = { rerender: () => void; numberOf: (pin: Pin) => number };
