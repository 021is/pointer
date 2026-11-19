// Bundles the scripts Chrome loads and copies the manifest, the pages, the icons and 021's logo
// into dist/, the folder that is loaded unpacked. `--watch` rebuilds on every save. It also writes
// dist/lucide.js, Lucide's icons and tags (lucide-static, pinned to the version DanceClub web and
// 021.is use), which the icon picker injects only when it opens.
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import * as esbuild from "esbuild";

/** Lucide's icons as their inner SVG markup, with their tags: one global, read by src/icons/. */
async function lucide() {
  const dir = "node_modules/lucide-static";
  const nodes = JSON.parse(await readFile(`${dir}/icon-nodes.json`, "utf8"));
  const tags = JSON.parse(await readFile(`${dir}/tags.json`, "utf8"));
  const { version } = JSON.parse(await readFile(`${dir}/package.json`, "utf8"));
  const attrs = (a) => Object.entries(a).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, "&quot;")}"`).join("");
  const svg = Object.fromEntries(Object.entries(nodes).map(([name, parts]) => [name, parts.map(([tag, a]) => `<${tag}${attrs(a)}/>`).join("")]));
  const data = { version, svg, tags: Object.fromEntries(Object.keys(svg).map((name) => [name, tags[name] ?? []])) };
  await writeFile("dist/lucide.js", `globalThis.__pointerLucide=${JSON.stringify(data)};`);
  await copyFile(`${dir}/LICENSE`, "dist/LUCIDE-LICENSE.txt");
}

const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/ui/main.ts",
    probe: "src/source/probe.ts",
    preview: "src/preview.ts",
    welcome: "src/welcome.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome116",
  legalComments: "none",
  logLevel: "info",
};

await mkdir("dist/icons", { recursive: true });
await mkdir("dist/brand", { recursive: true });
for (const file of ["manifest.json", "welcome.html", "preview.html", "pages.css"]) await copyFile(file, `dist/${file}`);
for (const name of await readdir("icons")) {
  if (name.endsWith(".png")) await copyFile(`icons/${name}`, `dist/icons/${name}`);
}
for (const name of await readdir("brand")) await copyFile(`brand/${name}`, `dist/brand/${name}`);
await lucide();

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
