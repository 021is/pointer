// The style panel's look, in Pointer's shadow root, matching the bar.

export const PANEL_CSS = `
.panel {
  position: fixed; top: 16px; right: 16px; width: 340px; max-height: min(72vh, 640px);
  display: flex; flex-direction: column; pointer-events: auto;
  background: rgba(22, 20, 32, 0.96); color: #f4f2ff;
  border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.4); font: 12px/1.4 system-ui, sans-serif;
}
.panel[hidden] { display: none; }
.panel header {
  display: flex; align-items: center; gap: 4px; padding: 8px 8px 8px 12px; cursor: grab;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1); user-select: none;
}
.panel header .title { flex: 1; font: 600 12px/1.3 ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.panel button {
  all: unset; cursor: pointer; padding: 3px 7px; border-radius: 6px; color: inherit; font: inherit;
}
.panel button:hover { background: rgba(255, 255, 255, 0.1); }
.panel button:focus-visible, .panel input:focus-visible { outline: 2px solid #9d85ff; }
.panel[data-collapsed] .body { display: none; }
.panel .body { overflow: auto; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px; }
.panel .file { font: 11px ui-monospace, monospace; opacity: 0.7; direction: rtl; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.panel .chips { display: flex; flex-wrap: wrap; gap: 4px; }
.panel .chip {
  display: inline-flex; align-items: center; gap: 2px; padding: 1px 2px 1px 7px; border-radius: 999px;
  background: rgba(124, 92, 255, 0.22); font: 11px ui-monospace, monospace;
}
.panel .chip button { padding: 0 5px; border-radius: 999px; }
.panel input {
  all: unset; box-sizing: border-box; font: 12px ui-monospace, monospace; color: #fff;
  padding: 3px 6px; border-radius: 5px; background: rgba(255, 255, 255, 0.07);
}
.panel input[type="checkbox"] { all: revert; margin: 0; accent-color: #7c5cff; }
.panel .add-class { width: 90px; }
.panel .rows { display: flex; flex-direction: column; gap: 2px; }
.panel .row { display: grid; grid-template-columns: 16px minmax(0, 1fr) minmax(0, 1.2fr) 8px 22px; align-items: center; gap: 6px; }
.panel .row .name { font: 12px ui-monospace, monospace; color: #c9bfff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.panel .row .val { width: 100%; background: transparent; }
.panel .row .val:hover, .panel .row .val:focus { background: rgba(255, 255, 255, 0.08); }
.panel .row .dot { width: 6px; height: 6px; border-radius: 50%; }
.panel .row[data-changed] .dot { background: #ffc400; }
.panel .row[data-changed] .val { color: #ffe08a; }
.panel .add-prop { width: 100%; }
.panel .foot { display: flex; gap: 4px; flex-wrap: wrap; }
.panel .foot button { background: rgba(255, 255, 255, 0.07); }
.panel .note { font-size: 11px; opacity: 0.6; }
.panel .note:empty, .panel .warning:empty { display: none; }
.panel .warning { font-size: 12px; color: #ff8fa8; }
`;
