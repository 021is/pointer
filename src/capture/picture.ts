// The picture: a screenshot of the tab (Pointer's own UI hidden), cropped to the marks, brought
// to one pixel per CSS pixel, with the marks drawn on by the same SVG the overlay shows, and the
// Pointer lines printed under it (strip.ts). The PNG comes from a canvas: no metadata at all.

import { FRAME_TAB, type Scene, renderSvg } from "../marks/svg";
import { type Size, toImagePixels } from "../shared/geometry";
import type { CaptureReply, CaptureRequest } from "../shared/messages";
import { type Region, stackRegions } from "./layout";
import { STRIP, stripHeight, wrapLines } from "./strip";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function load(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

/** The visible tab as an image, with Pointer's layer hidden while it is taken. */
export async function screenshot(host: HTMLElement): Promise<HTMLImageElement> {
  host.style.visibility = "hidden";
  try {
    await nextFrame();
    await nextFrame();
    const ask: CaptureRequest = { type: "capture" };
    const reply = (await chrome.runtime.sendMessage(ask)) as CaptureReply | undefined;
    if (!reply) throw new Error("the extension did not answer (reload the extension?)");
    if (!reply.ok) throw new Error(reply.error);
    return await load(reply.dataUrl);
  } finally {
    host.style.visibility = "";
  }
}

/**
 * The picture: each region (the crop frames A, B …, or the one auto crop) stacked, its marks on
 * it, a letter tab above each frame, and `strip` (the bundle's text) printed under it all.
 */
export async function picture(
  shot: HTMLImageElement,
  regions: readonly Region[],
  scene: Scene,
  strip: string | null,
): Promise<{ blob: Blob; size: Size }> {
  const ratio = shot.naturalWidth / window.innerWidth;
  const image = { w: shot.naturalWidth, h: shot.naturalHeight };
  const stack = stackRegions(regions, strip !== null);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas in this tab");

  ctx.font = STRIP.font;
  const perLine = Math.floor((stack.width - 2 * STRIP.pad) / ctx.measureText("M").width);
  const lines = strip ? wrapLines(strip, perLine) : [];
  canvas.width = stack.width;
  canvas.height = stack.bottom + stripHeight(lines.length);
  ctx.fillStyle = STRIP.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingQuality = "high";
  for (const { region, size, top, tab } of stack.placed) {
    const src = toImagePixels(region.rect, ratio, image);
    ctx.drawImage(shot, src.x, src.y, src.w, src.h, 0, top, size.w, size.h);
    // One renderer: the marks and, for a frame, its outline and letter tab come from svg.ts,
    // the view reaching FRAME_TAB above the region so the tab lands in its band.
    const r = region.rect;
    const band = region.label ? FRAME_TAB : 0;
    const view = { x: r.x, y: r.y - band, w: r.w, h: r.h + band };
    const frames = region.label ? [{ label: region.label, rect: r }] : [];
    const svg = renderSvg({ ...scene, frames }, view);
    const marks = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    ctx.drawImage(marks, 0, top - tab, size.w, size.h + tab);
  }

  // Setting the canvas size reset the context: font and colour again, then the lines.
  ctx.font = STRIP.font;
  ctx.fillStyle = STRIP.ink;
  ctx.textBaseline = "top";
  for (const [i, line] of lines.entries()) ctx.fillText(line, STRIP.pad, stack.bottom + STRIP.pad + i * STRIP.line);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("the picture could not be encoded");
  return { blob, size: { w: canvas.width, h: canvas.height } };
}
