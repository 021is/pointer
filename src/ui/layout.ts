// The bar's two arrangements of the same buttons (toolbar.ts makes them, this places them): the
// wide bar's groups in Edvard's order (2026-11-19: "group them"), or the narrow bar's row of what
// fits (fit.ts) with the sheet holding the rest (sheet.ts). Buttons are moved, never copied, so
// each has one state and a keyboard walks them in the order seen.

import type { Sizes } from "./fit";
import { type Part, SPLITS, type Sheet } from "./sheet";

export type Parts = Readonly<Record<Part, HTMLElement>>;

export type Frame = { grip: HTMLElement; exit: HTMLElement; toggle: HTMLElement; sheet: Sheet };

export type Layout = {
  wide: () => void;
  narrow: (row: ReadonlySet<Part>) => void;
  /** Each part's width as the narrow row lays it out now, measured here with every candidate in
   *  the row (toolbar.ts), for fit.ts to choose from. */
  sizes: () => Sizes;
};

/** The narrow row keeps the wide bar's order, so a tool keeps its neighbours as the width changes.
 *  A ▾ sits inside its button's group, the colours and Picture | Text only ever in the sheet. */
const ROW: readonly Part[] = ["page", "move", "pick", "comment", "idea", "crop", "draw", "icon", "image", "styles", "undo", "redo", "clear", "copy"];

/** Where the grip left the wide bar: the narrow bar docks by its own CSS, so these go. */
const DRAGGED = ["transform", "bottom", "left", "top"] as const;

const span = () => Object.assign(document.createElement("span"), { className: "group" });

/** A ▾ back beside its button, before the menu it opens. */
function home(group: HTMLElement, caret: HTMLElement) {
  group.insertBefore(caret, group.querySelector(".menu"));
}

const widthOf = (el: Element) => el.getBoundingClientRect().width;

/** A split button's own tool: its first child, before its ▾ and its menu. */
function tool(group: HTMLElement): Element {
  const main = group.firstElementChild;
  if (!main) throw new Error("a split button with no tool");
  return main;
}

export function createLayout(bar: HTMLElement, p: Parts, frame: Frame): Layout {
  const [using, marking, drawing, upload, edit] = [span(), span(), span(), span(), span()];
  return {
    wide() {
      for (const [main, caret] of SPLITS) home(p[main], p[caret]);
      using.replaceChildren(p.page, p.move);
      marking.replaceChildren(p.pick, p.comment, p.idea, p.crop);
      drawing.replaceChildren(p.draw, p.icon);
      upload.replaceChildren(p.image);
      edit.replaceChildren(p.styles, p.undo, p.redo, p.clear);
      bar.replaceChildren(frame.grip, using, marking, drawing, p.colors, upload, edit, p.output, p.copy, frame.exit, frame.toggle);
    },
    narrow(row) {
      for (const prop of DRAGGED) bar.style.removeProperty(prop);
      frame.sheet.arrange(p, (part) => !row.has(part), frame.exit);
      for (const [main, caret] of SPLITS) if (row.has(caret)) home(p[main], p[caret]);
      bar.replaceChildren(...ROW.filter((part) => row.has(part)).map((part) => p[part]), frame.toggle, frame.sheet.el);
    },
    sizes() {
      // Read now, while every candidate is in the row: each part the row may hold, a split
      // button's tool without its ▾.
      const width = new Map<Part, number>();
      for (const part of [...ROW, ...SPLITS.map(([, caret]) => caret)]) {
        const split = SPLITS.some(([main]) => main === part);
        width.set(part, widthOf(split ? tool(p[part]) : p[part]));
      }
      const of = (part: Part) => {
        const w = width.get(part);
        if (w === undefined) throw new Error(`the narrow row has no width for ${part}: it is not a row part`);
        return w;
      };
      return { of, more: widthOf(frame.toggle) };
    },
  };
}
