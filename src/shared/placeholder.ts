// The placeholder boxes the style panel inserts into the page (⊕ before / after). They belong
// to Pointer: a click on one edits its label instead of picking it.

export const PLACEHOLDER_ATTR = "data-pointer-placeholder";

export function placeholderAt(el: Element | null): HTMLElement | null {
  return el?.closest<HTMLElement>(`[${PLACEHOLDER_ATTR}]`) ?? null;
}

/** Focus a placeholder for typing: all of its text selected, ready to be replaced. */
export function editPlaceholder(box: HTMLElement): void {
  box.focus();
  const range = document.createRange();
  range.selectNodeContents(box);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(range);
}
