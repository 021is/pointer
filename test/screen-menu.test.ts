// @vitest-environment happy-dom
// The bar's one Screen button (Edvard, 2026-11-23: "one tool in bar and not more"): its menu holds
// Full, Tablet, Mobile and Custom with the current one checked; Custom's fields are checked before
// anything changes; the custom size is remembered in chrome.storage.local and checked coming back.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createScreenMenu } from "../src/screen/menu";
import type { Screen } from "../src/screen/sizes";
import { loadCustom, saveCustom } from "../src/screen/store";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function menu(current: Screen = { kind: "full" }, saved: { w: number; h: number } | null = null) {
  const choose = vi.fn();
  const m = createScreenMenu({ choose, tip: (b, text) => b.setAttribute("aria-label", text) });
  document.body.append(m.el);
  m.update(current, saved);
  const q = <T extends Element>(sel: string) => m.el.querySelector(sel) as T;
  const rows = () => [...m.el.querySelectorAll<HTMLButtonElement>(".item")];
  const row = (name: string) => rows().find((r) => r.querySelector(".name")?.textContent === name) as HTMLButtonElement;
  q<HTMLButtonElement>("button.screen").click();
  return { m, choose, q, rows, row };
}

describe("the Screen menu", () => {
  it("is one button whose menu lists the four screens, the current one checked", () => {
    const { m, rows, row } = menu({ kind: "mobile" });
    expect(m.el.querySelectorAll("button.screen")).toHaveLength(1);
    expect(rows().map((r) => r.querySelector(".name")?.textContent)).toEqual(["Full", "Tablet", "Mobile", "Custom…"]);
    expect(row("Mobile").getAttribute("aria-checked")).toBe("true");
    expect(row("Full").getAttribute("aria-checked")).toBe("false");
    expect(row("Tablet").querySelector(".cost")?.textContent).toBe("768 × 1024");
    expect(m.el.querySelector("button.screen")?.getAttribute("aria-pressed")).toBe("true");
    expect(m.el.querySelector("button.screen")?.getAttribute("aria-label")).toContain("Mobile · 390 × 844");
  });

  it("a size is chosen with one press, and the menu closes", () => {
    const { choose, row, q } = menu();
    row("Tablet").click();
    expect(choose).toHaveBeenCalledWith({ kind: "tablet" });
    expect(q<HTMLElement>(".screenmenu").hidden).toBe(true);
  });

  it("Custom opens its fields with the remembered size; a wrong side says why and changes nothing", () => {
    const { choose, row, q } = menu({ kind: "full" }, { w: 1366, h: 768 });
    expect(row("Custom…").querySelector(".cost")?.textContent).toBe("1366 × 768");
    row("Custom…").click();
    const [w, h] = [...q<HTMLElement>("form.custom").querySelectorAll("input")];
    expect(q<HTMLElement>("form.custom").hidden).toBe(false);
    expect([w?.value, h?.value]).toEqual(["1366", "768"]);
    if (w) w.value = "100";
    q<HTMLFormElement>("form.custom").requestSubmit();
    expect(q<HTMLElement>(".why").textContent).toBe("Width: between 240 and 3840 pixels.");
    expect(choose).not.toHaveBeenCalled();
    if (w) w.value = "1024";
    q<HTMLFormElement>("form.custom").requestSubmit();
    expect(choose).toHaveBeenCalledWith({ kind: "custom", size: { w: 1024, h: 768 } });
  });

  it("Esc closes it", () => {
    const { q } = menu();
    q<HTMLElement>(".screenmenu .item").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(q<HTMLElement>(".screenmenu").hidden).toBe(true);
  });
});

describe("the remembered custom size", () => {
  function storage(initial: Record<string, unknown>) {
    const data = { ...initial };
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: async (key: string) => (key in data ? { [key]: data[key] } : {}),
          set: async (items: Record<string, unknown>) => Object.assign(data, items),
        },
      },
    });
    return data;
  }

  it("is saved in chrome.storage.local and comes back", async () => {
    const data = storage({});
    expect(await loadCustom()).toBeNull();
    await saveCustom({ w: 1280, h: 720 });
    expect(data).toEqual({ "screen:custom": { w: 1280, h: 720 } });
    expect(await loadCustom()).toEqual({ w: 1280, h: 720 });
  });

  it("is refused, with its cause, when what comes back is not a size", async () => {
    storage({ "screen:custom": { w: 9000, h: 720 } });
    await expect(loadCustom()).rejects.toThrow("the saved custom size is not a size Pointer can use");
  });
});
