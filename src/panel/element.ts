// Edits on one element, live: inline !important styles (they beat Tailwind's layers), classes,
// placeholder boxes. Everything is undone by reset(), back to the element's own attributes.

import { type ElementEdits, changeLines, noEdits, withProp } from "./edits";
import { knownClasses } from "./rules";

const INSERT_ATTR = "data-pointer-insert";
const PLACEHOLDER =
  "outline:2px dashed #7c5cff;outline-offset:-2px;background:rgba(124,92,255,.08);color:#7c5cff;" +
  "min-height:48px;min-width:48px;display:flex;align-items:center;justify-content:center;" +
  "font:600 13px/1.3 system-ui,sans-serif;padding:8px;box-sizing:border-box;";

export type Edited = {
  readonly el: Element;
  edits: ElementEdits;
  set: (prop: string, value: string) => void;
  /** Off (the checkbox) keeps the row; removed drops it. Both read "removed" for the agent. */
  off: (prop: string) => void;
  on: (prop: string) => void;
  removeClass: (name: string) => void;
  addClass: (name: string) => boolean;
  insert: (position: "before" | "after") => HTMLElement;
  reset: () => void;
  lines: () => string[];
};

export function edit(el: Element): Edited {
  const style = (el as HTMLElement).style as CSSStyleDeclaration | undefined;
  const originalStyle = el.getAttribute("style");
  const originalClass = el.getAttribute("class");
  const nodes: HTMLElement[] = [];
  // "before" is what the element looked like when the panel first opened on it, so a value that
  // depends on another (letter-spacing in em, after a font-size edit) still reads its original.
  const live = getComputedStyle(el);
  const start = new Map<string, string>();
  const computed = (prop: string) => {
    if (!start.has(prop)) start.set(prop, live.getPropertyValue(prop).trim());
    return start.get(prop) ?? "";
  };
  for (const prop of [...live, "padding", "margin", "gap", "border", "border-radius", "inset", "overflow"]) {
    computed(prop);
  }
  const self: Edited = {
    el,
    edits: noEdits(),
    set(prop, value) {
      self.edits = withProp(self.edits, prop, computed(prop), value);
      style?.setProperty(prop, value, "important");
    },
    off(prop) {
      self.edits = withProp(self.edits, prop, computed(prop), null);
      style?.setProperty(prop, "unset", "important");
    },
    on(prop) {
      const edit = self.edits.props.find((p) => p.prop === prop);
      self.edits = { ...self.edits, props: self.edits.props.filter((p) => p !== edit) };
      style?.removeProperty(prop);
      const tmp = document.createElement("div");
      if (originalStyle) tmp.setAttribute("style", originalStyle);
      const own = tmp.style.getPropertyValue(prop);
      if (own) style?.setProperty(prop, own, tmp.style.getPropertyPriority(prop));
    },
    removeClass(name) {
      el.classList.remove(name);
      const added = self.edits.addedClasses.some((c) => c.name === name);
      self.edits = added
        ? { ...self.edits, addedClasses: self.edits.addedClasses.filter((c) => c.name !== name) }
        : { ...self.edits, removedClasses: [...self.edits.removedClasses, name] };
    },
    addClass(name) {
      if (el.classList.contains(name)) return true;
      el.classList.add(name);
      const built = knownClasses().has(name);
      const removed = self.edits.removedClasses.includes(name);
      self.edits = removed
        ? { ...self.edits, removedClasses: self.edits.removedClasses.filter((c) => c !== name) }
        : { ...self.edits, addedClasses: [...self.edits.addedClasses, { name, built }] };
      return built;
    },
    insert(position) {
      const box = document.createElement("div");
      box.setAttribute(INSERT_ATTR, position);
      box.setAttribute("style", PLACEHOLDER);
      box.contentEditable = "true";
      box.textContent = "New element";
      el[position](box);
      nodes.push(box);
      return box;
    },
    reset() {
      if (originalStyle === null) el.removeAttribute("style");
      else el.setAttribute("style", originalStyle);
      if (originalClass === null) el.removeAttribute("class");
      else el.setAttribute("class", originalClass);
      for (const n of nodes.splice(0)) n.remove();
      self.edits = noEdits();
    },
    lines() {
      const inserted = nodes
        .filter((n) => n.isConnected)
        .map((n) => {
          const r = n.getBoundingClientRect();
          return {
            position: n.getAttribute(INSERT_ATTR) === "before" ? ("before" as const) : ("after" as const),
            label: (n.textContent ?? "").trim() || "(empty)",
            size: { w: Math.round(r.width), h: Math.round(r.height) },
          };
        });
      return changeLines({ ...self.edits, inserted });
    },
  };
  return self;
}
