// Edits on one element, live: inline !important styles (they beat Tailwind's layers), classes,
// placeholder boxes. Everything is undone by reset(), back to the element's own attributes.

import { type ElementEdits, type Inserted, changeLines, noEdits, withProp, withoutProp } from "./edits";
import { PLACEHOLDER_ATTR } from "../shared/placeholder";
import { knownClasses, realmOf } from "./rules";

const PLACEHOLDER =
  "outline:2px dashed #7c5cff;outline-offset:-2px;background:rgba(124,92,255,.08);color:#7c5cff;" +
  "min-height:48px;min-width:48px;display:flex;align-items:center;justify-content:center;" +
  "font:600 13px/1.3 system-ui,sans-serif;padding:8px;box-sizing:border-box;";

/** Why a value was refused, said in the panel; null when it applied. */
export type Refusal = string | null;

export type Edited = {
  readonly el: Element;
  edits: ElementEdits;
  set: (prop: string, value: string) => Refusal;
  /** Off (the checkbox) keeps the row; remove (×) drops it. Both read "removed" for the agent. */
  off: (prop: string) => void;
  remove: (prop: string) => void;
  on: (prop: string) => void;
  removeClass: (name: string) => void;
  addClass: (name: string) => void;
  insert: (position: Inserted["position"]) => HTMLElement;
  reset: () => void;
  /** The element as it is now, so a reset can be taken back (Undo after Clear everything). */
  snapshot: () => Snapshot;
  restore: (snap: Snapshot) => void;
  lines: () => string[];
};

export type Snapshot = {
  style: string | null;
  className: string | null;
  edits: ElementEdits;
  placed: { node: HTMLElement; position: Inserted["position"] }[];
};

const setOrRemove = (el: Element, name: string, value: string | null) =>
  value === null ? el.removeAttribute(name) : el.setAttribute(name, value);

export function edit(el: Element): Edited {
  // Every element Pointer can pick (HTML, SVG, MathML) has an inline style.
  const style = (el as HTMLElement).style;
  const originalStyle = el.getAttribute("style");
  const originalClass = el.getAttribute("class");
  const placed: { node: HTMLElement; position: Inserted["position"] }[] = [];
  // "before" is what the element looked like when the panel first opened on it, so a value that
  // depends on another (letter-spacing in em, after a font-size edit) still reads its original.
  const live = realmOf(el).getComputedStyle(el);
  const start = new Map<string, string>();
  const computed = (prop: string) => {
    if (!start.has(prop)) start.set(prop, live.getPropertyValue(prop).trim());
    return start.get(prop) ?? "";
  };
  for (let i = 0; i < live.length; i++) computed(live.item(i));
  for (const prop of ["padding", "margin", "gap", "border", "border-radius", "inset", "overflow"]) computed(prop);
  const self: Edited = {
    el,
    edits: noEdits(),
    set(prop, value) {
      if (!value) return "type a value, or use × to remove it";
      // The browser silently drops a declaration it can't parse: ask first, and say so.
      if (!CSS.supports(prop, value)) return `"${prop}: ${value}" is not valid CSS`;
      style.setProperty(prop, value, "important");
      self.edits = withProp(self.edits, prop, computed(prop), { kind: "set", value });
      return null;
    },
    off(prop) {
      self.edits = withProp(self.edits, prop, computed(prop), { kind: "off" });
      style.setProperty(prop, "unset", "important");
    },
    remove(prop) {
      self.edits = withProp(self.edits, prop, computed(prop), { kind: "removed" });
      style.setProperty(prop, "unset", "important");
    },
    on(prop) {
      self.edits = withoutProp(self.edits, prop);
      style.removeProperty(prop);
      const tmp = document.createElement("div");
      if (originalStyle) tmp.setAttribute("style", originalStyle);
      const own = tmp.style.getPropertyValue(prop);
      if (own) style.setProperty(prop, own, tmp.style.getPropertyPriority(prop));
    },
    removeClass(name) {
      el.classList.remove(name);
      const added = self.edits.addedClasses.some((c) => c.name === name);
      self.edits = added
        ? { ...self.edits, addedClasses: self.edits.addedClasses.filter((c) => c.name !== name) }
        : { ...self.edits, removedClasses: [...self.edits.removedClasses, name] };
    },
    addClass(name) {
      if (el.classList.contains(name)) return;
      el.classList.add(name);
      const removed = self.edits.removedClasses.includes(name);
      self.edits = removed
        ? { ...self.edits, removedClasses: self.edits.removedClasses.filter((c) => c !== name) }
        : { ...self.edits, addedClasses: [...self.edits.addedClasses, { name, built: knownClasses(el).has(name) }] };
    },
    insert(position) {
      const node = document.createElement("div");
      node.setAttribute("style", PLACEHOLDER);
      node.setAttribute(PLACEHOLDER_ATTR, position);
      node.contentEditable = "true";
      node.textContent = "New element";
      el[position](node);
      placed.push({ node, position });
      return node;
    },
    reset() {
      setOrRemove(el, "style", originalStyle);
      setOrRemove(el, "class", originalClass);
      for (const { node } of placed.splice(0)) node.remove();
      self.edits = noEdits();
    },
    snapshot: () => ({
      style: el.getAttribute("style"),
      className: el.getAttribute("class"),
      edits: self.edits,
      placed: placed.slice(),
    }),
    restore(snap) {
      setOrRemove(el, "style", snap.style);
      setOrRemove(el, "class", snap.className);
      for (const p of snap.placed) {
        el[p.position](p.node);
        placed.push(p);
      }
      self.edits = snap.edits;
    },
    lines() {
      const inserted = placed
        .filter(({ node }) => node.isConnected)
        .map(({ node, position }) => {
          const r = node.getBoundingClientRect();
          const label = (node.textContent ?? "").trim() || "(empty)";
          return { position, label, size: { w: Math.round(r.width), h: Math.round(r.height) } };
        });
      return changeLines(self.edits, inserted);
    },
  };
  return self;
}
