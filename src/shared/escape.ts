// Esc belongs to Pointer while it is open (Edvard, 2026-11-24: "sometimes when I escape it closes
// my sheet in my app instead of closing the pointer"), except with the Page tool, when the page has
// it (ui/keyboard.ts). The window's first look at every Esc, in the capture phase (ui/app.ts),
// keeps it from the page, so the page's own listeners never see it, and runs Pointer's own: the
// controls that close on Esc (the comment box, a style value, the icon picker, the draw menu) say
// so here instead of listening for it, since that look stops Esc before it reaches them.

const closers = new WeakMap<EventTarget, () => void>();

/** One of Pointer's own controls that Esc closes (or cancels), wherever focus is inside it. */
export function closesOnEscape(el: Element, close: () => void): void {
  closers.set(el, close);
}

/** What Esc does for the innermost of Pointer's own controls on an event's path, if any. */
export function escapeFor(path: readonly EventTarget[]): (() => void) | undefined {
  for (const node of path) {
    const close = closers.get(node);
    if (close) return close;
  }
  return undefined;
}
