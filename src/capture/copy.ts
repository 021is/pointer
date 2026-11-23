// Copy for the agent: one clipboard item with the bundle's text and, when it helps, the picture.
// The item is handed to the clipboard at once, inside the click or key press, with its parts as
// promises: Chrome then allows the write even though the screenshot takes a moment.

import { formatBundle, formatStrip, safeUrl } from "../bundle/format";
import type { Bundle, ComponentInfo, CropInfo, PinInfo } from "../bundle/types";
import type { Frame } from "../marks/svg";
import { type Crop, type Pin, cropLabel } from "../marks/types";
import { describeElement, liveLayout } from "../pick/describe";
import { surfaceWin, viewRectToClient, viewport as pageViewport } from "../screen/surface";
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
  shapeNotesOf,
  summarize,
  wantsImage,
} from "../ui/state";
import { type Costs, costsOf } from "./estimate";
import { type Region, shownFrames } from "./layout";
import { picture, screenshot } from "./picture";

export type CopyContext = {
  state: State;
  host: HTMLElement;
  /** The style panel's edits on a pin's element, one line each. */
  changesOf: (pin: Pin) => string[];
  /** The screen the page is marked at ("Mobile"), or null on Full. */
  screen: string | null;
};

export type CopyResult = { text: string; image: { w: number; h: number } | null };

async function pinInfos(ctx: CopyContext): Promise<PinInfo[]> {
  return Promise.all(
    pinsOf(ctx.state.marks).map(async (pin, i): Promise<PinInfo> => {
      const base = {
        n: i + 1,
        component: await componentOf(pin.el),
        el: describeElement(pin.el),
        changes: ctx.changesOf(pin),
        note: pin.note,
      };
      if (pin.kind === "icon") return { ...base, kind: "icon", name: pin.name };
      if (pin.kind !== "gap") return { ...base, kind: pin.kind };
      const other = { component: await componentOf(pin.other), el: describeElement(pin.other) };
      return { ...base, kind: "gap", px: pin.line.px, axis: pin.line.axis, other };
    }),
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

/** The frames as the page lays them out now, and which of them the picture can show. The page is
 *  the one being marked: on a framed screen, the frame's viewport bounds the picture. */
function framesNow(ctx: CopyContext) {
  const viewport = { x: 0, y: 0, ...pageViewport() };
  const frames = sceneFrames(ctx.state.marks, liveLayout());
  return { viewport, frames, split: shownFrames(frames, viewport) };
}

/**
 * What the picture would show, without taking it: the regions to cut (the frames on screen, or
 * one crop around every mark), the scene and the pasted images. An Error when every frame is
 * scrolled out of view.
 */
function regionsNow(ctx: CopyContext) {
  const { viewport, frames, split } = framesNow(ctx);
  if (split instanceof Error) return split;
  const scene = pictureScene(ctx.state, liveLayout());
  const laid = laidOf(ctx.state.marks, liveLayout());
  const boxes = [...pictureBoxes(scene), ...laid.map((p) => p.rect)];
  const regions: Region[] = frames.length ? split.shown : [{ label: null, rect: cropFor(boxes, viewport) ?? viewport }];
  return { regions, scene, laid };
}

/** The screenshot, taken at once (the page as it is at the click), with what to cut and draw. */
async function shoot(ctx: CopyContext) {
  const now = regionsNow(ctx);
  if (now instanceof Error) throw now;
  return { shot: await screenshot(ctx.host), ...now };
}

/** The bundle's data once every pin and crop is read, as a function of the picture's size. */
async function dataNow(ctx: CopyContext) {
  const { frames, split } = framesNow(ctx);
  const off = split instanceof Error ? frames.map((f) => f.label) : split.off;
  const [pins, crops] = await Promise.all([pinInfos(ctx), cropInfos(cropsOf(ctx.state.marks), frames, off, componentOf)]);
  const drawings = summarize(ctx.state.marks);
  const shapeNotes = shapeNotesOf(ctx.state.marks, pins.length);
  const viewport = pageViewport();
  // The framed page's own address: a link followed inside the frame is where the marks are.
  const url = safeUrl(surfaceWin().location.href);
  return (image: CopyResult["image"]): Bundle => ({ url, viewport, screen: ctx.screen, crops, pins, shapeNotes, drawings, image });
}

/** What each output would cost now, for Copy's menu. */
export async function estimateCosts(ctx: CopyContext): Promise<Costs> {
  const data = await dataNow(ctx);
  const now = regionsNow(ctx);
  return costsOf(now instanceof Error ? null : now.regions, formatStrip(data(null), true), formatStrip(data(null), false));
}

/**
 * Writes the bundle to the clipboard; resolves with what was copied, rejects with the cause.
 * Picture + text: the Pointer lines are printed under the picture too (chats keep only the image of
 * a text + image paste) and the full text goes beside it. Text only: the compact lines. Picture
 * only: the picture alone, no strip, no text.
 */
export async function copyBundle(ctx: CopyContext): Promise<CopyResult> {
  const { text, image } = buildBundle(ctx);
  const parts: Record<string, Promise<Blob>> = {};
  if (text) parts["text/plain"] = text.then((t) => new Blob([t], { type: "text/plain" }));
  if (image) parts["image/png"] = image.then((p) => p.blob);
  await navigator.clipboard.write([new ClipboardItem(parts)]);
  const pic = await image;
  return { text: (await text) ?? "", image: pic?.size ?? null };
}

/** What Copy would give, built but not written anywhere (Copy and the preview share it). */
export function buildBundle(ctx: CopyContext) {
  const output = ctx.state.output;
  const shot = wantsImage(ctx.state) ? shoot(ctx) : null;
  const data = dataNow(ctx);
  const image = shot
    ? (async () => {
        const [s, d] = await Promise.all([shot, data]);
        return picture(s.shot, s.regions, s.scene, output === "image" ? null : formatStrip(d(null), true), s.laid, viewRectToClient);
      })()
    : null;
  const text =
    output === "image"
      ? null
      : (async () => {
          const [d, pic] = await Promise.all([data, image]);
          return image ? formatBundle(d(pic?.size ?? null)) : formatStrip(d(null), false);
        })();
  return { text, image };
}
