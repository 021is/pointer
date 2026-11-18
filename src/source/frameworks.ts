// Runs in the page's own world (see probe.ts): reads what a dev build leaves on DOM nodes to name
// the component and, where it can, the file and line that wrote the element.
// React (fibers), Vue 2/3, Svelte 4/5, Angular. A production build leaves little; that is said.

import type { ComponentInfo, Source } from "../bundle/types";
import { appFrames, cleanSourcePath, isDependency, parseStack } from "./stack";
import { resolveFrame } from "./resolve";

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose | null => (v !== null && typeof v === "object" ? (v as Loose) : null);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const prop = (target: unknown, key: string): unknown =>
  target !== null && (typeof target === "object" || typeof target === "function")
    ? (target as Loose)[key]
    : undefined;

const MAX_CHAIN = 4;
const UP_LEVELS = 12;

/** Framework and router plumbing that would only crowd the chain. */
const PLUMBING =
  /^(Inner|Outer)?(LayoutRouter|ScrollAndFocusHandler|ScrollHandler)$|^LinkComponent$|^(Redirect|HTTPAccessFallback|Loading|Error|DevRootHTTPAccessFallback|Metadata|Viewport)(Error)?Boundary(Handler)?$|^(Router|AppRouter|HotReload|ReactDevOverlay|ServerRoot|Root|RenderFromTemplateContext|ClientPageRoot|ClientSegmentRoot|SegmentViewNode|SegmentStateProvider|Suspense|Fragment|StrictMode|Head|Link|Image)$|Provider$|Context$|^AppDevOverlay/;

function usable(name: string | undefined): name is string {
  return !!name && name.length > 2 && /^[A-Z]/.test(name) && !PLUMBING.test(name);
}

function reactName(type: unknown): string | undefined {
  if (typeof type === "function") return str(prop(type, "displayName")) ?? str(prop(type, "name"));
  const t = obj(type);
  if (!t) return undefined;
  const render = t.render;
  if (typeof render === "function") return str(t.displayName) ?? reactName(render);
  if (t.type) return str(t.displayName) ?? reactName(t.type);
  return undefined;
}

function reactFiber(el: Element): Loose | null {
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$")) return obj((el as unknown as Loose)[key]);
  }
  return null;
}

type Found = { source?: Source; usedAt?: Source; note?: string };

/** Where one fiber's JSX was written: React ≤18's _debugSource, or React 19's _debugStack. */
async function fiberSource(fiber: Loose): Promise<Found> {
  const legacy = obj(fiber._debugSource);
  const fileName = str(legacy?.fileName);
  if (fileName) {
    const line = legacy?.lineNumber;
    return { source: { file: cleanSourcePath(fileName), line: typeof line === "number" ? line : undefined } };
  }
  const stack = str(prop(fiber._debugStack, "stack"));
  if (!stack) return { note: "no dev info on the element (production build?)" };
  let note = "written inside a dependency";
  for (const frame of appFrames(parseStack(stack)).slice(0, 6)) {
    const found = await resolveFrame(frame);
    if (found.source && !isDependency(found.source.file)) return { source: found.source };
    if (found.note) note = found.note;
  }
  return { note };
}

/**
 * The element's own JSX first; when that sits in a dependency (an <a> inside next/link), the
 * nearest parent whose JSX is the app's: the <Link> in the app's own file. Then `usedAt`: the
 * next file up, so a shared component (button.tsx) also says where this one is used.
 */
async function reactSource(fiber: Loose): Promise<Found> {
  let first: Found | null = null;
  let source: Source | undefined;
  let tried = 0;
  for (let f: Loose | null = fiber; f && tried < 12; f = obj(f.return)) {
    if (!f._debugStack && !f._debugSource) continue;
    tried++;
    const found = await fiberSource(f);
    if (source) {
      if (found.source && found.source.file !== source.file) return { source, usedAt: found.source };
    } else if (found.source) {
      source = found.source;
    } else {
      first ??= found;
    }
  }
  if (source) return { source };
  return first ?? { note: "no dev info on the element (production build?)" };
}

