import { describe, expect, it } from "vitest";
import { commandFor } from "../src/ui/keys";

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe("commandFor", () => {
  it("maps letters to tools, either case", () => {
    expect(commandFor(key("p"), "page")).toEqual({ type: "tool", tool: "pick" });
    expect(commandFor(key("B"), "page")).toEqual({ type: "tool", tool: "box" });
    expect(commandFor(key("c"), "page")).toEqual({ type: "tool", tool: "comment" });
  });

  it("maps 1-3 to colours and nothing past them", () => {
    expect(commandFor(key("2"), "pen")).toEqual({ type: "color", color: "blue" });
    expect(commandFor(key("4"), "pen")).toBeNull();
  });

  it("walks the DOM with arrows only while picking", () => {
    expect(commandFor(key("ArrowUp"), "pick")).toEqual({ type: "walk", key: "ArrowUp" });
    expect(commandFor(key("ArrowUp"), "pen")).toBeNull();
    expect(commandFor(key("Enter"), "pick")).toEqual({ type: "pick-hover" });
  });

  it("takes Ctrl/Cmd+Z and +C, and leaves every other shortcut to the page", () => {
    expect(commandFor(key("z", { ctrlKey: true }), "pen")).toEqual({ type: "undo" });
    expect(commandFor(key("c", { metaKey: true }), "pen")).toEqual({ type: "copy" });
    expect(commandFor(key("p", { ctrlKey: true }), "pen")).toBeNull();
    expect(commandFor(key("p", { altKey: true }), "pen")).toBeNull();
  });

  it("knows Escape, I and S", () => {
    expect(commandFor(key("Escape"), "pen")).toEqual({ type: "escape" });
    expect(commandFor(key("i"), "pen")).toEqual({ type: "image" });
    expect(commandFor(key("s"), "pick")).toEqual({ type: "panel" });
  });

  it("Delete or Backspace removes one thing; with Shift (⇧⌫ on a Mac) it clears everything", () => {
    expect(commandFor(key("Backspace"), "move")).toEqual({ type: "remove" });
    expect(commandFor({ ...key("Backspace"), shiftKey: true }, "comment")).toEqual({ type: "clear" });
    expect(commandFor({ ...key("Delete"), shiftKey: true }, "pen")).toEqual({ type: "clear" });
  });
});
