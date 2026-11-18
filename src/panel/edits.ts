// The style panel's edits as data, and the pure rules around them: the diff lines the agent
// reads, ↑/↓ nudging, and folding longhands into the shorthands people write.

/** Set to a value; off (the checkbox, the row stays); removed (×, the row goes). */
export type Change = { kind: "set"; value: string } | { kind: "off" } | { kind: "removed" };

export type PropEdit = {
  prop: string;
  /** The computed value when the panel first saw the element. */
  before: string;
  change: Change;
};

export type Inserted = { position: "before" | "after"; label: string; size: { w: number; h: number } };

export type ElementEdits = {
  props: PropEdit[];
  removedClasses: string[];
  addedClasses: { name: string; built: boolean }[];
};

export const noEdits = (): ElementEdits => ({ props: [], removedClasses: [], addedClasses: [] });

/** One line per change, as the bundle shows them under "changed:". Inserts are read live. */
export function changeLines(e: ElementEdits, inserted: readonly Inserted[] = []): string[] {
  const lines: string[] = [];
  for (const p of e.props) {
    if (p.change.kind !== "set") lines.push(`removed ${p.prop} (was ${p.before})`);
    else if (p.change.value !== p.before) lines.push(`${p.prop} ${p.before} → ${p.change.value}`);
  }
  if (e.removedClasses.length) lines.push(`removed class: ${e.removedClasses.join(" ")}`);
  for (const c of e.addedClasses) lines.push(`added class: ${c.name}${c.built ? "" : " (not built yet)"}`);
  for (const i of inserted) {
    lines.push(`inserted ${i.position} it: placeholder "${i.label}" (${i.size.w}×${i.size.h})`);
  }
  return lines;
}

/** Sets or replaces the edit of one property, keeping its first `before`. */
export function withProp(edits: ElementEdits, prop: string, before: string, change: Change): ElementEdits {
  const old = edits.props.find((p) => p.prop === prop);
  const next = { prop, before: old?.before ?? before, change };
  return { ...edits, props: old ? edits.props.map((p) => (p === old ? next : p)) : [...edits.props, next] };
}

export const withoutProp = (edits: ElementEdits, prop: string): ElementEdits => ({
  ...edits,
  props: edits.props.filter((p) => p.prop !== prop),
});

/** Properties removed with ×: their rows are not shown. */
export const removedProps = (edits: ElementEdits): Set<string> =>
  new Set(edits.props.filter((p) => p.change.kind === "removed").map((p) => p.prop));

const NUMBER = /-?\d*\.?\d+/;
/** Colours: their digits are channels, never a size to nudge. */
const COLOR = /#[\da-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/gi;

/**
 * ↑/↓ on a value: the first number outside any colour moves by delta, its unit kept
 * ("16px 24px" → "17px 24px", "0 1px 3px rgb(0 0 0)" → "1 1px 3px rgb(0 0 0)"). Null when there
 * is nothing to nudge (#1a1a2e, auto).
 */
export function nudge(value: string, delta: number): string | null {
  const masked = value.replace(COLOR, (c) => " ".repeat(c.length));
  const m = masked.match(NUMBER);
  if (!m || m.index === undefined) return null;
  const decimals = m[0].includes(".") ? (m[0].split(".")[1]?.length ?? 0) : 0;
  const moved = Number((Number(m[0]) + delta).toFixed(Math.max(decimals, Number.isInteger(delta) ? 0 : 1)));
  return value.slice(0, m.index) + String(moved) + value.slice(m.index + m[0].length);
}

const FOLD: [RegExp, string][] = [
  [/^padding(-.+)?$/, "padding"],
  [/^margin(-.+)?$/, "margin"],
  [/^border(-.+)?-radius$/, "border-radius"],
  [/^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-(width|style|color))?$/, "border"],
  [/^(row|column)-gap$/, "gap"],
  [/^overflow-[xy]$/, "overflow"],
  [/^(transition|animation|outline|text-decoration|list-style)-.+$/, "$1"],
];

/** Longhands folded into their shorthand, custom properties dropped, order kept, no repeats. */
export function groupProps(names: readonly string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    if (name.startsWith("--")) continue;
    let folded = name;
    for (const [re, to] of FOLD) {
      if (re.test(name)) {
        folded = name.replace(re, to);
        break;
      }
    }
    if (!out.includes(folded)) out.push(folded);
  }
  return out;
}

/** "gap: 12px" or "gap 12px" → ["gap", "12px"]; null when there is no value. */
export function parseDeclaration(text: string): [string, string] | null {
  const m = text.trim().match(/^([a-z-]+)\s*[:\s]\s*(.+?);?$/i);
  if (!m?.[1] || !m[2]) return null;
  return [m[1].toLowerCase(), m[2].trim()];
}
