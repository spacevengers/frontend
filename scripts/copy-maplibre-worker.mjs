// MapLibre v6 loads its web worker from a URL relative to its own module file.
// Once Turbopack bundles maplibre-gl, that relative path no longer exists, so we
// serve the worker from /public and point MapLibre at it (see FireMap.tsx).
// Runs before dev/build so the copy always matches the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.mjs"));
