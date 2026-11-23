// Finding the element under the cursor (past Pointer's own layer) and walking the DOM with the
// arrow keys: ↑ parent, ↓ back down the way it came (or the first child), ← → siblings.

export type WalkKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export function elementAt(x: number, y: number, host: Element): Element | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el !== host && !host.contains(el)) return el;
  }
  return null;
}

/** The next element for an arrow key; `trail` remembers the way up so ↓ can retrace it. */
export function walk(el: Element, key: WalkKey, trail: Element[]): Element {
  switch (key) {
    case "ArrowUp": {
      const parent = el.parentElement;
      if (!parent || parent === document.documentElement) return el;
      trail.push(el);
      return parent;
    }
    case "ArrowDown": {
      const back = trail.pop();
      if (back && el.contains(back)) return back;
      trail.length = 0;
      return el.firstElementChild ?? el;
    }
    case "ArrowLeft":
      trail.length = 0;
      return el.previousElementSibling ?? el;
    case "ArrowRight":
      trail.length = 0;
      return el.nextElementSibling ?? el;
  }
}
