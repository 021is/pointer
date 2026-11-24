# AGENTS.md: Pointer

Coding rules: 021is/code-rules (PRINCIPLES, then ts/), then this file. That repo is 021's
internal one; the rules this repo keeps stand on their own below, so outside contributors need
nothing more.

For people and coding agents working on Pointer. What it does and how to use it:
[README.md](README.md). This file is how the code is laid out and the rules it keeps.

## What it is

A Chrome Manifest V3 extension in TypeScript, bundled by esbuild, with no UI framework. The
overlay lives in a shadow root on the page; a small probe runs in the page's own world to read
dev-build information (React fibers, Vue and Svelte metadata, source maps).

## Shape

| Folder | What |
|---|---|
| `src/background.ts` | service worker: icon/shortcut → inject; `captureVisibleTab`; the welcome page on install (and on an update that left no shortcut); the preview tab |
| `src/welcome.ts`, `src/shared/shortcut.ts` | the welcome page names the key Chrome really bound, or offers to set one |
| `src/ui/` | the content script: shadow-rooted layer, toolbar, bubble, keys, state; `copy-flow.ts` (Copy, clear after copy, preview), `copy-menu.ts` (the split button), `move.ts` (the Move tool), `history.ts` (Undo, Redo, Clear everything: the one way), `styles.ts` (the Styles button: every press opens, closes or says why), `keyboard.ts` (the keyboard edge on the window's capture phase; Esc is Pointer's while it is open, except with the Page tool and nothing of Pointer's open, keyup too; Pointer's own controls that close on Esc register in `src/shared/escape.ts`), `compact.ts` (the bar under 768 px, as in DevTools' device mode: centred, as wide as its tools, icons only, names in aria-labels and hover tips; More, which says Close while the sheet is open; the sheet's close paths; touch works everywhere, the layer is `touch-action: none`), `layout.ts` (moves the same buttons between the wide groups and the narrow row and sheet, never copies them; measures each row cell as laid out), `fit.ts` (pure: takes those measured widths and the seen width and says which tools the row keeps, Copy and More always, the others in priority order; and when to lay it out again), `sheet.ts` (the tool sheet: what the row has no room for, in Mark, Edit and Send, each named, Exit by its handle, at most 45% of the height; the one list of split buttons), `narrow-css.ts` (their CSS: 44 px icon squares, one even gap, a split button's ▾ a narrow segment against its tool, Copy one teal pill) |
| `src/draw/`, `src/pick/`, `src/marks/` | drawing gestures, element picking, marks → SVG |
| `src/keep/` | marks kept through a reload: `saved.ts` (marks ↔ plain data, pure; icons by Lucide name only), `check.ts` (every kept mark checked field by field), `keep.ts` (the content script's side), `store.ts` (the worker's `chrome.storage.session`) |
| `src/capture/` | screenshot, crop, layout within the image budget, text strip, clipboard, cost estimate; `sweep.ts` (pure: where to scroll for crops out of view, near ones together, far ones one at a time, and what to say when one is not wholly in), `shots.ts` (scrolls there, captures, puts every scroll back exactly); the worker paces captures within Chrome's two a second (`src/shared/pace.ts`) |
| `src/preview.ts`, `preview.html` | the preview page: what Copy would give, from the service worker |
| `pages.css`, `brand/` | the extension's pages in 021's look, and 021's logo, bundled (never fetched) |
| `src/panel/` | the style panel: matched CSS, live edits on one element, their diff |
| `src/icons/` | the icon picker: Lucide (lucide-static, pinned to the version DanceClub web and 021.is use) built into `dist/lucide.js`, injected by the worker only when the picker opens; search, place, move, resize. Notices: `THIRD-PARTY-NOTICES.md` |
| `src/paste/` | images pasted onto the page: landing, move/resize, see-through; kept through a reload with the marks (`src/keep/`) |
| `src/source/` | the page-world probe: framework, component chain, file:line via source maps |
| `src/bundle/` | the bundle's data and its text format, key styles, colours |
| `icons/`, `store/`, `welcome.html` | the icon (SVG master + PNGs), the store listing and tile, the first-run page |
| `test/` | vitest; pure modules, plus happy-dom for the DOM pieces |
| `demo/`, `scripts/screenshots.mjs`, `scripts/narrow-check.mjs` | a small fictional Vite + React app to try Pointer on, the store screenshots taken on it, and the narrow bar checked on it in Chromium's device mode at 8 phone and tablet sizes (CI runs it; `test/recorded-widths.ts` copies its measured widths) |

## Rules

- **Least permissions:** `activeTab` + `scripting` + `storage`, nothing else, no host
  permissions. A feature that would need more is discussed in an issue first, never a quiet
  manifest change. `storage` is for marks kept through a reload (Edvard, 2026-11-19, TF153):
  `chrome.storage.session` only, never `local` or `sync`.
- **Nothing leaves the browser** except to the clipboard. No network calls of our own, apart from
  the page-world probe reading the page's own dev server (chunks, source maps, same origin only).
  No analytics. What people mark is kept only in session memory, per tab and page (`src/keep/`),
  and forgotten on Clear, on closing Pointer, when the tab closes and when Chrome closes.
- **Two worlds:** `src/source/probe.ts` runs in the page's MAIN world (fibers are only visible
  there) and talks to the content script by `CustomEvent` with JSON strings only
  (`src/source/protocol.ts`), checked where they enter. Nothing else runs in MAIN.
- **One renderer:** the live overlay and the copied picture both come from `marks/svg.ts`.
- **Tokens are a cost:** every bundle line earns its place; the picture stays within what Claude
  reads at full size (`capture/layout.ts`), and the frames shrink before the text does.
- **Images carry no metadata:** PNGs come from a canvas or from `scripts/icons.sh`, checked by
  `scripts/png-chunks.mjs`; never pass a source image through.
- **Small pieces:** 300 lines a file at most (`npm run lines`), feature folders, pure logic
  tested, the DOM edge thin. Never fail silently: a failure says why, in the toast or the bundle.

## Gate

`npm run check` is the whole local gate: Biome, tsc, the 300-line rule, vitest, the build. Run
gitleaks before you push. Open a pull request to `main`; CI (`.github/workflows/check.yml`) runs
the same gate plus gitleaks over the tree and history, and builds the store zip.
