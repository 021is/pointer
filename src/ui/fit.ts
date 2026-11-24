// What the narrow bar keeps at hand (Edvard, 2026-11-24, at a mini tablet's ~700 px: the bar
// stretched across with five icons far apart read as broken). The bar is as wide as its tools and
// centred; it holds Copy and More always, and as many others as the seen width has room for, in the
// order of PRIORITY; the sheet lists the rest (sheet.ts). A phone keeps Pick, Comment, Draw, Undo
// and Copy; a wider screen adds Copy's and Draw's menus, then Move, Icon, Crop, Idea, Image, ...
// Each cell is as wide as its name needs (Edvard, 2026-11-24, in Chrome on a Mac: "Comment" ran
// past its cell), so the widths are measured, never assumed: layout.ts measures each cell as laid
// out, toolbar.ts reads the seen width, and this only takes both and says what fits. Pure.

import type { Output } from "./state";
import { type Part, isCaret } from "./sheet";

/** The space between two cells of the row; a menu's ▾ sits against its tool, with no gap. */
export const GAP = 4;
/** The bar's margin either side of the seen width and its side padding (narrow-css.ts sets both from
 *  here); 3 px of padding lets a 320 px phone keep the five quick tools and More. */
export const BAR_MARGIN = 4;
export const BAR_PAD = 3;
/** Around the row's cells: both margins, both paddings and the bar's 1 px border. */
export const ROW_FRAME = 2 * BAR_MARGIN + 2 * BAR_PAD + 2 * 1;

/** Each part's width as laid out (a split button's tool without its ▾), and More's. */
export type Sizes = { of: (p: Part) => number; more: number };

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

/** The parts a picture needs: Text hides them (Gap stays on its key, its text says enough). */
const PICTURE: ReadonlySet<Part> = new Set<Part>(["draw", "drawCaret", "icon", "image", "crop", "colors"]);

/** Whether a part shows at all: not a picture's in Text, the colours only with a tool they colour. */
export function seenPart(p: Part, output: Output, colors: boolean): boolean {
  if (output === "text" && PICTURE.has(p)) return false;
  return p !== "colors" || colors;
}

/** The parts the row may hold, in PRIORITY's order: what shows for the output. */
export const rowCandidates = (output: Output): Part[] => PRIORITY.filter((p) => seenPart(p, output, false));

/** The parts the bar keeps for a seen width: Copy and More always, then as many of PRIORITY as fit,
 *  in its order (the first that does not fit ends the row, so a later small one never jumps ahead).
 *  A cell takes its width and one gap; a ▾ only its width, against its tool. */
export function fitRow(viewWidth: number, output: Output, size: Sizes): ReadonlySet<Part> {
  const take = (p: Part) => size.of(p) + (isCaret(p) ? 0 : GAP);
  let room = viewWidth - ROW_FRAME - size.more - size.of("copy") - GAP;
  const row = new Set<Part>(["copy"]);
  for (const p of rowCandidates(output).filter((part) => part !== "copy")) {
    if (take(p) > room) break;
    room -= take(p);
    row.add(p);
  }
  return row;
}

/** How the bar is laid out: the wide bar's groups, or the narrow row for a seen width and an output. */
export type Laid = { kind: "wide" } | { kind: "narrow"; width: number; output: Output };

/** What a new layout asks of the bar. */
export const Relayout = { KEEP: "keep", ARRANGE: "arrange", CLOSE_AND_ARRANGE: "close and arrange" } as const;
export type Relayout = (typeof Relayout)[keyof typeof Relayout];

/** Nothing when the layout is the same; a new arrangement with the sheet closed when the width
 *  changed (wide ↔ narrow, or another narrow width); a new arrangement with the sheet left open when
 *  only the output changed (Picture | Text is pressed in the sheet). */
export function relayout(was: Laid, now: Laid): Relayout {
  if (was.kind === "wide" && now.kind === "wide") return Relayout.KEEP;
  if (was.kind === "wide" || now.kind === "wide" || was.width !== now.width) return Relayout.CLOSE_AND_ARRANGE;
  return was.output === now.output ? Relayout.KEEP : Relayout.ARRANGE;
}
