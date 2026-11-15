// Import this module (client-side only) before creating any MapLibre map:
//   import "@/lib/maplibre";
//
// MapLibre v6 resolves its web worker relative to its own module URL. After
// Turbopack bundles maplibre-gl that file is gone, the worker 404s, and the
// map renders blank. scripts/copy-maplibre-worker.mjs copies the worker into
// /public on predev/prebuild; this points MapLibre at that copy.
//
// The map component must be loaded with next/dynamic and { ssr: false }
// because MapLibre touches `window`.

import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";

setWorkerUrl("/maplibre-gl-worker.mjs");
