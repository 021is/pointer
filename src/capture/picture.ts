// The picture: screenshots of the tab (Pointer's own UI hidden, shots.ts), cropped to the marks,
// brought to one pixel per CSS pixel, with the marks drawn on by the same SVG the overlay shows,
// and the Pointer lines printed under it (strip.ts). The PNG comes from a canvas: no metadata.

import { FRAME_TAB, renderSvg } from "../marks/svg";
import { type Rect, type Size, toImagePixels } from "../shared/geometry";
import type { CaptureReply, CaptureRequest } from "../shared/messages";
import { stackRegions } from "./layout";
import type { Cut } from "./shots";
import { STRIP, wrapLines } from "./strip";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function load(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

/** The visible tab as an image, once the page has painted (the caller hides Pointer's layer). */
export async function screenshot(): Promise<HTMLImageElement> {
  await nextFrame();
  await nextFrame();
  const ask: CaptureRequest = { type: "capture" };
  const reply = (await chrome.runtime.sendMessage(ask)) as CaptureReply | undefined;
  if (!reply) throw new Error("the extension did not answer (reload the extension?)");
  if (!reply.ok) throw new Error(reply.error);
  return await load(reply.dataUrl);
}

/** A pasted image as it lies on screen now: viewport box and see-through. */
export type Laid = { img: HTMLImageElement; rect: Rect; opacity: number };

/** Pasted images (hidden with Pointer's layer during the screenshot) drawn back where they lay. */
function drawPasted(ctx: CanvasRenderingContext2D, pasted: readonly Laid[], region: Rect, out: Rect) {
  const s = out.w / Math.max(1, region.w);
  ctx.save();
  ctx.beginPath();
  ctx.rect(out.x, out.y, out.w, out.h);
  ctx.clip();
  for (const p of pasted) {
    ctx.globalAlpha = p.opacity;
    ctx.drawImage(p.img, out.x + (p.rect.x - region.x) * s, out.y + (p.rect.y - region.y) * s, p.rect.w * s, p.rect.h * s);
  }
  ctx.restore();
}

/** One cut drawn at its place: its part of its screenshot, its pasted images, its marks. */
async function drawCut(ctx: CanvasRenderingContext2D, cut: Cut, size: Size, top: number, tab: number) {
  const { shot, region, scene, pasted } = cut;
  const ratio = shot.naturalWidth / window.innerWidth;
  const src = toImagePixels(region.rect, ratio, { w: shot.naturalWidth, h: shot.naturalHeight });
  ctx.drawImage(shot, src.x, src.y, src.w, src.h, 0, top, size.w, size.h);
  drawPasted(ctx, pasted, region.rect, { x: 0, y: top, ...size });
  // One renderer: the marks and, for a frame, its outline and letter tab come from svg.ts, the
  // view reaching FRAME_TAB above the region so the tab lands in its band.
  const r = region.rect;
  const band = region.label ? FRAME_TAB : 0;
  const view = { x: r.x, y: r.y - band, w: r.w, h: r.h + band };
  const frames = region.label ? [{ label: region.label, rect: r }] : [];
  const svg = renderSvg({ ...scene, frames }, view);
  const marks = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  ctx.drawImage(marks, 0, top - tab, size.w, size.h + tab);
}

/**
 * The picture: each cut (the crop frames A, B …, or the one auto crop) stacked, each from its own
 * screenshot with its marks on it as they lay there, a letter tab above each frame, and `strip`
 * (the bundle's text) printed under it all.
 */
export async function picture(cuts: readonly Cut[], strip: string | null): Promise<{ blob: Blob; size: Size }> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas in this tab");

  ctx.font = STRIP.font;
  const charWidth = ctx.measureText("M").width;
  const wrap = (width: number) => (strip ? wrapLines(strip, Math.floor((width - 2 * STRIP.pad) / charWidth)) : []);
  const stack = stackRegions(
    cuts.map((c) => c.region),
    strip === null ? null : (width) => wrap(width).length,
  );
  const lines = wrap(stack.width);
  canvas.width = stack.width;
  canvas.height = stack.height;
  ctx.fillStyle = STRIP.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingQuality = "high";
  // stackRegions places one region per cut, in their order.
  for (const [i, cut] of cuts.entries()) {
    const placed = stack.placed[i];
    if (placed) await drawCut(ctx, cut, placed.size, placed.top, placed.tab);
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
