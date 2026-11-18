// The Pointer lines printed under the picture, so one paste carries both: chats keep only the
// image of a text + image paste (Edvard's try, 2026-11-18). Pixels cost about what the same text
// does (a 1000×18 px line ≈ 24 tokens). Pure layout here; picture.ts draws it.

export const STRIP = {
  font: '14px ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  line: 18,
  pad: 10,
  /** A strip is at least this wide, so a small crop doesn't wrap every line. */
  minWidth: 720,
  ink: "#f4f2ff",
  paper: "#16141f",
} as const;

/**
 * Lines cut to `max` characters. A wrapped line continues under itself, indented like the line
 * it came from plus two, so paths stay readable as one unit.
 */
export function wrapLines(text: string, max: number): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= max) {
      out.push(line);
      continue;
    }
    const indent = " ".repeat((line.match(/^\s*/)?.[0].length ?? 0) + 2);
    let rest = line;
    let first = true;
    while (rest.length > 0) {
      const room = first ? max : max - indent.length;
      let cut = rest.length <= room ? rest.length : rest.lastIndexOf(" ", room);
      if (cut <= room / 2) cut = Math.min(room, rest.length);
      out.push((first ? "" : indent) + rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
      first = false;
    }
  }
  return out;
}

/** The strip's height in pixels for a number of lines. */
export const stripHeight = (lines: number) => (lines ? STRIP.pad * 2 + lines * STRIP.line : 0);
