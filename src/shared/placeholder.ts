// The placeholder boxes the style panel inserts into the page (⊕ before / after). They belong
// to Pointer: a click on one edits its label instead of picking it.

export const PLACEHOLDER_ATTR = "data-pointer-placeholder";

export function placeholderAt(el: Element | null): HTMLElement | null {
  return el?.closest<HTMLElement>(`[${PLACEHOLDER_ATTR}]`) ?? null;
}

/**
 * Focus a placeholder for typing. Clicked (`at`): the caret goes where the click was. Just
 * inserted: all of its text is selected, ready to be replaced.
 */
export function editPlaceholder(box: HTMLElement, at?: { x: number; y: number }): void {
  box.focus({ preventScroll: true });
  const caret = at ? document.caretRangeFromPoint?.(at.x, at.y) : null;
  const range = caret && box.contains(caret.startContainer) ? caret : document.createRange();
  if (range !== caret) range.selectNodeContents(box);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(range);
}
