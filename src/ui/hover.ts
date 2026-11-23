// The element under the mouse while picking or cropping: its tag and size at once, then its
// component's name once the page's probe answers (if the mouse is still on it).

import { shortName, viewRect } from "../pick/describe";
import { componentOf } from "../source/client";
import type { State } from "./state";

export function hoverer(state: State, render: () => void): (el: Element | null) => void {
  return (el) => {
    if (state.hover?.el === el) return;
    state.hover = el ? { el, label: shortName(el, viewRect(el)) } : null;
    render();
    if (!el) return;
    void componentOf(el).then((info) => {
      const name = info.chain[0];
      if (name && state.hover?.el === el) {
        state.hover.label = `${name} · ${shortName(el, viewRect(el))}`;
        render();
      }
    });
  };
}
