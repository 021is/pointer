# Pointer

Coding rules first: [021is/code-rules](https://github.com/021is/code-rules) (on 021-dev:
`~/projects/021-code-rules/PRINCIPLES.md`), then [AGENTS.md](AGENTS.md).

A Chrome extension for working on a frontend with a coding agent. Turn it on, draw on the page or
pick an element, press Copy, paste into the agent's chat. The agent gets a cropped picture with
numbered marks and a few lines saying **which file and line** wrote each marked element, so it
opens the right file without searching.

```
Pointer · https://live.danceclub.dev/ · viewport 1280×800 · react
image: 878×244 (≈286 tokens), numbers on it match [n] below
drawn: 1 box
[1] pick · HomePage ← Home
   file: src/feature/site/home/ui/HomePage.tsx:30
   el: h1.font-urbanist.text-6xl "Nobody dances alone." · 696×182
   style: font 96px/91.2px Urbanist 500 · color #f0f2f4
   note: bigger please
```

## Install (unpacked)

1. `npm ci && npm run build`. That builds `dist/`.
2. Get `dist/` onto the computer that runs Chrome. From VS Code Remote: right-click `dist` →
   Download. Or take the `pointer-dist` artifact from the PR's CI run.
3. `chrome://extensions` → Developer mode → Load unpacked → pick that `dist` folder.
4. Optional: `chrome://extensions/shortcuts` to change Alt+Shift+P.

After a rebuild, press reload on the extension's card and reload the page.

## Use

| Key | |
|---|---|
| Alt+Shift+P | on / off for this tab (the toolbar icon does the same) |
| P | pick: hover an element (the rest dims), ↑ parent, ↓ back down, ← → siblings, click or Enter picks, then a note |
| C | comment: click anywhere, type, Enter. Click any number to edit its note (a pick's also reopens its panel); drag a comment's number to move it |
| D A B E T | pen, arrow, box, ellipse, text. **Shift**: straight line, 45° arrow, square, circle |
| 1 2 3 | red, blue, yellow |
| V | use the page (clicks go through, marks stay) |
| I | always add the picture (it is added anyway when something is drawn) |
| Ctrl+Z, Ctrl+C | undo, Copy |
| Esc | back to the page tool; again to close |

### The style panel

Picking an element opens a panel at the top right (it floats; the page's width never changes).
It lists the CSS that reaches the element (its own rules, resets that hit every element left
out) and its classes. Click a value to change it, ↑/↓ nudge the first number (Shift ×10, Alt
×0.1), Enter applies; the checkbox turns a property off, × removes it, `+ add` takes
`gap: 12px`. A class chip's × removes the class; `+ class` adds one (marked "not built yet" when
the page's CSS has no rule for it, as with a Tailwind class the code never used). ⊕ before /
after puts a dashed placeholder next to the element: type its label right away. ↺ Reset puts the
element back. S collapses the panel; clicking a pick's number opens its panel again.

Edits are live, on that element only, and Copy adds them under `changed:`:

```
   changed: font-size 96px → 72px
            letter-spacing -2.4px → 2px
            removed class: font-urbanist
            inserted after it: placeholder "Map" (1088×48)
```

Undoing or clearing a pick undoes its edits. A reload of the page drops them too.

**What Copy sends:** text always. The picture only when something is drawn, when I is on, or
when nothing is marked (a plain screenshot). A pick with a note is text only, about 80 tokens.
The picture is cropped to the marks and kept at one pixel per CSS pixel, long edge ≤ 1000 px
(Claude prices an image at about w×h/750 tokens; a full Retina screenshot costs ~5,000).
With a picture, the same lines are also printed in a dark strip under it: Claude Code's chat
keeps only the image of a text + image paste, so one paste still carries the file:line, notes
and changes. A strip line costs about what the text would (~24 tokens).

## Where the file comes from

Only a **dev build** tells it. React 19 (`_debugStack` + the dev server's source maps,
Turbopack and webpack, server components too), React ≤ 18 (`_debugSource`), Vue 2/3
(`__file`), Svelte 4/5 (`__svelte_meta`). Angular gives the component's name only. A production
build gives selector, text, classes and styles; the bundle says why there is no file.

## Privacy

`activeTab` + `scripting` only: no access to any site until you press the icon or the shortcut
on that tab. Nothing leaves the browser except to your clipboard. The PNG is drawn on a canvas,
so it carries no metadata.

## Develop

`npm run watch` rebuilds `dist/` on save. `npm run check` is the whole gate: Biome, tsc, the
300-line rule, vitest, the build. Geometry, the bundle, colours, stacks and source maps are pure
and unit-tested; the DOM edge lives in `src/ui`, `src/pick`, `src/capture`.
