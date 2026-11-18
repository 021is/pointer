// The picture: a screenshot of the tab (Pointer's own UI hidden), cropped to the marks, brought
// to one pixel per CSS pixel, with the marks drawn on by the same SVG the overlay shows. The PNG
// comes from a canvas, so it carries no metadata at all.

import { type Scene, renderSvg } from "../marks/svg";
import { type Rect, type Size, outputSize, toImagePixels } from "../shared/geometry";

type CaptureReply = { ok: true; dataUrl: string } | { ok: false; error: string };

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
    const reply = (await chrome.runtime.sendMessage({ type: "capture" })) as CaptureReply | undefined;
    if (!reply) throw new Error("the extension did not answer (reload the extension?)");
    if (!reply.ok) throw new Error(reply.error);
    return await load(reply.dataUrl);
  } finally {
    host.style.visibility = "";
  }
}

export async function picture(shot: HTMLImageElement, crop: Rect, scene: Scene): Promise<{ blob: Blob; size: Size }> {
  const ratio = shot.naturalWidth / window.innerWidth;
  const src = toImagePixels(crop, ratio, { w: shot.naturalWidth, h: shot.naturalHeight });
  const size = outputSize(crop);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas in this tab");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(shot, src.x, src.y, src.w, src.h, 0, 0, size.w, size.h);
  const svg = renderSvg(scene, crop);
  const marks = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  ctx.drawImage(marks, 0, 0, size.w, size.h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("the picture could not be encoded");
  return { blob, size };
}
