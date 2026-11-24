// The narrow bar and its tool sheet in Chromium's device mode with touch, at phone and small
// tablet sizes, on the demo app (demo/: npm i && npm run dev) with the built extension (npm run
// build). It checks what a unit test cannot lay out: nothing off-screen, every target at least
// 44 px (a split button's ▾: 44 tall, 24 wide), the sheet at most 45% of the height, no tool both
// in the row and the sheet, every way to close the sheet (Esc, a tap outside, a finger dragging it
// down, a tool chosen), and the row's rhythm (Edvard, 2026-11-24, in Chrome on a Mac): each ▾
// narrower than its tool and against it, each cell wider than its name by its padding (so the
// selected look covers it), one even gap between cells. It prints one line per size and state,
// saves screenshots, and exits 1 on any problem.
// Usage: node scripts/narrow-check.mjs <playwright-core/index.mjs> <chromium> [out dir]
// (the screenshots go to the system's temp folder unless an out dir is given).
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [pw, executablePath, out = join(tmpdir(), "pointer-narrow-check")] = process.argv.slice(2);
if (!pw || !executablePath) throw new Error("usage: node scripts/narrow-check.mjs <playwright-core/index.mjs> <chromium> [out dir]");
const { chromium } = await import(pw);
const URL = "http://localhost:5173/";
const SIZES = [
  [320, 568],
  [375, 667],
  [390, 844],
  [430, 932],
  [530, 860],
  [600, 960],
  [700, 1000],
  [767, 1024],
];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath });
const problems = [];
const say = (size, state, msg) => problems.push(`${size} ${state}: ${msg}`);

async function open(w, h) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.addScriptTag({ path: "dist/probe.js" });
  // The worker, stubbed: the kept-marks store has nothing.
  await page.evaluate(() => {
    window.chrome = { runtime: { sendMessage: async () => ({ ok: true, saved: null }) } };
  });
  await page.addScriptTag({ path: "dist/content.js" });
  await page.waitForTimeout(250);
  return { context, page };
}

/** The row, the sheet, every seen button (where it sits), whether the sheet's body scrolls. */
const measure = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector("pointer-overlay").shadowRoot.querySelector(".bar");
    const r = (el) => el.getBoundingClientRect().toJSON();
    const buttons = [...bar.querySelectorAll("button")]
      .filter((b) => b.getClientRects().length > 0 && !b.closest(".menu"))
      .map((b) => ({
        name: b.dataset.name,
        label: b.getAttribute("aria-label"),
        caret: b.classList.contains("caret"),
        inSheet: !!b.closest(".sheet"),
        box: r(b),
      }));
    // The row's rhythm: its cells (a split button is one), each split button's tool and ▾, and each
    // named cell's width beside its name's (the name drawn with the cell's own font) and padding.
    const cells = [...bar.children].filter((c) => !c.classList.contains("sheet")).map(r);
    const groups = [...bar.children].filter((c) => c.matches(".drawgroup, .copygroup"));
    const pairs = groups
      .filter((g) => g.querySelector(":scope > .caret"))
      .map((g) => ({ name: g.firstElementChild.dataset.name, tool: r(g.firstElementChild), caret: r(g.querySelector(":scope > .caret")) }));
    const pen = document.createElement("canvas").getContext("2d");
    const named = [...bar.children]
      .flatMap((c) => (c.matches("button") ? [c] : groups.includes(c) ? [c.firstElementChild] : []))
      .map((b) => {
        const label = b.querySelector(".label");
        const style = label ? getComputedStyle(label) : getComputedStyle(b, "::after");
        pen.font = style.font;
        const text = pen.measureText(label ? label.textContent : b.dataset.name).width;
        const { paddingLeft, paddingRight } = getComputedStyle(b);
        return { name: b.dataset.name, width: r(b).width, text, padding: [parseFloat(paddingLeft), parseFloat(paddingRight)] };
      });
    const open = bar.dataset.more === "open";
    const sheet = bar.querySelector(".sheet");
    const body = bar.querySelector(".sheet-body");
    const scrolls = open && body ? body.scrollHeight > body.clientHeight + 1 : false;
    return { bar: r(bar), sheet: open && sheet ? r(sheet) : null, buttons, cells, pairs, named, scrolls, open };
  });

/** The row's rhythm: each ▾ narrower than its tool and against it, each name covered with padding
 *  either side, one even gap between cells. */
function rhythm(size, state, m) {
  for (const p of m.pairs) {
    if (p.caret.width >= p.tool.width) say(size, state, `${p.name}'s ▾ (${p.caret.width}) not narrower than its tool (${p.tool.width})`);
    if (Math.abs(p.caret.left - p.tool.right) > 1) say(size, state, `${p.name}'s ▾ is ${(p.caret.left - p.tool.right).toFixed(1)} px from its tool`);
    if (Math.abs(p.caret.height - p.tool.height) > 0.5) say(size, state, `${p.name}'s ▾ is not as tall as its tool`);
  }
  for (const n of m.named) {
    const [left, right] = n.padding;
    if (left < 4 || right < 4) say(size, state, `${n.name}'s cell has ${left}/${right} px padding`);
    // 1 px for the canvas's text measure against the laid-out glyphs (subpixel rounding).
    if (n.width + 1 < n.text + left + right) say(size, state, `${n.name}'s name (${n.text.toFixed(1)}) runs past its cell (${n.width})`);
  }
  const gaps = m.cells.slice(1).map((c, i) => c.left - (m.cells[i]?.right ?? c.left));
  if (gaps.some((g) => Math.abs(g - (gaps[0] ?? g)) > 0.6)) say(size, state, `uneven gaps between cells: ${gaps.map((g) => g.toFixed(1)).join(" ")}`);
}