/** Who rendered the element: React's owners (server components included, by name). */
function ownerChain(fiber: Loose): string[] {
  const chain: string[] = [];
  let o = obj(fiber._debugOwner);
  for (let i = 0; o && chain.length < MAX_CHAIN && i < 40; i++) {
    const name = str(o.name) ?? reactName(o.type);
    if (usable(name) && chain.at(-1) !== name) chain.push(name);
    o = obj(o._debugOwner) ?? obj(o.owner);
  }
  return chain;
}

/** React ≤17 has no owners: the component parents instead. */
function parentChain(fiber: Loose): string[] {
  const chain: string[] = [];
  for (let f: Loose | null = obj(fiber.return); f && chain.length < MAX_CHAIN; f = obj(f.return)) {
    const name = typeof f.type === "string" ? undefined : reactName(f.type);
    if (usable(name) && chain.at(-1) !== name) chain.push(name);
  }
  return chain;
}

async function react(el: Element): Promise<ComponentInfo | null> {
  let fiber = reactFiber(el);
  for (let up = el.parentElement, i = 0; !fiber && up && i < UP_LEVELS; up = up.parentElement, i++) {
    fiber = reactFiber(up);
  }
  if (!fiber) return null;
  const owners = ownerChain(fiber);
  const chain = owners.length ? owners : parentChain(fiber);
  const { source, usedAt, note } = await reactSource(fiber);
  return { framework: "react", chain, source, usedAt, sourceNote: note };
}

const baseName = (file: string | undefined) => file?.split("/").pop()?.replace(/\.\w+$/, "");

function vue(el: Element): ComponentInfo | null {
  for (let node: Element | null = el, i = 0; node && i < UP_LEVELS; node = node.parentElement, i++) {
    const v3 = obj(prop(node, "__vueParentComponent"));
    const v2 = obj(prop(node, "__vue__"));
    if (!v3 && !v2) continue;
    const chain: string[] = [];
    let file: string | undefined;
    for (let inst = v3 ?? v2; inst && chain.length < MAX_CHAIN; inst = obj(v3 ? inst.parent : inst.$parent)) {
      const type = obj(v3 ? inst.type : inst.$options) ?? {};
      const f = str(type.__file);
      file ??= f;
      const name = str(type.name) ?? str(type.__name) ?? str(inst._componentTag) ?? baseName(f);
      if (name && chain.at(-1) !== name) chain.push(name);
    }
    const source = file ? { file: cleanSourcePath(file) } : undefined;
    return { framework: "vue", chain, source, sourceNote: source ? undefined : "no __file (production build?)" };
  }
  return null;
}

function svelte(el: Element): ComponentInfo | null {
  for (let node: Element | null = el, i = 0; node && i < UP_LEVELS; node = node.parentElement, i++) {
    const loc = obj(prop(prop(node, "__svelte_meta"), "loc"));
    const file = str(loc?.file);
    if (!file) continue;
    const line = typeof loc?.line === "number" ? loc.line : undefined;
    const name = baseName(file);
    return { framework: "svelte", chain: name ? [name] : [], source: { file: cleanSourcePath(file), line } };
  }
  return null;
}

function angular(el: Element): ComponentInfo | null {
  const ng = obj((window as unknown as Loose).ng);
  if (!ng) return null;
  const call = (fn: unknown) => (typeof fn === "function" ? (fn as (e: Element) => unknown)(el) : null);
  const component = call(ng.getComponent) ?? call(ng.getOwningComponent);
  const name = str(prop(prop(component, "constructor"), "name"));
  if (!name) return null;
  return { framework: "angular", chain: [name], sourceNote: "Angular does not expose its files" };
}

export async function describeComponent(el: Element): Promise<ComponentInfo> {
  return (
    (await react(el)) ?? vue(el) ?? svelte(el) ?? angular(el) ?? { framework: "none", chain: [] }
  );
}
