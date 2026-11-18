// What the agent gets, as data. format.ts turns it into the few lines that are pasted.

/** Where the code is, when the page's dev build tells us. */
export type Source = { file: string; line?: number; column?: number };

export type Framework = "react" | "vue" | "svelte" | "angular" | "none";

/** What the page's own scripts say about an element (read in the page's world, see source/). */
export type ComponentInfo = {
  framework: Framework;
  /** The component and its owners, innermost first: ["ProfileCard", "EventList", "EventsPage"]. */
  chain: string[];
  source?: Source;
  /** The next file up, when the source is a shared component (button.tsx used in Menu.tsx). */
  usedAt?: Source;
  /** Why there is no source, said plainly ("prod build: no source map"). */
  sourceNote?: string;
};

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

export type PinInfo = {
  n: number;
  kind: "pick" | "comment";
  component: ComponentInfo;
  el: ElementInfo;
  /** The style panel's edits, one per line ("font-size 15px → 17px"). */
  changes: string[];
  note: string;
};

export type DrawingSummary = {
  arrows: number;
  boxes: number;
  ellipses: number;
  pens: number;
  texts: string[];
};

export type Bundle = {
  url: string;
  viewport: { w: number; h: number };
  pins: PinInfo[];
  drawings: DrawingSummary;
  /** The picture's size in pixels, or null when the bundle is text only. */
  image: { w: number; h: number } | null;
};
