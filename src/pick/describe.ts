// What the DOM itself says about an element: a selector that finds it, its text, its size and
// its key styles. The framework's view (component, file) comes from source/. An element may be in
// the page framed at a screen size: its own document and window answer, never the tab's.

import type { ElementInfo } from "../bundle/types";
import { KEY_PROPS, keyStyles } from "../bundle/key-styles";
import { scroll } from "../screen/surface";
import type { Rect } from "../shared/geometry";
import type { Layout } from "../ui/state";

const PLAIN_CLASS = /^-?[a-zA-Z_][\w-]*$/;
const MAX_DEPTH = 5;

const isUnique = (doc: Document, selector: string) => {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch {
    return false; // a selector the browser can't parse finds nothing, so it isn't unique
  }
};

function part(el: Element): string {
  let s = el.tagName.toLowerCase();
  const classes = [...el.classList].filter((c) => PLAIN_CLASS.test(c)).slice(0, 2);
  if (classes.length) s += `.${classes.map((c) => CSS.escape(c)).join(".")}`;
  const parent = el.parentElement;
  if (parent) {
    const same = [...parent.children].filter((c) => c.tagName === el.tagName);
    if (same.length > 1) s += `:nth-of-type(${same.indexOf(el) + 1})`;
  }
  return s;
}

/** The shortest selector, up to five levels, that finds this element and only it. */
export function selectorOf(el: Element): string {
  // Every selector returned is the escaped one that was tested: `#a.b` would find nothing.
  const doc = el.ownerDocument;
  const testId = el.getAttribute("data-testid");
  const byTestId = testId ? `[data-testid="${CSS.escape(testId)}"]` : null;
  if (byTestId && isUnique(doc, byTestId)) return byTestId;
  const byId = el.id ? `#${CSS.escape(el.id)}` : null;
  if (byId && isUnique(doc, byId)) return byId;
  const parts: string[] = [];
  for (let node: Element | null = el; node && parts.length < MAX_DEPTH; node = node.parentElement) {
    if (node === doc.documentElement) break;
    if (node !== el && node.id && isUnique(doc, `#${CSS.escape(node.id)}`)) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    parts.unshift(part(node));
    const selector = parts.join(" > ");
    if (isUnique(doc, selector)) return selector;
  }
  return parts.join(" > ");
}

/** "div.card 320×180", for the hover label. */
export function shortName(el: Element, rect: Rect): string {
  const first = [...el.classList].find((c) => PLAIN_CLASS.test(c));
  const name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : first ? `.${first}` : "");
  return `${name} ${Math.round(rect.w)}×${Math.round(rect.h)}`;
}

export function viewRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** The page being marked as it is laid out right now: its scroll and every element's box. */
export function liveLayout(): Layout {
  return { scroll: scroll(), rectOf: viewRect };
}

/** An element of the framed page is of that page's realm: `instanceof HTMLElement` (the tab's)
 *  is false for it, so what it can do is asked of the element itself. */
function textOf(el: Element): string | undefined {
  const raw = "innerText" in el && typeof el.innerText === "string" ? el.innerText : (el.textContent ?? "");
  const text = raw.slice(0, 200).replace(/\s+/g, " ").trim();
  if (text) return text;
  return el.getAttribute("aria-label") ?? el.getAttribute("alt") ?? el.getAttribute("placeholder") ?? undefined;
}

export function readStyles(el: Element, props: readonly string[]): Record<string, string> {
  const computed = (el.ownerDocument.defaultView ?? window).getComputedStyle(el);
  return Object.fromEntries(props.map((p) => [p, computed.getPropertyValue(p)]));
}

export function describeElement(el: Element): ElementInfo {
  const rect = viewRect(el);
  const className = el.getAttribute("class")?.trim();
  return {
    selector: selectorOf(el),
    tag: el.tagName.toLowerCase(),
    text: textOf(el),
    className: className || undefined,
    size: { w: Math.round(rect.w), h: Math.round(rect.h) },
    style: keyStyles(readStyles(el, KEY_PROPS)) || undefined,
  };
}
