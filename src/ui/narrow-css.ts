// The bar on a narrow viewport (a phone or a small tablet in DevTools' device mode, a narrow
// window): compact.ts, fit.ts, sheet.ts. A row docked to the bottom edge, centred and as wide as
// its tools; above it, while More is open, the tool sheet: at most 45% of the seen height, three
// named groups of 48 px cells, each named under its icon (the sheet has the room). One "selected"
// look, the current tool's violet; Picture | Text and Styles show their state quietly.
// Edvard, 2026-11-24, in Chrome on a Mac, last round: the row is icons only, every cell a 44 px
// square with one even gap, each name in its aria-label and, for a mouse, in a tooltip; a split
// button (Pen ▾, Copy ▾) is one control, its ▾ a narrow segment behind a hairline; Copy is the one
// strong action: a calm teal pill the shape of the other cells, never the tool's violet.

import { NARROW } from "./compact";
import { BAR_MARGIN, BAR_PAD, GAP } from "./fit";

/** A row cell: a square icon button, a 44 px target. */
export const CELL = 44;
/** A split button's ▾: narrower than its tool, as tall as it. */
export const CARET = 24;
/** Copy's pill and its hover: teal, apart from the selected tool's violet; the white icon on it is
 *  4.2:1 (on the hover 3.3:1), and the pill on the bar's darkest glass (#12101c) about 4.5:1
 *  (test/compact.test.ts computes all three). */
export const COPY_FILL = "#0f8b7d";
export const COPY_HOVER = "#12a090";
/** A sheet cell's least width. */
const SHEET_CELL = 48;

/** A sheet cell's name under its icon; no extra letter spacing. */
const LABEL = "content: attr(data-name); font: 600 10.5px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0;";

