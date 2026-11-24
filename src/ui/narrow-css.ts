// The bar on a narrow viewport (a phone or a small tablet in DevTools' device mode, a narrow
// window): compact.ts, fit.ts, sheet.ts. A row docked to the bottom edge, centred and as wide as
// its tools, each named under its icon; above it, while More is open, the tool sheet: at most 45%
// of the seen height, three named groups of 48 px cells. One "selected" look, the current tool's
// violet; Picture | Text and Styles show their state quietly; Copy is the one strong button.

import { NARROW } from "./compact";
import { CARET, CELL } from "./fit";

/** A cell's name under its icon; no extra letter spacing, so "Comment" fits a 48 px cell. */
const LABEL = "content: attr(data-name); font: 600 10.5px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0;";

export const NARROW_CSS = `
.bar .more-toggle { display: none; }
@media (hover: none) { .bar [data-tip]:hover::before { display: none; } }
@media ${NARROW} {
  /* The row, laid out in the seen part (shared/view.ts): a page wider than the phone widens the layout. */
  .bar { left: calc(var(--view-left, 0px) + var(--view-width, 100vw) / 2); right: auto; width: max-content;
    max-width: calc(var(--view-width, 100vw) - 12px); top: calc(var(--view-top, 0px) + var(--view-height, 100vh) - 6px);
    bottom: auto; transform: translate(-50%, -100%); flex-wrap: nowrap; justify-content: center; gap: 0; padding: 4px;
    border-radius: 16px; touch-action: manipulation; }
  .bar [data-tip]:hover::before { display: none; }
  .bar .group, .bar .switch { padding: 0; margin: 0; gap: 0; }
  .bar .group + .group::before, .bar .group + .switch::before { display: none; }
  .bar .more-toggle { display: inline-flex; }
  /* A cell: the icon, its name under it. */
  .bar > button, .bar > .drawgroup > button.draw, .bar > .copygroup > button.copy {
    width: ${CELL}px; min-width: ${CELL}px; height: 56px; padding: 0; flex-direction: column; gap: 4px; }
  .bar > button::after, .bar > .drawgroup > button.draw::after { ${LABEL} }
  .bar > .drawgroup > button.caret, .bar > .copygroup > button.caret { width: ${CARET}px; min-width: ${CARET}px; height: 56px; }
  /* Pen and its ▾ read as one cell of two targets. */
  .bar > .drawgroup:has(> .caret) { border-radius: 10px; background: rgba(255, 255, 255, 0.05); }
  .bar .copygroup { margin-left: 0; }
  .bar .copygroup button.copy .label { font: 700 10.5px/1 ui-sans-serif, system-ui, sans-serif; }
  .bar > .copygroup:not(:has(> .caret)) > button.copy { border-radius: 10px; }
  .bar .copy .mode { display: none; }
  .bar .drawgroup:not(:has(> .caret)) > button.draw { border-radius: 10px; }
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
  .bar .sheet .cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(${CELL}px, 1fr)); }
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
  .bar .sheet [data-group="send"] .cells > button.caret { width: ${CELL + 16}px; }

  /* The icon picker: a sheet just above the bar, the spot still marked by its ring. */
  .iconpicker { left: calc(var(--view-left, 0px) + 8px) !important; right: auto !important; bottom: auto !important;
    top: calc(var(--view-top, 0px) + var(--view-height, 100vh) - 80px) !important; transform: translateY(-100%);
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
