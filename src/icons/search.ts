// Lucide's icons, searched by name and tags as the person types (Edvard, 2026-11-19: "an icon
// section on the bar … use lucid icon … search and drag or drop or just click to add it"). Pure.

/** dist/lucide.js, built from lucide-static: each icon's inner SVG markup and its tags. */
export type LucideData = { version: string; svg: Record<string, string>; tags: Record<string, string[]> };

/** How well a name or its tags answer one word: 0 is no match, higher is better. */
function score(name: string, tags: readonly string[], word: string): number {
  if (name === word) return 100;
  if (name.startsWith(word)) return 60;
  if (name.split("-").some((part) => part.startsWith(word))) return 40;
  if (name.includes(word)) return 30;
  if (tags.some((t) => t === word)) return 20;
  if (tags.some((t) => t.startsWith(word) || t.includes(` ${word}`))) return 10;
  return 0;
}

/** The icons for a query, best first (every word must match); no query gives the first ones. */
export function searchIcons(data: LucideData, query: string, limit = 60): string[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const names = Object.keys(data.svg);
  if (!words.length) return names.slice(0, limit);
  const ranked: { name: string; s: number }[] = [];
  for (const name of names) {
    const tags = data.tags[name] ?? [];
    let s = 0;
    for (const w of words) {
      const one = score(name, tags, w);
      if (!one) {
        s = 0;
        break;
      }
      s += one;
    }
    if (s) ranked.push({ name, s });
  }
  ranked.sort((a, b) => b.s - a.s || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return ranked.slice(0, limit).map((r) => r.name);
}

/** The picker's first row, one click away (Edvard, 2026-11-23: "first 3-5 icons"): the icons a
 *  page most often lacks. "More" opens the rest, searchable. */
export const QUICK: readonly string[] = ["search", "menu", "user", "heart", "plus"];

/** Where a placed icon's top-left goes: centred on the spot the person clicked; page coordinates. */
export function placeAt(size: number, spot: { x: number; y: number }) {
  return { x: spot.x - size / 2, y: spot.y - size / 2 };
}
