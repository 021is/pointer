// The screenshots a picture is cut from (sweep.ts plans them): Pointer's layer hidden, the page
// scrolled to each stop, the tab captured there (the worker paces the captures: Chrome takes two
// a second), then every scroll put back exactly where it was, the window's last. With no crop,
// or every crop in view, it is the one screenshot of the page as it is.

import type { Scene } from "../marks/svg";
import type { Crop } from "../marks/types";
import { type Rect, intersect } from "../shared/geometry";
import type { Region } from "./layout";
import { type Laid, screenshot } from "./picture";
import { type Stop, planSweep } from "./sweep";

/** A part of one screenshot to show, with the marks and pasted images as they lay at that stop. */
export type Cut = { shot: HTMLImageElement; region: Region; scene: Scene; pasted: readonly Laid[] };

/** The page now, in viewport coordinates: the crop frames, the scene, the pasted images, and the
 *  region to show when there is no crop (one crop around every mark). */
export type Now = () => { frames: readonly { label: string; rect: Rect }[]; scene: Scene; laid: readonly Laid[]; whole: Rect };

/** The cuts in label order; the crops only partly in them, and those not in them at all. */
export type Shots = { cuts: Cut[]; larger: string[]; missed: string[] };

const viewport = (): Rect => ({ x: 0, y: 0, w: innerWidth, h: innerHeight });

/** The boxes around an element that scroll on their own (a list, a panel), nearest first. */
export function scrollingBoxes(el: Element): Element[] {
  const boxes: Element[] = [];
  for (let at = el.parentElement; at && at !== document.body && at !== document.documentElement; at = at.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(at);
    const scrolls = /(auto|scroll|overlay)/.test(`${overflowX} ${overflowY}`);
    if (scrolls && (at.scrollHeight > at.clientHeight || at.scrollWidth > at.clientWidth)) boxes.push(at);
  }
  return boxes;
}

/** Whether a box it scrolls in hides part of the element now. */
function clipped(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return scrollingBoxes(el).some((box) => {
    const b = box.getBoundingClientRect();
    return r.left < b.left || r.top < b.top || r.right > b.right || r.bottom > b.bottom;
  });
}

/** Notes every scroll the sweep may move, and puts each back: the boxes, then the window. */
export function keepScrolls(els: readonly Element[]): () => void {
  const page = { left: scrollX, top: scrollY };
  const boxes = [...new Set(els.flatMap(scrollingBoxes))].map((el) => ({ el, left: el.scrollLeft, top: el.scrollTop }));
  return () => {
    for (const b of boxes) {
      if (b.el.scrollLeft !== b.left || b.el.scrollTop !== b.top) b.el.scrollTo({ left: b.left, top: b.top, behavior: "instant" });
    }
    if (scrollX !== page.left || scrollY !== page.top) window.scrollTo({ ...page, behavior: "instant" });
  };
}

/** Scrolls to a stop; the page as it is (the first stop, in the normal case the only one) stays. */
function goTo(stop: Stop, elOf: (label: string) => Element | null) {
  if (stop.kind === "page") {
    if (stop.scroll.x === Math.round(scrollX) && stop.scroll.y === Math.round(scrollY)) return;
    return window.scrollTo({ left: stop.scroll.x, top: stop.scroll.y, behavior: "instant" });
  }
  const block = stop.whole ? "center" : "start";
  elOf(stop.label)?.scrollIntoView({ block, inline: block, behavior: "instant" });
}

const labelsOf = (stop: Stop) => (stop.kind === "page" ? stop.labels : [stop.label]);

/** The screenshots for the crops (or, with none, the page as it is), every scroll put back after. */
export async function shoot(host: HTMLElement, crops: readonly Crop[], now: Now): Promise<Shots> {
  const first = now();
  const els = crops.map((c) => (c.el?.isConnected ? c.el : null));
  const frames = first.frames.map((f, i) => {
    const el = els[i];
    return { label: f.label, rect: { ...f.rect, x: f.rect.x + scrollX, y: f.rect.y + scrollY }, nested: !!el && scrollingBoxes(el).length > 0, clipped: !!el && clipped(el) };
  });
  const root = document.scrollingElement ?? document.documentElement;
  const size = { w: innerWidth, h: innerHeight };
  const plan = planSweep(frames, { size, scroll: { x: scrollX, y: scrollY }, max: { x: root.scrollWidth - size.w, y: root.scrollHeight - size.h } });
  const elOf = (label: string) => els[first.frames.findIndex((f) => f.label === label)] ?? null;
  const restore = keepScrolls(els.filter((el): el is Element => el !== null));
  host.style.visibility = "hidden";
  try {
    if (!frames.length) {
      const shot = await screenshot();
      return { cuts: [{ shot, region: { label: null, rect: first.whole }, scene: first.scene, pasted: first.laid }], larger: [], missed: [] };
    }
    const cuts: Cut[] = [];
    for (const stop of plan.stops) {
      goTo(stop, elOf);
      const shot = await screenshot();
      const at = now();
      for (const label of labelsOf(stop)) {
        const frame = at.frames.find((f) => f.label === label);
        const rect = frame ? intersect(frame.rect, viewport()) : null;
        if (rect) cuts.push({ shot, region: { label, rect }, scene: at.scene, pasted: at.laid });
      }
    }
    cuts.sort((a, b) => (a.region.label ?? "").localeCompare(b.region.label ?? ""));
    const missed = frames.map((f) => f.label).filter((l) => !cuts.some((c) => c.region.label === l));
    return { cuts, larger: plan.larger.filter((l) => !missed.includes(l)), missed };
  } finally {
    restore();
    host.style.visibility = "";
  }
}
