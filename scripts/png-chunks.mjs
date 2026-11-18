// Fails when a PNG carries any chunk beyond the image itself (text, EXIF, XMP, time, ICC):
// the check behind "every image metadata-stripped". Usage: node scripts/png-chunks.mjs <png>...
import { readFileSync } from "node:fs";

const ALLOWED = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "sRGB", "gAMA", "cHRM", "pHYs", "bKGD"]);
let bad = 0;
for (const file of process.argv.slice(2)) {
  const png = readFileSync(file);
  const chunks = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    chunks.push(png.toString("latin1", at + 4, at + 8));
    at += 12 + length;
  }
  const extra = chunks.filter((c) => !ALLOWED.has(c));
  if (extra.length) {
    bad++;
    console.error(`${file}: metadata chunks ${extra.join(", ")}`);
  } else {
    console.log(`${file}: clean (${[...new Set(chunks)].join(" ")})`);
  }
}
process.exit(bad ? 1 : 0);
