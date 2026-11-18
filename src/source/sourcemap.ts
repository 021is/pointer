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

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * A parsed JSON value checked as a source map where it enters: the map, or why it is not one.
 * Plain maps need `sources` (strings) and `mappings`; index maps need valid `sections`.
 */
export function readMap(value: unknown, depth = 0): RawMap | string {
  if (!value || typeof value !== "object") return "not an object";
  const v = value as Record<string, unknown>;
  if (v.version !== 3) return `version ${String(v.version)}, not 3`;
  if (v.sourceRoot !== undefined && typeof v.sourceRoot !== "string") return "sourceRoot is not a string";
  if (Array.isArray(v.sections)) {
    if (depth > 0) return "sections inside a section";
    const sections: NonNullable<RawMap["sections"]> = [];
    for (const [i, s] of v.sections.entries()) {
      const offset = (s as { offset?: { line?: unknown; column?: unknown } } | null)?.offset;
      if (!isNum(offset?.line) || !isNum(offset?.column)) return `section ${i} has no numeric offset`;
      const map = readMap((s as { map?: unknown }).map, depth + 1);
      if (typeof map === "string") return `section ${i}: ${map}`;
      sections.push({ offset: { line: offset.line, column: offset.column }, map });
    }
    return { version: 3, sections };
  }
  if (!Array.isArray(v.sources) || !v.sources.every((s) => typeof s === "string" || s === null)) {
    return "sources is not a list of strings";
  }
  if (typeof v.mappings !== "string") return "mappings is not a string";
  const sources = v.sources.map((s) => s ?? "");
  return { version: 3, sources, mappings: v.mappings, sourceRoot: v.sourceRoot as string | undefined };
}

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

/**
 * A map's source as a full address. The spec resolves a plain relative source against the code's
 * URL (Vite: "EventCard.jsx" next to http://…/src/EventCard.jsx → …/src/EventCard.jsx). Sources
 * with a scheme, an absolute path or a bundler marker ("[project]/…") are kept as they are.
 */
export function sourceAgainst(source: string, codeUrl: string): string {
  if (/^[a-z][\w+.-]*:/i.test(source) || source.startsWith("/") || source.startsWith("[")) return source;
  // A code URL that is not a URL (a server frame's path): the source as given.
  return URL.canParse(source, codeUrl) ? new URL(source, codeUrl).href : source;
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
