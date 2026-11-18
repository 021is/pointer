# Chrome Web Store listing: Pointer

What goes into each field of the Chrome Web Store developer dashboard. Publisher: **021**
(verified domain 021.is). Free. The publisher is a non-trader: nothing here offers, prices or sells.

## Store listing

- **Name** (from the manifest): Pointer by 021 — show your coding agent exactly what to change
- **Summary** (from the manifest, ≤ 132 characters): Pick an element, draw, crop, comment, then
  paste one picture + its source file:line into Claude Code, Cursor or any AI agent.
- **Category:** Developer Tools · **Language:** English
- **Homepage:** https://021.is/plugins/pointer · **Support:** https://github.com/021is/pointer/issues
- **Icon:** `icons/icon-128.png` · **Screenshots** (1280×800): `store/screenshot-*.png` ·
  **Small promo tile** (440×280): `store/tile-440x280.png`

### Description

Pointer turns "the thing on the left, a bit bigger, no, the other one" into one paste your coding
agent can act on.

Turn it on with Alt+Shift+P on the page you are building. Point at what you mean:

• Pick an element: everything else dims; the arrow keys walk to its parent or child.
• Comment anywhere: a numbered pin with your note.
• Crop a component or a frame, several at once, and draw on them: pen, arrow, box, ellipse, text,
  with Shift for straight lines and squares.
• Paste a screenshot or a mockup onto the page and lay it see-through over the real thing.
• Change CSS live in the style panel: font size, colour, spacing, classes; even drop in a
  placeholder where a new element should go. Pointer records what you changed.

Then Copy. Your agent gets one picture with the numbers you placed, and under it, for each
number, the component and the source file and line that wrote it (from your app's dev build: React,
Vue, Svelte), your note, and the CSS you changed, ready to turn into code. Or switch to Text and
copy only those lines: about three times cheaper when your words say enough.

Works with Claude Code, Cursor, Windsurf, ChatGPT and any chat you paste into.

Private by design: Pointer runs only on the tab where you turn it on. It sends nothing anywhere.
What you mark goes to your clipboard, and you decide where to paste it. Open source (MIT):
github.com/021is/pointer.

Made by Edvard Grei at 021.

## Privacy practices

- **Single purpose:** Mark elements on the page you are building and copy a picture and text
  that describe them, with their source file and line, to paste into a coding agent.
- **activeTab:** Pointer runs only on the tab where the user turns it on, by clicking its icon or
  pressing its shortcut, and only until they turn it off. No access to any other tab or site.
- **scripting:** On that user action, Pointer injects its overlay (the toolbar and the marks) into
  that tab, and a small script that reads the page's own development-build information (the
  component name, the source file and the line) of the elements the user marks.
- **Remote code:** No. All code ships in the extension package.
- **Data usage:** Pointer collects no user data, of any category. Nothing is sent to 021 or to
  anyone. The copy goes only to the user's clipboard. (Tick no data type. Certify all three
  statements: not sold, not used for unrelated purposes, not used for creditworthiness.)
- **Privacy policy:** https://021.is/plugins/pointer/privacy

## The facts the privacy page must say (021.is/plugins/pointer/privacy)

1. Pointer collects, stores and transmits no personal or usage data. No analytics, no accounts,
   no servers of its own.
2. It runs only on the tab where you turn it on (`activeTab`), and only until you turn it off.
3. What it reads there stays in your browser: the page's elements and styles you mark, a
   screenshot of the visible tab (`captureVisibleTab`) when you copy a picture, and, from your
   app's own development server, the source maps that turn a stack frame into a file and line
   (same origin only).
4. Copy writes to your clipboard; Pointer never pastes or sends it anywhere.
5. Images you paste onto a page stay in that tab until it reloads; nothing is saved.
6. Permissions: `activeTab` (the tab you turn it on), `scripting` (to draw the overlay there).
   No host permissions, no remote code.
7. Contact: the repository's issues, https://github.com/021is/pointer/issues.
