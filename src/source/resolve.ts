// The edge of the source lookup: fetches a served chunk's source map (once per chunk) and maps a
// stack frame back to the original file. Runs in the page's world and reads only the page's own
// origin (its dev server); a frame from anywhere else is named, never fetched. Next's dev server
// also serves maps for server frames.

import type { Source } from "../bundle/types";
import { type Frame, cleanSourcePath } from "./stack";
import { type RawMap, decodeDataUrl, mapUrlOf, originalPosition } from "./sourcemap";

type Loaded = { map: RawMap } | { why: string };

const maps = new Map<string, Promise<Loaded>>();

const sameOrigin = (url: string) => {
  try {
    return new URL(url).origin === location.origin;
  } catch {
    return false; // not a URL at all: nothing to fetch
  }
};

async function fetchText(url: string): Promise<string> {
  if (url.startsWith("data:")) return decodeDataUrl(url);
  if (!sameOrigin(url)) throw new Error(`${new URL(url).host} is not this page's server`);
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${res.status} for ${url.split("/").pop()}`);
  return res.text();
}

async function loadMap(chunkUrl: string): Promise<Loaded> {
  let why = "no sourceMappingURL";
  if (/^https?:/.test(chunkUrl)) {
    const mapUrl = mapUrlOf(await fetchText(chunkUrl), chunkUrl);
    if (mapUrl) return { map: JSON.parse(await fetchText(mapUrl)) as RawMap };
  }
  // Next.js dev: maps for any frame it compiled, server frames included (file://, rsc://).
  const next = `${location.origin}/__nextjs_source-map?filename=${encodeURIComponent(chunkUrl)}`;
  try {
    const text = await fetchText(next);
    if (text.trimStart().startsWith("{")) return { map: JSON.parse(text) as RawMap };
  } catch (err) {
    why = err instanceof Error ? err.message : String(err);
  }
  return { why };
}

function mapFor(chunkUrl: string): Promise<Loaded> {
  let found = maps.get(chunkUrl);
  if (!found) {
    found = loadMap(chunkUrl).catch((err: unknown) => ({ why: err instanceof Error ? err.message : String(err) }));
    maps.set(chunkUrl, found);
  }
  return found;
}

/** A frame's original file and line, or a note saying why there is none. */
export async function resolveFrame(frame: Frame): Promise<{ source?: Source; note?: string }> {
  // React's server frames carry the file in their URL: rsc://React/Server/file:///…/page.tsx?3
  const url = frame.url.replace(/^(rsc|about):\/\/React\/Server\//, "").replace(/\?\d+$/, "");
  const loaded = await mapFor(url);
  if ("why" in loaded) {
    const file = cleanSourcePath(url);
    return /\.(tsx?|jsx?|vue|svelte)$/.test(file) && !/\/_next\/|chunks\//.test(url)
      ? { source: { file, line: frame.line } }
      : { note: `no source map for ${file.split("/").pop() ?? file}: ${loaded.why}` };
  }
  const original = originalPosition(loaded.map, frame.line - 1, frame.column - 1);
  if (!original) return { note: "source map has no entry for the element" };
  return { source: { file: cleanSourcePath(original.source), line: original.line } };
}
