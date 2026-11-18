// Copy for the agent: one clipboard item with the bundle's text and, when it helps, the picture.
// The item is handed to the clipboard at once, inside the click or key press, with its parts as
// promises: Chrome then allows the write even though the screenshot takes a moment.

import { formatBundle, safeUrl } from "../bundle/format";
import type { CropInfo, PinInfo } from "../bundle/types";
import { type Pin, cropLabel } from "../marks/types";
import { describeElement, liveLayout } from "../pick/describe";
import { cropFor, intersect } from "../shared/geometry";
import { componentOf } from "../source/client";
import {
  type State,
  cropsOf,
  pictureBoxes,
  pictureScene,
  pinsOf,
  sceneFrames,
  shapesOf,
  summarize,
  wantsImage,
} from "../ui/state";
import type { Region } from "./layout";
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

async function cropInfos(ctx: CopyContext): Promise<CropInfo[]> {
  const frames = sceneFrames(ctx.state.marks, liveLayout());
  return Promise.all(
    cropsOf(ctx.state.marks).map(async (c, i) => ({
      label: cropLabel(i),
      component: c.el ? await componentOf(c.el) : null,
      size: { w: Math.round(frames[i]?.rect.w ?? 0), h: Math.round(frames[i]?.rect.h ?? 0) },
    })),
  );
}

/**
 * The parts of the screen the picture shows: the crop frames on screen, or else one crop around
 * every mark. Frames all scrolled out of view are a reason to stop, said plainly.
 */
function regionsOf(ctx: CopyContext): Region[] {
  const viewport = { x: 0, y: 0, w: innerWidth, h: innerHeight };
  const frames = sceneFrames(ctx.state.marks, liveLayout());
  if (frames.length) {
    const shown = frames.flatMap((f) => {
      const rect = intersect(f.rect, viewport);
      return rect ? [{ label: f.label, rect }] : [];
    });
    if (!shown.length) throw new Error("every crop is scrolled out of view: scroll one back in");
    return shown;
  }
  const scene = pictureScene(ctx.state, liveLayout());
  return [{ label: null, rect: cropFor(pictureBoxes(scene), viewport) ?? viewport }];
}

/** The screenshot, taken at once (the page as it is at the click), with what to cut and draw. */
async function shoot(ctx: CopyContext) {
  const regions = regionsOf(ctx);
  const scene = pictureScene(ctx.state, liveLayout());
  return { shot: await screenshot(ctx.host), regions, scene };
}

/**
 * Writes the bundle to the clipboard; resolves with what was copied, rejects with the cause.
 * With a picture, the Pointer lines are printed under it too: chats keep only the image of a
 * text + image paste, so one paste still carries everything.
 */
export async function copyBundle(ctx: CopyContext): Promise<CopyResult> {
  const shot = wantsImage(ctx.state) ? shoot(ctx) : null;
  const infos = Promise.all([pinInfos(ctx), cropInfos(ctx)]);
  const drawings = summarize(shapesOf(ctx.state.marks));
  const viewport = { w: innerWidth, h: innerHeight };
  const bundle = ([pins, crops]: [PinInfo[], CropInfo[]], image: CopyResult["image"]) =>
    formatBundle({ url: safeUrl(location.href), viewport, crops, pins, drawings, image });
  const image = shot
    ? (async () => {
        const [s, i] = await Promise.all([shot, infos]);
        return picture(s.shot, s.regions, s.scene, bundle(i, null));
      })()
    : null;
  const text = (async () => {
    const [i, pic] = await Promise.all([infos, image]);
    return bundle(i, pic?.size ?? null);
  })();
  const textBlob = text.then((t) => new Blob([t], { type: "text/plain" }));
  const parts: Record<string, Promise<Blob>> = { "text/plain": textBlob };
  if (image) parts["image/png"] = image.then((p) => p.blob);
  await navigator.clipboard.write([new ClipboardItem(parts)]);
  const pic = await image;
  return { text: await text, image: pic?.size ?? null };
}
