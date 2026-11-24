// The store screenshots (1280×800), taken on the demo app (demo/: npm i && npm run dev) with the
// built extension (npm run build). Usage: node scripts/screenshots.mjs <playwright-core> <chromium>
// Every PNG is written with its metadata stripped afterwards by scripts/icons.sh's convert step.
import { writeFileSync } from "node:fs";

const [pw, executablePath] = process.argv.slice(2);
if (!pw || !executablePath) throw new Error("usage: node scripts/screenshots.mjs <playwright-core/index.mjs> <chromium>");
const { chromium } = await import(pw);
const URL = "http://localhost:5173/";
const OUT = "store";

const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: URL });

async function open() {
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.exposeFunction("__shot", async () => `data:image/png;base64,${(await page.screenshot()).toString("base64")}`);
  await page.addScriptTag({ path: "dist/probe.js" });
  // The worker, stubbed: a capture is the page's own screenshot; the kept-marks store has nothing
  // (without `saved: null` Pointer says the kept marks are unreadable, in red, on every shot).
  await page.evaluate(() => {
    window.chrome = {
      runtime: { sendMessage: async (m) => (m.type === "capture" ? { ok: true, dataUrl: await window.__shot() } : { ok: true, saved: null }) },
    };
  });
  await page.addScriptTag({ path: "dist/content.js" });
  return page;
}
const box = async (page, sel) => (await page.locator(sel).first().boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

// 1. Pick a card's title: its style box opens, one edit; a comment beside it.
{
  const page = await open();
  await page.keyboard.press("p");
  const t = await box(page, ".card-title");
  await page.mouse.move(t.x + 20, t.y + 8);
  await page.waitForTimeout(300);
  await page.mouse.click(t.x + 20, t.y + 8);
  await page.waitForTimeout(300);
  const size = page.locator('pointer-overlay .panel .row[data-prop="font-size"] .val');
  if (await size.count()) {
    await size.fill("21px");
    await size.press("Enter");
  }
  await page.locator("pointer-overlay .bar button[aria-label^='Comment']").click();
  await page.mouse.click(t.x + t.width + 12, t.y + 4);
  await page.keyboard.type("Make the title bolder too");
  await page.keyboard.press("Enter");
  await page.mouse.move(640, 300);
  await page.waitForTimeout(200);
  await shot(page, "screenshot-1-pick");
  await page.close();
}

// 2. Crops A and B, an arrow, a box, comments.
{
  const page = await open();
  const hero = await box(page, ".hero-title");
  const grid = await box(page, ".grid");
  await page.keyboard.press("x");
  await page.mouse.move(hero.x - 10, hero.y - 10);
  await page.mouse.down();
  await page.mouse.move(hero.x + 560, hero.y + 210, { steps: 4 });
  await page.mouse.up();
  await page.mouse.move(grid.x - 8, grid.y - 8);
  await page.mouse.down();
  await page.mouse.move(grid.x + 760, grid.y + 270, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press("a");
  await page.mouse.move(hero.x + 640, hero.y + 40);
  await page.mouse.down();
  await page.mouse.move(hero.x + 470, hero.y + 70, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press("2");
  await page.keyboard.press("e");
  const btn = await box(page, ".button-primary");
  await page.mouse.move(btn.x - 12, btn.y - 10);
  await page.mouse.down();
  await page.mouse.move(btn.x + btn.width + 12, btn.y + btn.height + 10, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press("c");
  const chip = await box(page, ".chip-active");
  await page.mouse.click(chip.x + chip.width + 4, chip.y + 4);
  await page.keyboard.type("Chips should scroll on mobile");
  await page.keyboard.press("Enter");
  await shot(page, "screenshot-2-mark");
  await page.locator("pointer-overlay .bar button.caret").click();
  await page.waitForTimeout(1500);
  await shot(page, "screenshot-4-copy-menu");
  await page.locator("pointer-overlay .bar button.caret").click();
  await page.locator("pointer-overlay .bar button.copy").click();
  await page.waitForTimeout(2500);
  const png = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bytes = new Uint8Array(await (await item.getType("image/png")).arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  });
  writeFileSync(`${OUT}/copied.tmp.png`, Buffer.from(png, "base64"));
  await page.close();
}

// 3. What the agent gets: the copied picture on a dark stage.
{
  const page = await context.newPage();
  const img = `data:image/png;base64,${Buffer.from((await import("node:fs")).readFileSync(`${OUT}/copied.tmp.png`)).toString("base64")}`;
  await page.setContent(`<body style="margin:0;height:800px;display:flex;align-items:center;justify-content:center;gap:56px;background:radial-gradient(900px 500px at 20% 0%,#2a2058,#0a0a0a);font:600 30px/1.2 system-ui,sans-serif;color:#fff">
    <div style="max-width:330px"><div style="color:#b9a8ff;font-size:15px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px">One paste</div>What your coding agent gets: the picture, and the file:line of every mark.</div>
    <img src="${img}" style="max-height:740px;max-width:760px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6)"></body>`);
  await page.waitForTimeout(200);
  await shot(page, "screenshot-3-result");
  await page.close();
}
await browser.close();