const inside = (box, w, h) => box.left >= -0.5 && box.top >= -0.5 && box.right <= w + 0.5 && box.bottom <= h + 0.5;

function check(size, state, m, w, h) {
  if (!inside(m.bar, w, h)) say(size, state, "the bar is off-screen");
  if (m.sheet && !inside(m.sheet, w, h)) say(size, state, "the sheet is off-screen");
  if (m.sheet && m.sheet.height > 0.45 * h + 0.5) say(size, state, `sheet ${m.sheet.height.toFixed(0)} px > 45% of ${h}`);
  const row = m.buttons.filter((b) => !b.inSheet);
  rhythm(size, state, m);
  for (const b of m.buttons) {
    const { box } = b;
    const small = b.caret && !b.inSheet ? box.height < 44 - 0.01 || box.width < 24 - 0.01 : Math.min(box.width, box.height) < 44 - 0.01;
    if (small) say(size, state, `${b.name} target ${box.width.toFixed(1)}×${box.height.toFixed(1)}`);
    const frame = b.inSheet ? m.sheet : m.bar;
    const off = box.left < frame.left - 0.5 || box.right > frame.right + 0.5 || (!m.scrolls && (box.top < frame.top - 0.5 || box.bottom > frame.bottom + 0.5));
    if (off) say(size, state, `${b.name} outside its ${b.inSheet ? "sheet" : "row"}`);
    if (b.inSheet && row.some((r) => r.label === b.label)) say(size, state, `${b.name} both in the row and the sheet`);
  }
  const pct = (px) => `${((px / h) * 100).toFixed(0)}% of h`;
  const sheet = m.sheet ? `, sheet ${m.sheet.width.toFixed(0)}×${m.sheet.height.toFixed(0)} (${pct(m.sheet.height)})${m.scrolls ? " scrolls" : ""}` : "";
  return `${size} ${state}: row ${m.bar.width.toFixed(0)}×${m.bar.height.toFixed(0)} [${row.map((b) => b.name).join(" ")}]${sheet}`;
}

/** A finger dragging the sheet down from its handle, by touch events as device mode sends them. */
async function dragDown(context, page, sheet) {
  const cdp = await context.newCDPSession(page);
  const at = (y) => [{ x: sheet.left + sheet.width / 2, y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(sheet.top + 10) });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(sheet.top + 10 + i * 12) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const tap = (page, sel) => page.locator(`pointer-overlay ${sel}`).first().tap();

/** Waits for the sheet to be open or closed (2 s at most); one that never gets there is a problem
 *  named with its step, and the false tells the caller to stop this size. */
async function expectOpen(page, want, size, step) {
  const isOpen = (w) => (document.querySelector("pointer-overlay").shadowRoot.querySelector(".bar").dataset.more === "open") === w;
  const ok = await page.waitForFunction(isOpen, want, { timeout: 2000 }).then(
    () => true,
    () => false,
  );
  if (!ok) say(size, step, want ? "the sheet did not open" : "the sheet did not close");
  return ok;
}

/** Every step at one size, in order; false at the first step that went wrong (its problem said). */
async function walk(context, page, size, w, h, lines) {
  const more = async (step) => {
    await tap(page, "button.more-toggle");
    return expectOpen(page, true, size, step);
  };
  lines.push(check(size, "closed", await measure(page), w, h));
  await page.screenshot({ path: `${out}/${w}-0-bar.png` });
  if (!(await more("More"))) return false;
  lines.push(check(size, "open", await measure(page), w, h));
  await page.screenshot({ path: `${out}/${w}-1-sheet.png` });
  await tap(page, ".bar > .drawgroup button.draw");
  if (!(await expectOpen(page, false, size, "choosing Pen")) || !(await more("More with Pen"))) return false;
  const pen = await measure(page);
  if (!pen.buttons.some((b) => b.name === "Red")) say(size, "Pen", "no colours with Pen");
  lines.push(check(size, "open with Pen", pen, w, h));
  await tap(page, 'button[aria-label^="Undo"]');
  if (!(await measure(page)).open) {
    say(size, "Undo", "Undo closed the sheet");
    return false;
  }
  await page.keyboard.press("Escape");
  if (!(await expectOpen(page, false, size, "Esc")) || !(await more("More after Esc"))) return false;
  await page.touchscreen.tap(w / 2, 40);
  if (!(await expectOpen(page, false, size, "a tap outside")) || !(await more("More after a tap outside"))) return false;
  await dragDown(context, page, (await measure(page)).sheet);
  if (!(await expectOpen(page, false, size, "a drag down"))) return false;
  // A person lifts the finger before tapping again; Chrome makes no click of a tap that comes
  // within ~50 ms of a drag's end, so the robot waits as long as a fast person would.
  await page.waitForTimeout(300);
  if (!(await more("More after a drag down"))) return false;
  await tap(page, 'button[aria-label^="Copy gives the text only"]');
  await page.waitForTimeout(250);
  lines.push(check(size, "open in Text", await measure(page), w, h));
  return true;
}

const lines = [];
for (const [w, h] of SIZES) {
  const { context, page } = await open(w, h);
  await walk(context, page, `${w}×${h}`, w, h, lines);
  await context.close();
}
await browser.close();
console.log(lines.join("\n"));
console.log(problems.length ? `PROBLEMS (${problems.length}):\n${problems.join("\n")}` : "all checks passed");
if (problems.length) process.exit(1);
