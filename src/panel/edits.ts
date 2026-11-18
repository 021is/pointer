// The style panel's edits as data, and the pure rules around them: the diff lines the agent
// reads, ↑/↓ nudging, and folding longhands into the shorthands people write.

export type PropEdit = {
  prop: string;
  /** The computed value before the first edit. */
  before: string;
  /** The value typed, or null when the property is turned off or removed. */
  after: string | null;
};

export type Inserted = { position: "before" | "after"; label: string; size: { w: number; h: number } };

export type ElementEdits = {
  props: PropEdit[];
  removedClasses: string[];
  addedClasses: { name: string; built: boolean }[];
  inserted: Inserted[];
};

export const noEdits = (): ElementEdits => ({ props: [], removedClasses: [], addedClasses: [], inserted: [] });

/** One line per change, as the bundle shows them under "changed:". */
export function changeLines(e: ElementEdits): string[] {
  const lines: string[] = [];
  for (const p of e.props) {
    if (p.after === null) lines.push(`removed ${p.prop} (was ${p.before})`);
    else if (p.after !== p.before) lines.push(`${p.prop} ${p.before} → ${p.after}`);
  }
  if (e.removedClasses.length) lines.push(`removed class: ${e.removedClasses.join(" ")}`);
  for (const c of e.addedClasses) lines.push(`added class: ${c.name}${c.built ? "" : " (not built yet)"}`);
  for (const i of e.inserted) {
    lines.push(`inserted ${i.position} it: placeholder "${i.label}" (${i.size.w}×${i.size.h})`);
  }
  return lines;
}

/** Sets or replaces the edit of one property, keeping its first `before`. */
export function withProp(edits: ElementEdits, prop: string, before: string, after: string | null): ElementEdits {
  const old = edits.props.find((p) => p.prop === prop);
  const next = { prop, before: old?.before ?? before, after };
  return { ...edits, props: old ? edits.props.map((p) => (p === old ? next : p)) : [...edits.props, next] };
}

const NUMBER = /-?\d*\.?\d+/;

/** ↑/↓ on a value: the first number moves by delta, its unit kept ("16px 24px" → "17px 24px"). */
export function nudge(value: string, delta: number): string | null {
  const m = value.match(NUMBER);
  if (!m || m.index === undefined) return null;
  const decimals = m[0].includes(".") ? (m[0].split(".")[1]?.length ?? 0) : 0;
  const moved = Number((Number(m[0]) + delta).toFixed(Math.max(decimals, Number.isInteger(delta) ? 0 : 1)));
  return value.slice(0, m.index) + String(moved) + value.slice(m.index + m[0].length);
}

const FOLD: [RegExp, string][] = [
  [/^padding(-.+)?$/, "padding"],
  [/^margin(-.+)?$/, "margin"],
  [/^border(-.+)?-radius$/, "border-radius"],
  [/^border-image(-.+)?$/, "border"],
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
