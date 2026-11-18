// Copy for the agent: one clipboard item with the bundle's text and, when it helps, the picture.
// The item is handed to the clipboard at once, inside the click or key press, with its parts as
// promises: Chrome then allows the write even though the screenshot takes a moment.

import { formatBundle, formatStrip, safeUrl } from "../bundle/format";
import type { Bundle, ComponentInfo, CropInfo, PinInfo } from "../bundle/types";
import type { Frame } from "../marks/svg";
import { type Crop, type Pin, cropLabel } from "../marks/types";
import { describeElement, liveLayout } from "../pick/describe";
import { cropFor } from "../shared/geometry";
import { componentOf } from "../source/client";
import {
  type State,
  cropsOf,
  laidOf,
  pictureBoxes,
  pictureScene,
  pinsOf,
  sceneFrames,
  summarize,
  wantsImage,
} from "../ui/state";
import { type Region, shownFrames } from "./layout";
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

/** One line of the bundle per crop; a frame scrolled out of view says so (it is not in the picture). */
export function cropInfos(
  crops: readonly Crop[],
  frames: readonly Frame[],
  off: readonly string[],
  componentOf: (el: Element) => Promise<ComponentInfo>,
): Promise<CropInfo[]> {
  return Promise.all(
    crops.map(async (c, i) => {
      const label = cropLabel(i);
      const rect = frames[i]?.rect;
      return {
        label,
        component: c.el ? await componentOf(c.el) : null,
        size: { w: Math.round(rect?.w ?? 0), h: Math.round(rect?.h ?? 0) },
        offScreen: off.includes(label),
      };
    }),
  );
}

/** The frames as the page lays them out now, and which of them the picture can show. */
function framesNow(ctx: CopyContext) {
  const viewport = { x: 0, y: 0, w: innerWidth, h: innerHeight };
  const frames = sceneFrames(ctx.state.marks, liveLayout());
  return { viewport, frames, split: shownFrames(frames, viewport) };
}

/**
 * The screenshot, taken at once (the page as it is at the click), and the regions to cut: the
 * frames on screen, or else one crop around every mark.
 */
async function shoot(ctx: CopyContext) {
  const { viewport, frames, split } = framesNow(ctx);
  if (split instanceof Error) throw split;
  const scene = pictureScene(ctx.state, liveLayout());
  const laid = laidOf(ctx.state.marks, liveLayout());
  const boxes = [...pictureBoxes(scene), ...laid.map((p) => p.rect)];
  const regions: Region[] = frames.length ? split.shown : [{ label: null, rect: cropFor(boxes, viewport) ?? viewport }];
  return { shot: await screenshot(ctx.host), regions, scene, laid };
}

/**
 * Writes the bundle to the clipboard; resolves with what was copied, rejects with the cause.
 * With a picture, the Pointer lines are printed under it too: chats keep only the image of a
 * text + image paste, so one paste still carries everything.
 */
export async function copyBundle(ctx: CopyContext): Promise<CopyResult> {
  const shot = wantsImage(ctx.state) ? shoot(ctx) : null;
  const { frames, split } = framesNow(ctx);
  const off = split instanceof Error ? frames.map((f) => f.label) : split.off;
  const crops = cropInfos(cropsOf(ctx.state.marks), frames, off, componentOf);
  const infos = Promise.all([pinInfos(ctx), crops]);
  const drawings = summarize(ctx.state.marks);
  const viewport = { w: innerWidth, h: innerHeight };
  const data = ([pins, crops]: [PinInfo[], CropInfo[]], image: CopyResult["image"]): Bundle => ({
    url: safeUrl(location.href),
    viewport,
    crops,
    pins,
    drawings,
    image,
  });
  const bundle = (i: [PinInfo[], CropInfo[]], image: CopyResult["image"]) => formatBundle(data(i, image));
  const image = shot
    ? (async () => {
        const [s, i] = await Promise.all([shot, infos]);
        return picture(s.shot, s.regions, s.scene, formatStrip(data(i, null), true), s.laid);
      })()
    : null;
  // With the picture: the full text beside it. Text only (the bar's switch): the compact lines.
  const text = (async () => {
    const [i, pic] = await Promise.all([infos, image]);
    return image ? bundle(i, pic?.size ?? null) : formatStrip(data(i, null), false);
  })();
  const textBlob = text.then((t) => new Blob([t], { type: "text/plain" }));
  const parts: Record<string, Promise<Blob>> = { "text/plain": textBlob };
  if (image) parts["image/png"] = image.then((p) => p.blob);
  await navigator.clipboard.write([new ClipboardItem(parts)]);
  const pic = await image;
  return { text: await text, image: pic?.size ?? null };
}
