// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { selectorOf } from "../src/pick/describe";
import { walk } from "../src/pick/walk";

const byId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no #${id} in the fixture`);
  return el;
};

beforeEach(() => {
  document.body.innerHTML = `
    <main id="page">
      <section class="grid cols"><div id="a.b">x</div><div class="card">1</div><div class="card">2</div></section>
      <button data-testid="join:now">Join</button>
      <p id="1st">first</p>
    </main>`;
});

describe("selectorOf returns a selector that finds the element", () => {
  it.each(["a.b", "1st"])("escapes an id like %s, and the result finds it", (id) => {
    const el = byId(id);
    const selector = selectorOf(el);
    expect(selector).not.toBe(`#${id}`);
    expect(document.querySelector(selector)).toBe(el);
  });

  it("escapes a data-testid, and the result finds it", () => {
    const el = document.querySelector("button");
    if (!el) throw new Error("no button");
    expect(document.querySelector(selectorOf(el))).toBe(el);
  });

  it("tells siblings apart by position under a unique parent", () => {
    const second = document.querySelectorAll(".card")[1];
    if (!second) throw new Error("no second card");
    const selector = selectorOf(second);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(second);
  });
});

describe("walk with the arrow keys", () => {
  it("goes up, then retraces the way back down", () => {
    const trail: Element[] = [];
    const start = document.querySelectorAll(".card")[0];
    if (!start) throw new Error("no card");
    const up = walk(start, "ArrowUp", trail);
    expect(up.tagName).toBe("SECTION");
    expect(walk(up, "ArrowUp", trail)).toBe(byId("page"));
    expect(walk(byId("page"), "ArrowDown", trail)).toBe(up);
    expect(walk(up, "ArrowDown", trail)).toBe(start);
  });

  it("goes to the first child when there is no way back", () => {
    expect(walk(byId("page"), "ArrowDown", []).tagName).toBe("SECTION");
  });

  it("moves between siblings and stays put at the ends", () => {
    const first = byId("a.b");
    expect(walk(first, "ArrowRight", []).textContent).toBe("1");
    expect(walk(first, "ArrowLeft", [])).toBe(first);
  });

  it("never climbs past body", () => {
    expect(walk(document.body, "ArrowUp", [])).toBe(document.body);
  });
});
