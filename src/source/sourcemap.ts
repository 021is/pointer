// A small source-map reader: from a position in a served chunk back to the original file and
// line. Handles plain maps (webpack, Vite) and index maps with sections (Turbopack). Pure.

export type RawMap = {
  version: number;
  sources?: string[];
  sourceRoot?: string;
  mappings?: string;
  sections?: { offset: { line: number; column: number }; map: RawMap }[];
};

export type Original = { source: string; line: number; column: number };

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const DIGIT = new Map([...B64].map((ch, i) => [ch, i]));

/** One mapping segment: base64 VLQ → its numbers (1, 4 or 5 of them). */
export function decodeVlq(segment: string): number[] {
  const out: number[] = [];
  let value = 0;
  let shift = 0;
  for (const ch of segment) {
    const digit = DIGIT.get(ch);
    if (digit === undefined) throw new Error(`bad VLQ character "${ch}"`);
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

/**
 * The original position of generated `line`/`column` (both 0-based), or null when that spot has
 * no mapping. Source, line and column state carries across lines; only the generated column
 * resets on each line, so every line up to the target is decoded.
 */
export function originalPosition(map: RawMap, line: number, column: number): Original | null {
  if (map.sections) {
    let hit: (typeof map.sections)[number] | undefined;
    for (const s of map.sections) {
      const o = s.offset;
      if (o.line < line || (o.line === line && o.column <= column)) hit = s;
      else break;
    }
    if (!hit) return null;
    const inner = line - hit.offset.line;
    return originalPosition(hit.map, inner, inner === 0 ? column - hit.offset.column : column);
  }
  const lines = (map.mappings ?? "").split(";");
  let src = 0;
  let origLine = 0;
  let origCol = 0;
  let best: Original | null = null;
  for (let l = 0; l <= line && l < lines.length; l++) {
    let genCol = 0;
    for (const seg of (lines[l] ?? "").split(",")) {
      if (!seg) continue;
      const [dCol = 0, dSrc, dLine, dOrigCol] = decodeVlq(seg);
      genCol += dCol;
      if (dSrc === undefined || dLine === undefined || dOrigCol === undefined) continue;
      src += dSrc;
      origLine += dLine;
      origCol += dOrigCol;
      if (l === line && genCol <= column) {
        const name = map.sources?.[src];
        if (name !== undefined) {
          best = { source: (map.sourceRoot ?? "") + name, line: origLine + 1, column: origCol + 1 };
        }
      }
    }
  }
  return best;
}

/** The `sourceMappingURL` at the end of served code, resolved against the code's own URL. */
export function mapUrlOf(code: string, codeUrl: string): string | null {
  const tail = code.slice(-4096);
  const all = [...tail.matchAll(/\/\/[#@] ?sourceMappingURL=(\S+)/g)];
  const last = all.at(-1)?.[1];
  if (!last) return null;
  return last.startsWith("data:") ? last : new URL(last, codeUrl).href;
}

/** A `data:application/json;base64,…` map, decoded; other data URLs as their raw text. */
export function decodeDataUrl(url: string): string {
  const comma = url.indexOf(",");
  const meta = url.slice(0, comma);
  const body = url.slice(comma + 1);
  if (meta.endsWith(";base64")) {
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(body);
}
