# AGENTS.md: Pointer

Coding rules first: [021is/code-rules](https://github.com/021is/code-rules) (on 021-dev:
`~/projects/021-code-rules/PRINCIPLES.md`). This file holds only Pointer's own rules.

## What it is

A Chrome MV3 extension (TypeScript, esbuild, no framework). Born in flight TF146 (Edvard,
2026-11-18). What it does and how to use it: [README.md](README.md).

## Shape

| Folder | What |
|---|---|
| `src/background.ts` | service worker: icon/shortcut → inject; `captureVisibleTab` |
| `src/ui/` | the content script: shadow-rooted layer, toolbar, bubble, keys, state |
| `src/draw/`, `src/pick/`, `src/marks/` | drawing gestures, element picking, marks → SVG |
| `src/capture/` | screenshot, crop, compose, clipboard |
| `src/panel/` | the style panel: matched CSS, live edits on one element, their diff |
| `src/source/` | the page-world probe: framework, component chain, file:line via source maps |
| `src/bundle/` | the bundle's data and its text format, key styles, colours |
| `test/` | vitest, pure modules only |

## Rules of this repo

- **Least permissions:** `activeTab` + `scripting`, nothing else, no host permissions. A
  feature that needs more is a decision for Edvard, never a quiet manifest change.
- **Nothing leaves the browser** except to the clipboard. No network calls of our own, apart
  from the page-world probe reading the page's own dev server (chunks, source maps).
- **Two worlds:** `src/source/probe.ts` runs in the page's MAIN world (fibers are only visible
  there) and talks to the content script by `CustomEvent` with JSON strings only
  (`src/source/protocol.ts`). Nothing else runs in MAIN.
- **One renderer:** the live overlay and the copied picture both come from `marks/svg.ts`.
- **Tokens are a cost:** every bundle line earns its place; a pick without drawings is text only.
- **Images carry no metadata:** PNGs come from a canvas; never pass a source image through.
- Pure logic is tested; the DOM edge stays thin.

## Gate

`npm run check` locally (one pass, after writing), gitleaks before every push, a draft PR to
`main`; CI (`.github/workflows/check.yml`) runs the same gate plus gitleaks on 021's runner.
