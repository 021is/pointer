// The narrow row's cell widths as Chromium lays them out, copied from a recorded run of
// scripts/narrow-check.mjs (its line "row cell widths seen"), run ending 2026-11-24T11:13Z, headless
// Chromium 147.0.7727.0 (Playwright's chromium_headless_shell-1217), Linux, the demo app, on
// branch flight/TF183-split with the icons-only row. A new row style is recorded again by running
// the script and copying that line here.

/** Each row cell's width by its name (data-name), in CSS px. */
export const RECORDED: Readonly<Record<string, number>> = {
  Pick: 44,
  Comment: 44,
  Pen: 44,
  Undo: 44,
  Copy: 44,
  More: 44,
  Close: 44,
  Options: 24,
  Shapes: 24,
  Move: 44,
  Idea: 44,
  Redo: 44,
  Crop: 44,
  Icon: 44,
  Page: 44,
  Clear: 44,
  Image: 44,
  Styles: 44,
};

/** A part's name in the row (data-name), for the tests that speak in parts. */
export const NAME_OF: Readonly<Record<string, string>> = {
  pick: "Pick",
  comment: "Comment",
  draw: "Pen",
  drawCaret: "Shapes",
  undo: "Undo",
  copy: "Copy",
  copyCaret: "Options",
  move: "Move",
  idea: "Idea",
  redo: "Redo",
  crop: "Crop",
  icon: "Icon",
  page: "Page",
  clear: "Clear",
  image: "Image",
  styles: "Styles",
};
