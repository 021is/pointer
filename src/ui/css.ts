// Pointer's own styles, inside its shadow root: the page's CSS never reaches them and they never
// reach the page. Dark glass over any page, violet as the one accent.

export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer { position: fixed; inset: 0; pointer-events: auto; }
.layer[data-tool="page"] { pointer-events: none; }
.layer[data-tool="pick"], .layer[data-tool="comment"] { cursor: crosshair; }
.layer[data-tool="text"] { cursor: text; }
.layer[data-tool="pen"], .layer[data-tool="arrow"], .layer[data-tool="box"], .layer[data-tool="ellipse"] { cursor: crosshair; }
.layer svg { position: absolute; inset: 0; overflow: visible; pointer-events: none; }

/* Pasted images: under the marks. They take the mouse with the page and pick tools (move,
   resize); with drawing tools the layer draws over them. */
.pasted { position: absolute; inset: 0; pointer-events: none; }
.pasted .catcher { position: fixed; left: -9999px; top: 0; width: 1px; height: 1px; opacity: 0; }
.pimg { position: absolute; pointer-events: none; outline: 1px dashed rgba(124, 92, 255, 0.7); }
.pimg img { display: block; width: 100%; height: 100%; user-select: none; }
.pimg .grip {
  position: absolute; right: -5px; bottom: -5px; width: 12px; height: 12px; border-radius: 3px;
  background: #7c5cff; border: 2px solid #fff; cursor: nwse-resize;
}
.layer[data-tool="page"] .pimg, .layer[data-tool="pick"] .pimg, .layer[data-tool="move"] .pimg { pointer-events: auto; cursor: move; }
.layer[data-tool="move"] { cursor: grab; }
.pimg:hover .grip { width: 16px; height: 16px; right: -7px; bottom: -7px; box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.35); }

