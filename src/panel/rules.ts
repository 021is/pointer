// Which CSS reaches an element: every same-origin stylesheet rule that matches it (inside
// @media/@supports that apply, @layer and @container), plus its inline style. And which
// classes the page's CSS knows at all, to say "not built yet" for a class Tailwind never made.

export type Matched = { props: Map<string, string>; unreadable: number };

const safeMatches = (el: Element, selector: string) => {
  try {
    return el.matches(selector);
  } catch {
    return false; // a selector this browser can't parse matches nothing here
  }
};

function eachRule(visit: (rule: CSSStyleRule) => void): number {
  let unreadable = 0;
  const walk = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) visit(rule);
      else if (rule instanceof CSSMediaRule) {
        if (matchMedia(rule.media.mediaText).matches) walk(rule.cssRules);
      } else if (rule instanceof CSSSupportsRule) {
        if (CSS.supports(rule.conditionText)) walk(rule.cssRules);
      } else if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      unreadable++; // a cross-origin sheet: the browser hides its rules, counted and shown
      continue;
    }
    walk(rules);
  }
  return unreadable;
}

/** A reset that hits every element (`*, ::before`, `:root`): noise in a list about one element. */
export function isUniversal(selector: string): boolean {
  return selector.split(",").every((s) => /^\s*(\*|::?[\w-]+(\([^)]*\))?|:root|html|:host)+\s*$/.test(s));
}

/** Property → the selector that sets it last ("inline" for the style attribute). */
export function matchedProps(el: Element): Matched {
  const props = new Map<string, string>();
  const unreadable = eachRule((rule) => {
    if (isUniversal(rule.selectorText) || !safeMatches(el, rule.selectorText)) return;
    for (let i = 0; i < rule.style.length; i++) props.set(rule.style.item(i), rule.selectorText);
  });
  if (el instanceof HTMLElement || el instanceof SVGElement) {
    for (let i = 0; i < el.style.length; i++) props.set(el.style.item(i), "inline");
  }
  return { props, unreadable };
}

const CLASS = /\.((?:\\.|[\w-])+)/g;

let known: Set<string> | null = null;

/** Every class name some rule of the page mentions (read once per page). */
export function knownClasses(): Set<string> {
  if (known) return known;
  const found = new Set<string>();
  eachRule((rule) => {
    for (const m of rule.selectorText.matchAll(CLASS)) found.add((m[1] ?? "").replace(/\\(.)/g, "$1"));
  });
  known = found;
  return found;
}
