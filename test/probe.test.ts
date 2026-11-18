import { describe, expect, it } from "vitest";
import { describeComponent } from "../src/source/frameworks";
import { readMessage } from "../src/source/protocol";

/** A DOM node as React leaves it in a dev build: a fiber under a "__reactFiber$…" key. */
const node = (fiber: object) => ({ "__reactFiber$x1": fiber, parentElement: null }) as unknown as Element;

function ScrollHandler() {}
function InnerScrollHandler() {}
function SiteMenu() {}
function Button() {}

describe("React: who rendered the element", () => {
  it("follows the owners, server components included, and drops Next's plumbing", async () => {
    const home = { name: "Home", env: "Server" };
    const page = { name: "HomePage", env: "Server", owner: home };
    const info = await describeComponent(
      node({ type: "h1", _debugOwner: { type: InnerScrollHandler, _debugOwner: page }, return: null }),
    );
    expect(info.framework).toBe("react");
    expect(info.chain).toEqual(["HomePage", "Home"]);
  });

  it("names memo and forwardRef components", async () => {
    const memo = { type: { render: Button } };
    const info = await describeComponent(node({ type: "button", _debugOwner: { type: memo } }));
    expect(info.chain).toEqual(["Button"]);
  });

  it("falls back to the parents when there are no owners (React 17)", async () => {
    const info = await describeComponent(
      node({ type: "div", return: { type: ScrollHandler, return: { type: SiteMenu, return: null } } }),
    );
    expect(info.chain).toEqual(["SiteMenu"]);
  });

  it("says why there is no file in a production build", async () => {
    const info = await describeComponent(node({ type: "div" }));
    expect(info.where).toEqual({ kind: "unknown", why: "no dev info on the element (production build?)" });
  });

  it("reads React 18's _debugSource", async () => {
    const info = await describeComponent(
      node({ type: "div", _debugSource: { fileName: "/app/src/Card.tsx", lineNumber: 7 } }),
    );
    expect(info.where).toEqual({ kind: "found", source: { file: "/app/src/Card.tsx", line: 7 } });
  });

  it("says where the element's component is used: its owner's JSX, in another file", async () => {
    const owner = { type: Button, _debugSource: { fileName: "/app/src/Menu.tsx", lineNumber: 3 } };
    const info = await describeComponent(
      node({ type: "button", _debugSource: { fileName: "/app/src/button.tsx", lineNumber: 52 }, _debugOwner: owner }),
    );
    expect(info.where).toEqual({
      kind: "found",
      source: { file: "/app/src/button.tsx", line: 52 },
      usedAt: { file: "/app/src/Menu.tsx", line: 3 },
    });
  });

  it("is silent when no framework is there", async () => {
    const plain = { parentElement: null } as unknown as Element;
    expect(await describeComponent(plain)).toEqual({ framework: "none", chain: [], where: { kind: "silent" } });
  });
});

describe("Vue and Svelte", () => {
  it("reads Vue 3's component and __file", async () => {
    const el = {
      parentElement: null,
      __vueParentComponent: { type: { __name: "EventCard", __file: "/app/src/EventCard.vue" }, parent: null },
    } as unknown as Element;
    expect(await describeComponent(el)).toEqual({
      framework: "vue",
      chain: ["EventCard"],
      where: { kind: "found", source: { file: "/app/src/EventCard.vue" } },
    });
  });

  it("reads Svelte's __svelte_meta", async () => {
    const el = { parentElement: null, __svelte_meta: { loc: { file: "src/lib/Nav.svelte", line: 12 } } } as unknown as Element;
    expect(await describeComponent(el)).toMatchObject({
      framework: "svelte",
      chain: ["Nav"],
      where: { kind: "found", source: { file: "src/lib/Nav.svelte", line: 12 } },
    });
  });
});

describe("readMessage (the probe's wire)", () => {
  const event = (detail: unknown) => new CustomEvent("x", { detail });

  it("reads a message with an id", () => {
    expect(readMessage(event('{"id":"p1"}'))).toEqual({ id: "p1" });
  });

  it("returns the cause for bad JSON or a missing id, never throws", () => {
    expect(readMessage(event("{oops"))).toBeInstanceOf(Error);
    expect(readMessage(event('{"no":"id"}'))).toEqual(new Error("a probe message without an id"));
  });

  it("ignores events that are not ours", () => {
    expect(readMessage(new Event("x"))).toBeNull();
    expect(readMessage(event({ id: "p1" }))).toBeNull();
  });
});
