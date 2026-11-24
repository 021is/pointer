// What the narrow bar keeps at hand (Edvard, 2026-11-24, at a mini tablet's ~700 px: the bar
// stretched across with five icons far apart read as broken). The bar is as wide as its tools and
// centred; it holds as many as the seen width has room for, in the order of PRIORITY, and More
// for the rest, which the sheet lists (sheet.ts). A phone keeps Pick, Comment, Draw, Undo and
// Copy; a wider screen adds Copy's and Draw's menus, then Move, Icon, Crop, Idea, Image, Redo, ...
// Pure: the bar (toolbar.ts) measures the seen width and lays out what this returns.

import type { Output } from "./state";
import type { Part } from "./sheet";

/** A cell of the narrow bar, its name under its icon; a ▾ beside its button. narrow-css.ts sets
 *  the same widths, so the sums here are the bar's real width. */
export const CELL = 48;
export const CARET = 44;
/** Around the row's cells: the margin either side of the bar, its padding and its border. */
export const ROW_FRAME = 2 * 6 + 2 * 4 + 2 * 1;

/** What the bar keeps first. The colours and Picture | Text stay in the sheet: they change with the
 *  tool, and Copy's menu names the output too. */
export const PRIORITY: readonly Part[] = [
  "pick",
  "comment",
  "draw",
  "undo",
  "copy",
  "copyCaret",
  "drawCaret",
  "move",
  "icon",
  "crop",
  "idea",
  "image",
  "redo",
  "page",
  "clear",
  "styles",
];

const width = (p: Part) => (p === "drawCaret" || p === "copyCaret" ? CARET : CELL);

/** The parts a picture needs: Text hides them (Gap stays on its key, its text says enough). */
const PICTURE: ReadonlySet<Part> = new Set<Part>(["draw", "drawCaret", "icon", "image", "crop", "colors"]);

/** Whether a part shows at all: not a picture's in Text, the colours only with a tool they colour. */
export function seenPart(p: Part, output: Output, colors: boolean): boolean {
  if (output === "text" && PICTURE.has(p)) return false;
  return p !== "colors" || colors;
}

/** The parts the bar keeps for a seen width, as many of PRIORITY as fit beside More, in its order
 *  (the first that does not fit ends the row, so a later small one never jumps ahead). */
export function fitRow(viewWidth: number, output: Output): ReadonlySet<Part> {
  let room = viewWidth - ROW_FRAME - CELL;
  const row = new Set<Part>();
  for (const p of PRIORITY.filter((part) => seenPart(part, output, false))) {
    if (width(p) > room) break;
    room -= width(p);
    row.add(p);
  }
  return row;
}
