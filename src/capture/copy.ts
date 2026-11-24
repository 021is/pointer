// Copy for the agent: one clipboard item with the bundle's text and, when it helps, the picture.
// The item is handed to the clipboard at once, inside the click or key press, with its parts as
// promises: Chrome then allows the write even though the screenshots take a moment (one per stop
// when crops are scrolled out of view, shots.ts).

import { formatBundle, formatStrip, safeUrl } from "../bundle/format";
import type { Bundle, ComponentInfo, CropInfo, CropShown, PinInfo } from "../bundle/types";
import type { Frame } from "../marks/svg";
import { type Crop, type Pin, cropLabel } from "../marks/types";
import { describeElement, liveLayout } from "../pick/describe";
import { cropFor } from "../shared/geometry";
import { componentOf } from "../source/client";
import { type State, cropsOf, laidOf, pictureBoxes, pictureScene, pinsOf, sceneFrames, shapeNotesOf, summarize, wantsImage } from "../ui/state";
import { type Costs, costsOf } from "./estimate";
import { picture } from "./picture";
import { type Now, type Shots, shoot } from "./shots";
import { framedSizes, sweepNote } from "./sweep";

export type CopyContext = {
  state: State;
  host: HTMLElement;
  /** The style panel's edits on a pin's element, one line each. */
  changesOf: (pin: Pin) => string[];
};

/** What was copied; `note` tells the person something they should know (a crop only partly in). */
export type CopyResult = { text: string; image: { w: number; h: number } | null; note: string | null };

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

/** One line of the bundle per crop, with how it shows in the picture. */
export function cropInfos(
  crops: readonly Crop[],
  frames: readonly Frame[],
  shown: (label: string) => CropShown,
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
        shown: shown(label),
      };
    }),
  );
}

/** How a crop shows in the picture the shots make; with no picture there is nothing to say. */
export const shownIn =
  (shots: Shots | null) =>
  (label: string): CropShown => {
    if (!shots) return "whole";
    if (shots.missed.includes(label)) return "none";
    return shots.larger.includes(label) ? "part" : "whole";
  };

/** The page now, as the shots read it at each stop. */
function nowOf(ctx: CopyContext): Now {
  return () => {
    const layout = liveLayout();
    const viewport = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    const scene = pictureScene(ctx.state, layout);
    const laid = laidOf(ctx.state.marks, layout);
    const boxes = [...pictureBoxes(scene), ...laid.map((p) => p.rect)];
    return { frames: sceneFrames(ctx.state.marks, layout), scene, laid, whole: cropFor(boxes, viewport) ?? viewport };
  };
}

/** The bundle's data once the shots are back (the page is where it was again) and every pin and
 *  crop is read, as a function of the picture's size. */
async function dataNow(ctx: CopyContext, shots: Promise<Shots> | null) {
  const frames = sceneFrames(ctx.state.marks, liveLayout());
  const shown = shownIn(shots ? await shots : null);
  const [pins, crops] = await Promise.all([pinInfos(ctx), cropInfos(cropsOf(ctx.state.marks), frames, shown, componentOf)]);
  const drawings = summarize(ctx.state.marks);
  const shapeNotes = shapeNotesOf(ctx.state.marks, pins.length);
  const viewport = { w: innerWidth, h: innerHeight };
  return (image: CopyResult["image"]): Bundle => ({ url: safeUrl(location.href), viewport, crops, pins, shapeNotes, drawings, image });
}

/** What each output would cost now, for Copy's menu: every crop counts, as the shots will take it. */
export async function estimateCosts(ctx: CopyContext): Promise<Costs> {
  const data = await dataNow(ctx, null);
  const at = nowOf(ctx)();
  const regions = at.frames.length ? framedSizes(at.frames, { w: innerWidth, h: innerHeight }) : [{ label: null, rect: at.whole }];
  return costsOf(regions, formatStrip(data(null), true), formatStrip(data(null), false));
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
  return { text: (await text) ?? "", image: pic?.size ?? null, note: pic?.note ?? null };
}

/** What Copy would give, built but not written anywhere (Copy and the preview share it). */
export function buildBundle(ctx: CopyContext) {
  const output = ctx.state.output;
  const shots = wantsImage(ctx.state) ? shoot(ctx.host, cropsOf(ctx.state.marks), nowOf(ctx)) : null;
  const data = dataNow(ctx, shots);
  const image = shots
    ? (async () => {
        const [s, d] = await Promise.all([shots, data]);
        const pic = await picture(s.cuts, output === "image" ? null : formatStrip(d(null), true));
        return { ...pic, note: sweepNote(s.larger, s.missed) };
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
