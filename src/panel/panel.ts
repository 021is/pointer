// The style panel as Pointer's extension: opens on a pick, keeps each element's edits, hands
// their diff to Copy, and undoes them when their pick is undone or cleared.

import type { Pin } from "../marks/types";
import { componentOf } from "../source/client";
import type { Extension, ExtensionHost } from "../ui/extension";
import { PANEL_CSS } from "./css";
import { type Edited, edit } from "./element";
import { renderPanel } from "./view";

export function createPanel(root: ShadowRoot, host: ExtensionHost): Extension {
  const style = document.createElement("style");
  style.textContent = PANEL_CSS;
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.hidden = true;
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());
  root.append(style, panel);

  const edited = new Map<Element, Edited>();
  /** The pick that owns an element's edits: its line in the bundle carries them. */
  const owner = new Map<Element, Pin>();
  let showing: Pin | null = null;

  const hide = () => {
    panel.hidden = true;
    showing = null;
    host.rerender();
  };

  function show(pin: Pin) {
    showing = pin;
    let e = edited.get(pin.el);
    if (!e) {
      e = edit(pin.el);
      edited.set(pin.el, e);
    }
    if (!owner.has(pin.el)) owner.set(pin.el, pin);
    const current = e;
    const paint = (info: Parameters<typeof renderPanel>[3]) =>
      renderPanel(panel, host.numberOf(pin), current, info, { changed: host.rerender, close: hide });
    panel.hidden = false;
    panel.removeAttribute("data-collapsed");
    panel.setAttribute("aria-label", "Styles of the picked element");
    paint(null);
    host.rerender();
    // componentOf never rejects: every failure resolves as unknown(why), which the panel shows.
    void componentOf(pin.el).then((info) => {
      if (showing === pin) paint(info);
    });
  }

  function remove(pin: Pin) {
    if (owner.get(pin.el) === pin) {
      edited.get(pin.el)?.reset();
      edited.delete(pin.el);
      owner.delete(pin.el);
      host.rerender();
    }
    if (showing === pin) hide();
  }

  return {
    changesOf: (pin) => (owner.get(pin.el) === pin ? (edited.get(pin.el)?.lines() ?? []) : []),
    // Pick is the CSS tool (Edvard, 2026-11-18): a pick opens its style box, no note box.
    onPick: show,
    onRemove: remove,
    park(pins) {
      const kept = pins.flatMap((pin) => {
        const e = owner.get(pin.el) === pin ? edited.get(pin.el) : undefined;
        return e ? [{ pin, e, snap: e.snapshot() }] : [];
      });
      for (const pin of pins) remove(pin);
      return () => {
        for (const { pin, e, snap } of kept) {
          e.restore(snap);
          edited.set(pin.el, e);
          owner.set(pin.el, pin);
        }
        host.rerender();
      };
    },
    // S or the 🎨 button: the style box for the last pick, and away again. A collapsed box, or
    // one open for another pick, opens for the last pick instead of closing; a pick whose element
    // left the page (a re-render, a hot reload) says so instead of opening on nothing.
    togglePanel(lastPick) {
      if (!lastPick) return "no-pick";
      if (!panel.hidden && showing === lastPick && !panel.hasAttribute("data-collapsed")) {
        hide();
        return "closed";
      }
      if (!lastPick.el.isConnected) return "gone";
      show(lastPick);
      return "opened";
    },
    panelFor: () => (panel.hidden ? null : showing),
    editsOf: (pin) => (owner.get(pin.el) === pin ? (edited.get(pin.el)?.edits ?? null) : null),
    // After a reload: the same edits on the element found again (placeholders are not kept).
    replay(pin, edits) {
      const e = edit(pin.el);
      edited.set(pin.el, e);
      owner.set(pin.el, pin);
      for (const p of edits.props) {
        switch (p.change.kind) {
          case "set":
            e.set(p.prop, p.change.value);
            break;
          case "off":
            e.off(p.prop);
            break;
          case "removed":
            e.remove(p.prop);
            break;
        }
      }
      for (const name of edits.removedClasses) e.removeClass(name);
      for (const c of edits.addedClasses) e.addClass(c.name);
      host.rerender();
    },
  };
}
