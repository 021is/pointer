// What the agent gets, as data. format.ts turns it into the few lines that are pasted.

/** Where the code is, when the page's dev build tells us. */
export type Source = { file: string; line?: number; column?: number };

export type Framework = "react" | "vue" | "svelte" | "angular" | "none";

/**
 * Where the code is: found (with, for a shared component such as button.tsx, the next file up
 * that uses it), unknown with the reason said plainly, or nothing to say (no framework at all).
 */
export type Where =
  | { kind: "found"; source: Source; usedAt?: Source }
  | { kind: "unknown"; why: string }
  | { kind: "silent" };

/** What the page's own scripts say about an element (read in the page's world, see source/). */
export type ComponentInfo = {
  framework: Framework;
  /** The component and its owners, innermost first: ["ProfileCard", "EventList", "EventsPage"]. */
  chain: string[];
  where: Where;
};

export const unknown = (why: string): ComponentInfo => ({
  framework: "none",
  chain: [],
  where: { kind: "unknown", why },
});

export type ElementInfo = {
  selector: string;
  tag: string;
  text?: string;
  /** The class attribute as written, kept only when there is no source to open. */
  className?: string;
  size: { w: number; h: number };
  /** The key computed styles, already one line (key-styles.ts). */
  style?: string;
};

type PinBaseInfo = {
  n: number;
  component: ComponentInfo;
  el: ElementInfo;
  /** The style panel's edits, one per line ("font-size 15px → 17px"). */
  changes: string[];
  note: string;
};

/** A pin, as read at Copy; a gap also names its second element and what it measured. */
export type PinInfo =
  | (PinBaseInfo & { kind: "pick" | "comment" | "idea" })
  | (PinBaseInfo & { kind: "gap"; px: number; axis: "x" | "y"; other: { component: ComponentInfo; el: ElementInfo } })
  | (PinBaseInfo & { kind: "icon"; name: string });

export type DrawingSummary = {
  arrows: number;
  boxes: number;
  ellipses: number;
  pens: number;
  texts: string[];
  /** Images Edvard pasted onto the page: references, not the page itself. */
  pasted: number;
};

/** How a crop shows in the picture: whole (Pointer scrolls one out of view into it, then back),
 *  its top left part (larger than the screen), or not at all (gone from the page). */
export type CropShown = "whole" | "part" | "none";

/** A crop frame: a component (with its component info) or a dragged rectangle. */
export type CropInfo = {
  label: string;
  component: ComponentInfo | null;
  size: { w: number; h: number };
  shown: CropShown;
};

export type Bundle = {
  url: string;
  viewport: { w: number; h: number };
  crops: CropInfo[];
  pins: PinInfo[];
  /** Boxes and ellipses with a note typed on them, numbered after the pins. */
  shapeNotes: ShapeNote[];
  drawings: DrawingSummary;
  /** The picture's size in pixels, or null when the bundle is text only. */
  image: { w: number; h: number } | null;
};

export type ShapeNote = { n: number; kind: "box" | "ellipse"; note: string };
