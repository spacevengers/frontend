import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

mkdirSync(join("public", "geo"), { recursive: true });
copyFileSync(join(pkgDir("maplibre-gl"), "dist", "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.mjs"));
for (const file of ["countries-50m.json", "countries-110m.json"]) {
  copyFileSync(join(pkgDir("world-atlas"), file), join("public", "geo", file));
}
