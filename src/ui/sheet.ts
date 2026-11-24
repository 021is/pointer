// The tool sheet on a narrow viewport (Edvard, 2026-11-24, trying 1.1.0 in DevTools' device mode:
// "I think Ui could get better maybe"). More opens it just above the bar, at most 45% of the seen
// height, the page still seen above it: a drag handle with Exit beside it, then three named groups,
// Mark, Edit and Send, Send at the bottom near the thumb. It lists only what the bar has no room
// for (fit.ts): the bar's own buttons, moved here, so the order a keyboard or a screen reader walks
// is the order seen. A group with nothing to show is not there.

/** A piece of the bar: a tool's button, the draw button with its menu, a menu's ▾ on its own, or
 *  another control. Exit and More/Close are the sheet's frame, never a group's. */
export type Part =
  | "pick"
  | "comment"
  | "idea"
  | "draw"
  | "drawCaret"
  | "icon"
  | "image"
  | "crop"
  | "colors"
  | "page"
  | "move"
  | "undo"
  | "redo"
  | "clear"
  | "styles"
  | "output"
  | "copy"
  | "copyCaret";

export type SheetGroup = { name: "Mark" | "Edit" | "Send"; parts: readonly Part[] };

/** Where each part goes when the bar keeps it in the sheet, top to bottom. */
export const SHEET: readonly SheetGroup[] = [
  { name: "Mark", parts: ["pick", "comment", "idea", "draw", "drawCaret", "icon", "image", "crop", "colors"] },
  { name: "Edit", parts: ["page", "move", "undo", "redo", "clear", "styles"] },
  { name: "Send", parts: ["output", "copy", "copyCaret"] },
];

export type Sheet = {
  el: HTMLElement;
  /** Fills the groups with the parts the bar keeps here, Exit by the handle. */
  arrange: (parts: Readonly<Record<Part, Element>>, here: (p: Part) => boolean, exit: Element) => void;
  /** Hides a group none of whose parts here shows (Text, or the colours without their tool). */
  show: (seen: (p: Part) => boolean) => void;
};

const div = (className: string) => Object.assign(document.createElement("div"), { className });

export function createSheet(): Sheet {
  const el = div("sheet");
  el.id = "pointer-sheet";
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "More tools");
  const head = div("sheet-head");
  const handle = div("handle");
  handle.setAttribute("aria-hidden", "true");

  const groups = SHEET.map((g) => {
    const section = div("sheet-group");
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", g.name);
    section.dataset.group = g.name.toLowerCase();
    const title = Object.assign(div("sheet-title"), { textContent: g.name });
    title.setAttribute("aria-hidden", "true");
    const cells = div("cells");
    section.append(title, cells);
    return { section, cells, all: g.parts, placed: [] as readonly Part[] };
  });
  const send = groups.at(-1);
  if (!send) throw new Error("the sheet needs its groups");
  const body = div("sheet-body");
  body.append(...groups.slice(0, -1).map((g) => g.section));
  el.append(head, body, send.section);

  return {
    el,
    arrange(parts, here, exit) {
      head.replaceChildren(handle, exit);
      for (const g of groups) {
        g.placed = g.all.filter(here);
        g.cells.replaceChildren(...g.placed.map((p) => parts[p]));
      }
    },
    show(seen) {
      for (const g of groups) g.section.hidden = !g.placed.some(seen);
    },
  };
}