/* The bar: frosted dark glass, one violet accent, quiet until hovered. */
.bar {
  position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 4px; padding: 6px;
  background: linear-gradient(180deg, rgba(34, 30, 50, 0.86), rgba(18, 16, 28, 0.9));
  -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
  color: #ece9fb; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px;
  box-shadow: 0 18px 50px rgba(5, 3, 15, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.07);
  font: 600 12.5px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: 0.01em; pointer-events: auto; user-select: none;
}
.bar .group { display: inline-flex; align-items: center; gap: 1px; padding: 0 5px; position: relative; }
.bar .group + .group::before, .bar .group + .switch::before {
  content: ""; position: absolute; left: -3px; top: 7px; bottom: 7px; width: 1px; background: rgba(255, 255, 255, 0.1);
}
.bar[data-output="text"] [data-only="picture"] { display: none; }
.bar .grip {
  position: relative; width: 30px; height: 32px; display: grid; place-items: center; cursor: grab; color: #b9a8ff;
  border-radius: 10px; transition: color .15s, background .15s;
}
.bar .grip:hover { color: #fff; background: rgba(124, 92, 255, 0.18); }
.bar .grip:active { cursor: grabbing; }
.bar .icon { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.bar button {
  all: unset; position: relative; height: 34px; min-width: 34px; padding: 0; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer;
  font: inherit; color: #c9c3e6; white-space: nowrap; transition: background .15s, color .15s, box-shadow .15s, transform .08s;
}
.bar button:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.bar button:active { transform: translateY(1px); }
.bar button:focus-visible { outline: 2px solid #9d85ff; outline-offset: 1px; }
.bar button[aria-pressed="true"] {
  color: #fff; background: linear-gradient(180deg, #8a6dff, #6a4cf0);
  box-shadow: 0 0 0 1px rgba(173, 152, 255, 0.55), 0 6px 18px rgba(106, 76, 240, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.bar button.swatch { min-width: 28px; padding: 0; }
.bar button.swatch::after {
  content: ""; width: 14px; height: 14px; border-radius: 50%; background: var(--swatch);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25); transition: transform .15s, box-shadow .15s;
}
.bar button.swatch[aria-pressed="true"] { background: none; box-shadow: none; }
.bar button.swatch[aria-pressed="true"]::after { transform: scale(1.15); box-shadow: 0 0 0 2px #17142a, 0 0 0 4px var(--swatch); }
/* Copy: a split button. The main part copies as chosen; ▾ opens the menu above it. */
.bar .copygroup { position: relative; display: inline-flex; margin-left: 6px; border-radius: 10px;
  box-shadow: 0 6px 20px rgba(157, 133, 255, 0.35); }
.bar .copygroup button.copy, .bar .copygroup button.caret { color: #160f33; font-weight: 700;
  background: linear-gradient(180deg, #ffffff, #e4ddff); box-shadow: inset 0 -1px 0 rgba(106, 76, 240, 0.25); }
.bar .copygroup button.copy { padding: 0 12px 0 11px; border-radius: 10px 0 0 10px; }
.bar .copygroup button.caret { min-width: 28px; border-radius: 0 10px 10px 0; border-left: 1px solid rgba(106, 76, 240, 0.25); }
/* Only Copy and ▾ themselves: the menu's items are buttons too and keep their light text. */
.bar .copygroup > button:hover { color: #160f33; background: linear-gradient(180deg, #ffffff, #d6cbff); }
.bar .menu .item:hover { color: #fff; }
.bar .menu .why { margin: 4px 10px; color: #ff8fa8; font: 500 11.5px/1.4 ui-sans-serif, system-ui, sans-serif; white-space: normal; }
.bar .menu .why[hidden] { display: none; }
.bar .copy .mode { font-weight: 600; color: #5b4fa0; }
.bar .copy.flash { background: linear-gradient(180deg, #e9fff3, #c9f5dc); color: #0b3d22; }
.bar .copygroup .menu {
  position: absolute; right: 0; bottom: calc(100% + 10px); width: 270px; padding: 6px; z-index: 2;
  background: #120f1d; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
  box-shadow: 0 18px 44px rgba(5, 3, 15, 0.6); color: #ece9fb;
}
.bar .copygroup .menu[hidden] { display: none; }
.bar .menu .item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%;
  height: 34px; padding: 0 10px; border-radius: 8px; cursor: pointer; font: 600 12.5px/1 ui-sans-serif, system-ui, sans-serif; }
.bar .menu .item:hover { background: rgba(255, 255, 255, 0.07); }
.bar .menu .name { flex: 1; }
.bar .menu .cost { color: #9d95c4; font: 600 11.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.bar .menu .dot, .bar .menu .box { width: 14px; height: 14px; flex: none; border: 1.5px solid rgba(255, 255, 255, 0.35); }
.bar .menu .dot { border-radius: 50%; } .bar .menu .box { border-radius: 4px; }
.bar .menu .dot.ghost { border-style: dashed; }
.bar .menu .item[aria-checked="true"] .dot { border: 4px solid #8a6dff; }
.bar .menu .item[aria-checked="true"] .box { background: #8a6dff; border-color: #8a6dff; box-shadow: inset 0 0 0 2px #120f1d; }
.bar .menu .rule { height: 1px; margin: 6px 4px; background: rgba(255, 255, 255, 0.08); }
.bar .copygroup:has(.menu:not([hidden])) [data-tip]:hover::before { display: none; }
.bar button.close { min-width: 30px; color: #8f88ad; }
.bar button.close:hover { color: #fff; background: rgba(255, 51, 102, 0.22); }
/* Tooltips: the name and the key, above the button. */
.bar [data-tip]:hover::before {
  content: attr(data-tip); position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%);
  padding: 6px 9px; border-radius: 8px; white-space: pre; pointer-events: none;
  background: #0d0b16; color: #f1eeff; font: 600 11.5px/1 ui-sans-serif, system-ui, sans-serif;
  border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

/* The note box: the bar's glass. all: unset also resets box-sizing, so it is set again: without
   it the field's padding pushed it past the box's right edge. */
.bubble {
  position: fixed; width: 300px; padding: 10px; pointer-events: auto;
  background: linear-gradient(180deg, rgba(34, 30, 50, 0.92), rgba(18, 16, 28, 0.95));
  -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px;
  box-shadow: 0 18px 44px rgba(5, 3, 15, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif; color: #ece9fb;
}
.bubble textarea {
  all: unset; box-sizing: border-box; display: block; width: 100%; min-height: 44px; max-height: 160px;
  overflow: auto; white-space: pre-wrap; padding: 9px 11px; border-radius: 10px;
  background: rgba(0, 0, 0, 0.28); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, sans-serif; color: #fff; caret-color: #9d85ff;
}
.bubble textarea::placeholder { color: rgba(236, 233, 251, 0.45); }
.bubble textarea:focus { box-shadow: inset 0 0 0 1.5px #8a6dff, 0 0 0 3px rgba(124, 92, 255, 0.22); }
.bubble .hint { margin: 8px 2px 0; font-size: 11.5px; color: rgba(236, 233, 251, 0.55); }

/* Messages sit at the top of the view, never over the bar or its tooltips. */
.toast {
  position: fixed; left: 50%; top: 18px; transform: translate(-50%, -6px); max-width: min(560px, 90vw);
  display: flex; align-items: center; gap: 12px; padding: 9px 12px 9px 14px; border-radius: 12px;
  background: rgba(18, 16, 28, 0.94); color: #f1eeff; border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 14px 36px rgba(5, 3, 15, 0.45); font: 600 13px/1.4 ui-sans-serif, system-ui, sans-serif;
  pointer-events: none; opacity: 0; transition: opacity .15s, transform .15s;
}
.toast[data-show] { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.toast[data-kind="error"] { background: #3a0f1c; border-color: #ff3366; }
.toast button { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.12); font-weight: 700; }
.toast button:hover { background: rgba(255, 255, 255, 0.2); }
@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
`;
