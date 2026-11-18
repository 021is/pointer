// The seam between the app and the style panel: what the panel hooks into, and what it gets.

import type { Pin } from "../marks/types";

export type Extension = {
  changesOf: (pin: Pin) => string[];
  onPick: (pin: Pin) => void;
  onRemove: (pin: Pin) => void;
  /** S or 🎨: the panel for the last pick, or away again. */
  togglePanel: (lastPick: Pin | undefined) => void;
};

/** What the app gives the panel: a redraw, and a pin's number as the bundle shows it. */
export type ExtensionHost = { rerender: () => void; numberOf: (pin: Pin) => number };
