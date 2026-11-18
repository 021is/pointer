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
.pimg { position: absolute; pointer-events: none; outline: 1px dashed rgba(124, 92, 255, 0.7); }
.pimg img { display: block; width: 100%; height: 100%; user-select: none; }
.pimg .grip {
  position: absolute; right: -5px; bottom: -5px; width: 12px; height: 12px; border-radius: 3px;
  background: #7c5cff; border: 2px solid #fff; cursor: nwse-resize;
}
.layer[data-tool="page"] .pimg, .layer[data-tool="pick"] .pimg { pointer-events: auto; cursor: move; }

.bar {
  position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 2px; padding: 5px;
  background: rgba(22, 20, 32, 0.94); color: #f4f2ff;
  border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font: 500 13px/1 system-ui, sans-serif; pointer-events: auto; user-select: none;
}
.bar .grip { width: 14px; height: 28px; cursor: grab; display: grid; place-items: center; opacity: .5; }
.bar .sep { width: 1px; height: 20px; background: rgba(255, 255, 255, 0.14); margin: 0 4px; }
.bar button {
  all: unset; height: 30px; min-width: 30px; padding: 0 7px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
  font: inherit; font-size: 15px; color: inherit; white-space: nowrap;
}
.bar button:hover { background: rgba(255, 255, 255, 0.1); }
.bar button:focus-visible { outline: 2px solid #9d85ff; outline-offset: 1px; }
.bar button[aria-pressed="true"] { background: #7c5cff; color: #fff; }
.bar button.copy { background: #f4f2ff; color: #16141f; font-size: 13px; font-weight: 650; padding: 0 12px; margin-left: 2px; }
.bar button.copy:hover { background: #fff; }
.bar .switch { display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px; background: rgba(255, 255, 255, 0.08); }
.bar .switch button { height: 26px; font-size: 12px; font-weight: 600; }
.bar .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .35); }
.bar button[aria-pressed="true"] .dot { border-color: #fff; }

.bubble {
  position: fixed; width: 280px; padding: 8px; pointer-events: auto;
  background: rgba(22, 20, 32, 0.96); border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font: 13px/1.4 system-ui, sans-serif; color: #f4f2ff;
}
.bubble textarea {
  all: unset; display: block; width: 100%; min-height: 38px; max-height: 160px; overflow: auto;
  white-space: pre-wrap; padding: 6px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.08);
  font: 14px/1.4 system-ui, sans-serif; color: #fff;
}
.bubble textarea:focus { outline: 2px solid #7c5cff; }
.bubble .hint { margin-top: 6px; font-size: 11px; opacity: 0.65; }

.toast {
  position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%); max-width: 90vw;
  padding: 8px 12px; border-radius: 8px; background: #16141f; color: #f4f2ff;
  border: 1px solid rgba(255, 255, 255, 0.14); font: 13px/1.4 system-ui, sans-serif;
  pointer-events: none; opacity: 0; transition: opacity .15s;
}
.toast[data-show] { opacity: 1; }
.toast[data-kind="error"] { background: #3a0f1c; border-color: #ff3366; }
`;
