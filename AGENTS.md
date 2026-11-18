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
| `src/background.ts` | service worker: icon/shortcut → inject; `captureVisibleTab`; the welcome page on install; the preview tab |
| `src/ui/` | the content script: shadow-rooted layer, toolbar, bubble, keys, state; `copy-flow.ts` (Copy, clear after copy, preview), `copy-menu.ts` (the split button), `move.ts` (the Move tool), `clear.ts` (Clear everything + Undo, the one way) |
| `src/draw/`, `src/pick/`, `src/marks/` | drawing gestures, element picking, marks → SVG |
| `src/capture/` | screenshot, crop, layout within the image budget, text strip, clipboard, cost estimate |
| `src/preview.ts`, `preview.html` | the preview page: what Copy would give, from the service worker |
| `pages.css`, `brand/` | the extension's pages in 021's look, and 021's logo, bundled (never fetched) |
| `src/panel/` | the style panel: matched CSS, live edits on one element, their diff |
| `src/paste/` | images pasted onto the page: landing, move/resize, see-through, until reload |
| `src/source/` | the page-world probe: framework, component chain, file:line via source maps |
| `src/bundle/` | the bundle's data and its text format, key styles, colours |
| `icons/`, `store/`, `welcome.html` | the icon (SVG master + PNGs), the store listing and tile, the first-run page |
| `test/` | vitest; pure modules, plus happy-dom for the DOM pieces |
| `demo/`, `scripts/screenshots.mjs` | a small fictional Vite + React app to try Pointer on, and the store screenshots taken on it |

## Rules

- **Least permissions:** `activeTab` + `scripting`, nothing else, no host permissions. A feature
  that would need more is discussed in an issue first, never a quiet manifest change.
- **Nothing leaves the browser** except to the clipboard. No network calls of our own, apart from
  the page-world probe reading the page's own dev server (chunks, source maps, same origin only).
  No analytics, no storage of what people mark.
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
