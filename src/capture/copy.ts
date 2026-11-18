// Copy for the agent: one clipboard item with the bundle's text and, when it helps, the picture.
// The item is handed to the clipboard at once, inside the click or key press, with its parts as
// promises: Chrome then allows the write even though the screenshot takes a moment.

import { formatBundle } from "../bundle/format";
import type { PinInfo } from "../bundle/types";
import type { Pin } from "../marks/types";
import { describeElement, liveLayout } from "../pick/describe";
import { cropFor } from "../shared/geometry";
import { componentOf } from "../source/client";
import { type State, pictureBoxes, pictureScene, pinsOf, shapesOf, summarize, wantsImage } from "../ui/state";
import { picture, screenshot } from "./picture";

export type CopyContext = {
  state: State;
  host: HTMLElement;
  /** The style panel's edits on a pin's element, one line each. */
  changesOf: (pin: Pin) => string[];
};

export type CopyResult = { text: string; image: { w: number; h: number } | null };

async function pinInfos(ctx: CopyContext): Promise<PinInfo[]> {
  return Promise.all(
    pinsOf(ctx.state.marks).map(async (pin, i) => ({
      n: i + 1,
      kind: pin.kind,
      component: await componentOf(pin.el),
      el: describeElement(pin.el),
      changes: ctx.changesOf(pin),
      note: pin.note,
    })),
  );
}

async function makeImage(ctx: CopyContext) {
  const scene = pictureScene(ctx.state, liveLayout());
  const viewport = { w: innerWidth, h: innerHeight };
  const crop = cropFor(pictureBoxes(scene), viewport) ?? { x: 0, y: 0, ...viewport };
  const shot = await screenshot(ctx.host);
  return picture(shot, crop, scene);
}

/** Writes the bundle to the clipboard; resolves with what was copied, rejects with the cause. */
export async function copyBundle(ctx: CopyContext): Promise<CopyResult> {
  const image = wantsImage(ctx.state) ? makeImage(ctx) : null;
  const drawings = summarize(shapesOf(ctx.state.marks));
  const text = (async () => {
    const [pins, pic] = await Promise.all([pinInfos(ctx), image]);
    return formatBundle({
      url: location.href,
      viewport: { w: innerWidth, h: innerHeight },
      pins,
      drawings,
      image: pic?.size ?? null,
    });
  })();
  const textBlob = text.then((t) => new Blob([t], { type: "text/plain" }));
  const parts: Record<string, Promise<Blob>> = { "text/plain": textBlob };
  if (image) parts["image/png"] = image.then((p) => p.blob);
  await navigator.clipboard.write([new ClipboardItem(parts)]);
  const pic = await image;
  return { text: await text, image: pic?.size ?? null };
}
