// Which CSS reaches an element: every same-origin stylesheet rule that matches it (inside
// @media/@supports that apply, and @layer), plus its inline style. Rules inside @container are
// listed too, marked "if its container matches": a container query can't be asked from outside.
// And which classes the page's CSS knows at all, to say "not built yet" for a class Tailwind
// never made.

export type Matched = { props: Map<string, string>; unreadable: number };

const safeMatches = (el: Element, selector: string) => {
  try {
    return el.matches(selector);
  } catch {
    return false; // a selector this browser can't parse matches nothing here
  }
};

/** Which rules a walk enters: those that apply now, or every one there is. */
type Scope = "applying" | "all";

/** A page's window with its own constructors: a page framed at a screen size has its own realm,
 *  so its rules are instances of its CSSStyleRule, and its @media answers to its own width. */
type Realm = Window & typeof globalThis;

/** The window an element lives in: the tab's, or the framed page's. */
export const realmOf = (el: Element): Realm => (el.ownerDocument.defaultView ?? window) as Realm;

function eachRule(w: Realm, scope: Scope, visit: (rule: CSSStyleRule, note: string) => void): number {
  let unreadable = 0;
  const walk = (rules: CSSRuleList, note: string) => {
    for (const rule of rules) {
      if (rule instanceof w.CSSStyleRule) visit(rule, note);
      else if (rule instanceof w.CSSMediaRule) {
        if (scope === "all" || w.matchMedia(rule.media.mediaText).matches) walk(rule.cssRules, note);
      } else if (rule instanceof w.CSSSupportsRule) {
        if (scope === "all" || CSS.supports(rule.conditionText)) walk(rule.cssRules, note);
      } else if (typeof w.CSSContainerRule !== "undefined" && rule instanceof w.CSSContainerRule) {
        walk(rule.cssRules, ` (if its container matches ${rule.conditionText})`);
      } else if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules, note);
    }
  };
  for (const sheet of w.document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      unreadable++; // a cross-origin sheet: the browser hides its rules, counted and shown
      continue;
    }
    walk(rules, "");
  }
  return unreadable;
}

/** A reset that hits every element (`*, ::before`, `:root`): noise in a list about one element. */
export function isUniversal(selector: string): boolean {
  return selector.split(",").every((s) => /^\s*(\*|::?[\w-]+(\([^)]*\))?|html)+\s*$/.test(s));
}

/** Property → the selector that sets it last ("inline" for the style attribute). */
export function matchedProps(el: Element): Matched {
  const props = new Map<string, string>();
  const w = realmOf(el);
  const unreadable = eachRule(w, "applying", (rule, note) => {
    if (isUniversal(rule.selectorText) || !safeMatches(el, rule.selectorText)) return;
    for (let i = 0; i < rule.style.length; i++) props.set(rule.style.item(i), rule.selectorText + note);
  });
  if (el instanceof w.HTMLElement || el instanceof w.SVGElement) {
    for (let i = 0; i < el.style.length; i++) props.set(el.style.item(i), "inline");
  }
  return { props, unreadable };
}

const CLASS = /\.((?:\\.|[\w-])+)/g;

/**
 * Every class name some rule of the page mentions, at any width (an `md:` class is built even
 * when the window is narrow). Read fresh each time: dev servers add CSS as code changes. `el`'s
 * page decides: the tab's, or the one framed at a screen size.
 */
export function knownClasses(el: Element): Set<string> {
  const found = new Set<string>();
  eachRule(realmOf(el), "all", (rule) => {
    for (const m of rule.selectorText.matchAll(CLASS)) found.add((m[1] ?? "").replace(/\\(.)/g, "$1"));
  });
  return found;
}