export const NARROW_CSS = `
.bar .more-toggle { display: none; }
@media (hover: none) { .bar [data-tip]:hover::before { display: none; } }
@media ${NARROW} {
  /* The row, laid out in the seen part (shared/view.ts): a page wider than the phone widens the layout. */
  .bar { left: calc(var(--view-left, 0px) + var(--view-width, 100vw) / 2); right: auto; width: max-content;
    max-width: calc(var(--view-width, 100vw) - ${2 * BAR_MARGIN}px); top: calc(var(--view-top, 0px) + var(--view-height, 100vh) - 6px);
    bottom: auto; transform: translate(-50%, -100%); flex-wrap: nowrap; justify-content: center; gap: ${GAP}px; padding: 4px ${BAR_PAD}px;
    border-radius: 16px; touch-action: manipulation; }
  /* Each cell keeps its own width: fit.ts measures them and lets only what fits into the row (the
     buttons' own rules set it again below: their all: unset outranks this one). */
  .bar > * { flex: none; }
  .bar .group, .bar .switch { padding: 0; margin: 0; gap: 0; }
  .bar .group + .group::before, .bar .group + .switch::before { display: none; }
  .bar .more-toggle { display: inline-flex; }
  /* A cell: its icon only, centred in a 44 px square. */
  .bar > button, .bar > .drawgroup > button.draw, .bar > .copygroup > button.copy {
    box-sizing: border-box; width: ${CELL}px; min-width: ${CELL}px; height: ${CELL}px; padding: 0; gap: 0; flex: none; }
  .bar > button .icon, .bar > .drawgroup > button .icon, .bar > .copygroup > button .icon { width: 20px; height: 20px; }
  .bar > .copygroup > button.copy .label, .bar .copy .mode { display: none; }
  /* A name for a mouse: the tooltip above its cell, kept on the screen at the row's ends. */
  .bar .sheet [data-tip]:hover::before { display: none; }
  .bar [data-tip]:hover::before { max-width: 220px; white-space: normal; text-align: center; line-height: 1.3; }
  .bar > :first-child[data-tip]:hover::before, .bar > :first-child [data-tip]:hover::before { left: 0; transform: none; }
  .bar > .more-toggle[data-tip]:hover::before, .bar > .copygroup [data-tip]:hover::before { left: auto; right: 0; transform: none; }
  /* A split button: one control, its ▾ a narrow segment as tall as its tool, a hairline between. */
  .bar > .drawgroup > button.caret, .bar > .copygroup > button.caret {
    box-sizing: border-box; width: ${CARET}px; min-width: ${CARET}px; height: ${CELL}px; padding: 0; flex: none; font-size: 10px; }
  .bar > .drawgroup:has(> .caret), .bar > .copygroup:has(> .caret) { border-radius: 10px; }
  .bar > .drawgroup:has(> .caret) > button.draw, .bar > .copygroup:has(> .caret) > button.copy { border-radius: 10px 0 0 10px; }
  .bar > .drawgroup > button.caret, .bar > .copygroup > button.caret { border-radius: 0 10px 10px 0; }
  .bar > .drawgroup:not(:has(> .caret)) > button.draw, .bar > .copygroup:not(:has(> .caret)) > button.copy { border-radius: 10px; }
  /* Pen ▾: quiet, one faint shape. */
  .bar > .drawgroup:has(> .caret) { background: rgba(255, 255, 255, 0.05); }
  .bar > .drawgroup > button.caret { border-left: 1px solid rgba(255, 255, 255, 0.12); color: #9d95c4; }
  /* Copy ▾: the one strong action, one teal pill, a white icon, its ▾ behind a white hairline. */
  .bar .copygroup { margin-left: 0; }
  .bar > .copygroup > button.copy, .bar > .copygroup > button.caret {
    color: #fff; background: ${COPY_FILL}; box-shadow: none; font-weight: 700; }
  .bar > .copygroup > button.caret { border-left: 1px solid rgba(255, 255, 255, 0.35); }
  .bar > .copygroup > button.copy:hover, .bar > .copygroup > button.caret:hover { color: #fff; background: ${COPY_HOVER}; }
  .bar > .copygroup > button.copy.flash { color: #0b3d22; background: #c9f5dc; }
  .bar .drawgroup, .bar .copygroup { position: static; }
  .bar .drawmenu, .bar .copygroup .menu { left: 0; right: 0; width: auto; max-width: 360px; margin: 0 auto; bottom: calc(100% + 8px); }
  .bar .menu .item { height: 44px; }
  .bar button[data-state][aria-pressed="true"] { color: #fff; background: rgba(255, 255, 255, 0.16); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2); }

  /* The sheet: above the row, centred on it, the page still seen above. A drag down anywhere but
     a button closes it (compact.ts); Mark and Edit scroll inside it only when a short screen needs
     that, Send stays at the bottom. */
  .bar .sheet { position: absolute; left: 50%; bottom: calc(100% + 8px); width: min(calc(var(--view-width, 100vw) - 12px), 480px);
    max-height: calc(var(--view-height, 100vh) * 0.45); display: flex; flex-direction: column; gap: 4px; padding: 0 4px 6px;
    border-radius: 18px; transform: translate(-50%, var(--drag, 0px)); transition: transform .18s ease-out; touch-action: none;
    animation: sheet-rise .16s ease-out;
    /* Opaque: a blur inside the bar's own blurs nothing, and the page must not show through the words. */
    background: linear-gradient(180deg, #242035, #14121f); border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 18px 50px rgba(5, 3, 15, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.07); }
  .bar:not([data-more="open"]) .sheet { display: none; }
  .bar[data-dragging] .sheet { transition: none; }
  .bar .sheet-head { position: relative; flex: none; height: 30px; cursor: grab; }
  .bar .sheet-head .handle { position: absolute; left: 50%; top: 9px; width: 40px; height: 5px; margin-left: -20px;
    border-radius: 3px; background: rgba(255, 255, 255, 0.32); }
  /* Exit, beside the handle: Pointer away; muted, red on hover as on the wide bar. */
  .bar .sheet-head button.close { position: absolute; right: 0; top: 0; z-index: 1; height: 44px; padding: 0 12px 0 10px; color: #a9a3c8; }
  .bar .sheet-head button.close::after { ${LABEL} }
  .bar .sheet-body { display: flex; flex-direction: column; gap: 6px; min-height: 0; flex: 0 1 auto; overflow-y: auto;
    overscroll-behavior: contain; touch-action: pan-y; }
  .bar .sheet-group { display: flex; flex-direction: column; gap: 2px; flex: none; }
  .bar .sheet-group[hidden] { display: none; }
  .bar .sheet-title { padding: 0 8px; color: rgba(236, 233, 251, 0.66); font: 700 10.5px/14px ui-sans-serif, system-ui, sans-serif;
    letter-spacing: 0.08em; text-transform: uppercase; }
  .bar .sheet .cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(${SHEET_CELL}px, 1fr)); }
  .bar .sheet .cells button { height: 48px; min-width: 44px; flex-direction: column; gap: 3px; }
  .bar .sheet .cells button[data-name]:not(.swatch):not(:has(.label))::after { ${LABEL} }
  /* A menu's ▾ on its own: ▾ as its icon, its name under it. */
  .bar .sheet .cells > button.caret { border-radius: 10px; color: #c9c3e6; }
  .bar .sheet .cells > button.caret .label { display: grid; place-items: center; width: 18px; height: 18px; font-size: 15px; line-height: 1; }
  .bar .sheet .cells > button.caret::after { ${LABEL} }
  .bar .sheet .drawgroup, .bar .sheet .copygroup { display: flex; }
  /* The colours: small swatches, only while Pen or Icon is the tool (toolbar.ts). */
  .bar .sheet .colors { display: grid; grid-template-columns: repeat(3, minmax(44px, 1fr)); grid-column: span 3; }
  .bar .sheet button.swatch { height: 44px; }
  .bar .sheet button.swatch::after { width: 18px; height: 18px; }
  .bar[data-colors="hidden"] .colors { display: none !important; }
  /* Send: Picture | Text quiet beside Copy's options. */
  .bar .sheet [data-group="send"] .cells { display: flex; align-items: center; gap: 6px; }
  .bar .sheet .switch { padding: 2px; }
  .bar .sheet .switch button { min-width: 52px; height: 44px; padding: 0 6px; font-size: 10.5px; }
  .bar .sheet .switch button[aria-pressed="true"] { color: #fff; background: rgba(255, 255, 255, 0.16); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2); }
  .bar .sheet [data-group="send"] .cells > button.caret { width: ${SHEET_CELL + 16}px; }

  /* The icon picker: a sheet just above the bar, the spot still marked by its ring. */
  .iconpicker { left: calc(var(--view-left, 0px) + 8px) !important; right: auto !important; bottom: auto !important;
    top: calc(var(--view-top, 0px) + var(--view-height, 100vh) - 68px) !important; transform: translateY(-100%);
    width: calc(var(--view-width, 100vw) - 16px); max-width: none; }
  .iconpicker .more { width: auto; }
  .iconpicker .grid { max-height: calc(var(--view-height, 100vh) * 0.3); }
  .iconpicker .quick { flex-wrap: wrap; }
  .iconpicker .icon-result, .iconpicker .more-button { width: 44px; height: 44px; }
  .iconpicker .more-button { width: auto; }
}
@keyframes sheet-rise { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .bar .sheet { transition: none; animation: none; } }
`;
