// Bundles the three scripts Chrome loads and copies the manifest and the icons into dist/, the
// folder that is loaded unpacked. `--watch` rebuilds on every save.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/ui/main.ts",
    probe: "src/source/probe.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome116",
  legalComments: "none",
  logLevel: "info",
};

await mkdir("dist/icons", { recursive: true });
await copyFile("manifest.json", "dist/manifest.json");
for (const name of await readdir("icons")) {
  if (name.endsWith(".png")) await copyFile(`icons/${name}`, `dist/icons/${name}`);
}

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
