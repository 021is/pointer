import { describe, expect, it } from "vitest";
import { cssColorToHex } from "../src/bundle/color";
import { keyStyles } from "../src/bundle/key-styles";

describe("cssColorToHex (Tailwind 4's computed colours)", () => {
  it("knows pure red in every space", () => {
    expect(cssColorToHex("lab(54.29 80.8 69.89)")).toBe("#ff0000");
    expect(cssColorToHex("oklch(0.628 0.2577 29.23)")).toBe("#ff0000");
    expect(cssColorToHex("oklch(62.8% 0.2577 29.23)")).toBe("#ff0000");
    expect(cssColorToHex("oklab(0.628 0.2249 0.1258)")).toBe("#ff0000");
  });

  it("gets white, black and a mid grey", () => {
    expect(cssColorToHex("lab(100 0 0)")).toBe("#ffffff");
    expect(cssColorToHex("oklch(0 0 0)")).toBe("#000000");
    expect(cssColorToHex("lab(50 0 0)")).toBe("#777777");
  });

  it("keeps alpha", () => {
    expect(cssColorToHex("oklch(1 0 0 / 0.5)")).toBe("#ffffff80");
  });

  it("returns null for anything else", () => {
    expect(cssColorToHex("rgb(1, 2, 3)")).toBeNull();
    expect(cssColorToHex("currentcolor")).toBeNull();
  });

  it("shortens the live page's lab() text colour in the style line", () => {
    expect(keyStyles({ color: "lab(95.357 -0.443876 -1.4321)" })).toMatch(/^color #f[0-9a-f]{5}$/);
  });
});
