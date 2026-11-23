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
| `src/ui/` | the content script: shadow-rooted layer, toolbar, bubble, keys, state; `copy-flow.ts` (Copy, clear after copy, preview), `copy-menu.ts` (the split button), `move.ts` (the Move tool), `history.ts` (Undo, Redo, Clear everything: the one way), `styles.ts` (the Styles button: every press opens, closes or says why) |
| `src/draw/`, `src/pick/`, `src/marks/` | drawing gestures, element picking, marks → SVG |
| `src/keep/` | marks kept through a reload: `saved.ts` (marks ↔ plain data, pure; icons by Lucide name only), `check.ts` (every kept mark checked field by field), `keep.ts` (the content script's side), `store.ts` (the worker's `chrome.storage.session`) |
| `src/capture/` | screenshot, crop, layout within the image budget, text strip, clipboard, cost estimate |
| `src/preview.ts`, `preview.html` | the preview page: what Copy would give, from the service worker |
| `pages.css`, `brand/` | the extension's pages in 021's look, and 021's logo, bundled (never fetched) |
| `src/panel/` | the style panel: matched CSS, live edits on one element, their diff |
| `src/icons/` | the Icon tool: click a spot, a picker opens there (five quick icons, More searches the rest); Lucide (lucide-static, pinned to the version DanceClub web and 021.is use) built into `dist/lucide.js`, injected by the worker only when the picker opens; place, move, resize. Notices: `THIRD-PARTY-NOTICES.md` |
| `src/screen/` | the Screen tool (Full, Tablet, Mobile, Custom): `sizes.ts` (pure: sizes, the custom size's check, where the frame sits), `surface.ts` (the page being marked: the tab's or the framed copy's; every gesture maps through it), `stage.ts` (the same URL in a sandboxed same-origin iframe, its device frame, refused pages), `sheets.ts` (each page keeps its own marks), `menu.ts` (the bar's one button), `screen.ts` (the controller), `store.ts` (the custom size in `chrome.storage.local`), `worker.ts` (the probe into the frame) |
| `src/paste/` | images pasted onto the page: landing, move/resize, see-through; kept through a reload with the marks (`src/keep/`) |
| `src/source/` | the page-world probe: framework, component chain, file:line via source maps |
| `src/bundle/` | the bundle's data and its text format, key styles, colours |
| `icons/`, `store/`, `welcome.html` | the icon (SVG master + PNGs), the store listing and tile, the first-run page |
| `test/` | vitest; pure modules, plus happy-dom for the DOM pieces |
| `demo/`, `scripts/screenshots.mjs` | a small fictional Vite + React app to try Pointer on, and the store screenshots taken on it |

## Rules

- **Least permissions:** `activeTab` + `scripting` + `storage`, nothing else, no host
  permissions. A feature that would need more is discussed in an issue first, never a quiet
  manifest change. `storage` is for marks kept through a reload (Edvard, 2026-11-19, TF153), in
  `chrome.storage.session`, and for one setting, the Screen tool's custom size (Edvard,
  2026-11-23, TF177), in `chrome.storage.local` (`src/screen/store.ts`: two numbers, checked when
  read back). Nothing else in `local`, nothing ever in `sync`.
- **Nothing leaves the browser** except to the clipboard. No network calls of our own, apart from
  the page-world probe reading the page's own dev server (chunks, source maps, same origin only).
  No analytics. What people mark is kept only in session memory, per tab and page (`src/keep/`),
  and forgotten on Clear, on closing Pointer, when the tab closes and when Chrome closes. A
  framed screen's marks live in memory with their frame only.
- **Two worlds:** `src/source/probe.ts` runs in the page's MAIN world (fibers are only visible
  there) and talks to the content script by `CustomEvent` with JSON strings only
  (`src/source/protocol.ts`), checked where they enter. Nothing else runs in MAIN. On a framed
  screen the probe runs in the frame's MAIN world too (`src/screen/worker.ts`).
- **Two pages:** on a framed screen the marked page is the frame's, of its own realm. Read the
  page through `src/screen/surface.ts` (never `scrollX`, `innerWidth`, `document` for the page);
  an element's own `ownerDocument` and window answer for it; never `instanceof HTMLElement` or
  `CSSStyleRule` on the page's objects (they are the frame's), ask the object or its own window.
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
