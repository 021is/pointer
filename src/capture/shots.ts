// The screenshots a picture is cut from (sweep.ts plans them): Pointer's layer hidden, the page
// scrolled to each stop, the tab captured there (the worker paces the captures: Chrome takes two
// a second), then every scroll put back exactly where it was, the window's last. With no crop,
// or every crop in view, it is the one screenshot of the page as it is.

import type { Scene } from "../marks/svg";
import type { Crop } from "../marks/types";
import { type Rect, intersect } from "../shared/geometry";
import { tabViewport } from "../shared/view";
import type { Region } from "./layout";
import { type Laid, screenshot } from "./picture";
import { type Outcome, type Stop, planSweep } from "./sweep";

/** A part of one screenshot to show, with the marks and pasted images as they lay at that stop. */
export type Cut = { shot: HTMLImageElement; region: Region; scene: Scene; pasted: readonly Laid[] };

/** The page now, in viewport coordinates: the crop frames, the scene, the pasted images, and the
 *  region to show when there is no crop (one crop around every mark). */
export type Now = () => { frames: readonly { label: string; rect: Rect }[]; scene: Scene; laid: readonly Laid[]; whole: Rect };

/** The cuts in the crops' order, and what became of the crops not wholly in them. */
export type Shots = Outcome & { cuts: Cut[] };

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

/** Scrolls to a stop; the page as it is (the first stop, in the normal case the only one) stays.
 *  False when a nested crop's element has left the page since the plan: nothing to scroll to. */
function goTo(stop: Stop, elOf: (label: string) => Element | null): boolean {
  if (stop.kind === "page") {
    const here = stop.scroll.x === Math.round(scrollX) && stop.scroll.y === Math.round(scrollY);
    if (!here) window.scrollTo({ left: stop.scroll.x, top: stop.scroll.y, behavior: "instant" });
    return true;
  }
  const el = elOf(stop.label);
  if (!el?.isConnected) return false;
  const block = stop.whole ? "center" : "start";
  el.scrollIntoView({ block, inline: block, behavior: "instant" });
  return true;
}

const labelsOf = (stop: Stop) => (stop.kind === "page" ? stop.labels : [stop.label]);

/** The screenshots for the crops (or, with none, the page as it is), every scroll put back after. */
export async function shoot(host: HTMLElement, crops: readonly Crop[], now: Now): Promise<Shots> {
  const first = now();
  const els = crops.map((c) => (c.el?.isConnected ? c.el : null));
  const frames = first.frames.map((f, i) => {
    const el = els[i];
    const rect = { ...f.rect, x: f.rect.x + scrollX, y: f.rect.y + scrollY };
    return { label: f.label, rect, nested: !!el && scrollingBoxes(el).length > 0, clipped: !!el && clipped(el) };
  });
  const root = document.scrollingElement ?? document.documentElement;
  const size = tabViewport();
  const plan = planSweep(frames, { size, scroll: { x: scrollX, y: scrollY }, max: { x: root.scrollWidth - size.w, y: root.scrollHeight - size.h } });
  const order = (label: string | null) => first.frames.findIndex((f) => f.label === label);
  const elOf = (label: string) => els[order(label)] ?? null;
  const restore = keepScrolls(els.filter((el): el is Element => el !== null));
  host.style.visibility = "hidden";
  try {
    if (!frames.length) {
      const shot = await screenshot();
      return { cuts: [{ shot, region: { label: null, rect: first.whole }, scene: first.scene, pasted: first.laid }], larger: [], gone: [], unseen: [] };
    }
    const cuts: Cut[] = [];
    const gone: string[] = [];
    const unseen: string[] = [];
    for (const stop of plan.stops) {
      if (!goTo(stop, elOf)) {
        gone.push(...labelsOf(stop));
        continue;
      }
      const shot = await screenshot();
      const at = now();
      for (const label of labelsOf(stop)) {
        const frame = at.frames.find((f) => f.label === label);
        const rect = frame ? intersect(frame.rect, tabViewport()) : null;
        if (rect) cuts.push({ shot, region: { label, rect }, scene: at.scene, pasted: at.laid });
        else unseen.push(label);
      }
    }
    cuts.sort((a, b) => order(a.region.label) - order(b.region.label));
    return { cuts, larger: plan.larger.filter((l) => cuts.some((c) => c.region.label === l)), gone, unseen };
  } finally {
    restore();
    host.style.visibility = "";
  }
}
