// The edge of the source lookup: fetches a served chunk's source map (once per chunk) and maps a
// stack frame back to the original file. Runs in the page's world, so the dev server answers it
// like the page's own request. Next's dev server also serves maps for server frames.

import type { Source } from "../bundle/types";
import { type Frame, cleanSourcePath } from "./stack";
import { type RawMap, decodeDataUrl, mapUrlOf, originalPosition } from "./sourcemap";

const maps = new Map<string, Promise<RawMap | null>>();

async function fetchText(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return decodeDataUrl(url);
  const res = await fetch(url, { credentials: "same-origin" });
  return res.ok ? res.text() : null;
}

async function loadMap(chunkUrl: string): Promise<RawMap | null> {
  if (/^https?:/.test(chunkUrl)) {
    const code = await fetchText(chunkUrl);
    const mapUrl = code ? mapUrlOf(code, chunkUrl) : null;
    const text = mapUrl ? await fetchText(mapUrl) : null;
    if (text) return JSON.parse(text) as RawMap;
  }
  // Next.js dev: maps for any frame it compiled, server frames included (file://, rsc://).
  const next = `${location.origin}/__nextjs_source-map?filename=${encodeURIComponent(chunkUrl)}`;
  const text = await fetchText(next).catch(() => null);
  return text?.trimStart().startsWith("{") ? (JSON.parse(text) as RawMap) : null;
}

function mapFor(chunkUrl: string): Promise<RawMap | null> {
  let found = maps.get(chunkUrl);
  if (!found) {
    found = loadMap(chunkUrl).catch(() => null);
    maps.set(chunkUrl, found);
  }
  return found;
}

/** A frame's original file and line, or a note saying why there is none. */
export async function resolveFrame(frame: Frame): Promise<{ source?: Source; note?: string }> {
  // React's server frames carry the file in their URL: rsc://React/Server/file:///…/page.tsx?3
  const url = frame.url.replace(/^(rsc|about):\/\/React\/Server\//, "").replace(/\?\d+$/, "");
  const map = await mapFor(url);
  if (!map) {
    const file = cleanSourcePath(url);
    return /\.(tsx?|jsx?|vue|svelte)$/.test(file) && !/\/_next\/|chunks\//.test(url)
      ? { source: { file, line: frame.line } }
      : { note: `no source map for ${file.split("/").pop() ?? file}` };
  }
  const original = originalPosition(map, frame.line - 1, frame.column - 1);
  if (!original) return { note: "source map has no entry for the element" };
  return { source: { file: cleanSourcePath(original.source), line: original.line } };
}
