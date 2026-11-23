// A press outside an open menu, picker or panel closes it, and does nothing else: the press that
// dismisses never also comments, draws or picks on the page. One listener on the window, in the
// capture phase, from `watch` (on open) to `unwatch` (on close). A click that follows the press
// (on another button of the bar) still reaches its button.

export type Outside = { watch: () => void; unwatch: () => void };

export function closeOnOutside(inside: Element, close: () => void): Outside {
  const press = (e: Event) => {
    if (e.composedPath().includes(inside)) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };
  return {
    watch: () => window.addEventListener("pointerdown", press, true),
    unwatch: () => window.removeEventListener("pointerdown", press, true),
  };
}
