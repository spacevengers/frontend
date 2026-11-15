import type { ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import { MAGMA } from "@/lib/color";
import { BLUE_MARBLE_TILES } from "@/lib/gibs";
import type { Dataset } from "@/lib/sample/dataset";
import { cssVar, type Theme } from "@/lib/theme";

export const DATA_ANCHOR = "data-anchor";
export const FIRST_DATA_LAYER = "heat";
export const MARKER_LAYERS = ["harm", "viirs", "modis"] as const;

const EMPTY = { type: "FeatureCollection" as const, features: [] };
const zoomRamp = (...stops: number[]): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], ...stops] as ExpressionSpecification;

export function buildStyle(ds: Dataset, theme: Theme): StyleSpecification {
  const dark = theme === "dark";
  const viirs: FilterSpecification = ["==", ["get", "sensor"], "VIIRS"];
  const modis: FilterSpecification = ["==", ["get", "sensor"], "MODIS"];

  const layers: LayerSpecification[] = [];
  layers.push(
    { id: "bg", type: "background", paint: { "background-color": dark ? "#000" : "#DDE9F5" } },
    { id: "bm", type: "raster", source: "bm", paint: dark
      ? { "raster-brightness-max": 0.6, "raster-saturation": -0.15, "raster-contrast": 0.12 }
      : { "raster-saturation": -0.05, "raster-contrast": 0.06 } },
  );
  layers.push(
    { id: "borders", type: "line", source: "borders", paint: { "line-color": dark ? "rgba(255,255,255,0.22)" : "rgba(15,42,71,0.35)", "line-width": 0.6 } },
    { id: "country-hit", type: "fill", source: "land", paint: { "fill-color": "#000", "fill-opacity": 0 } },
    { id: DATA_ANCHOR, type: "background", paint: { "background-opacity": 0 } },
    {
      id: "heat", type: "heatmap", source: "det", maxzoom: 9,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "frp"], 0, 0.1, 30, 0.6],
        "heatmap-intensity": zoomRamp(1, 0.6, 6, 1.1),
        "heatmap-radius": zoomRamp(1, 6, 4, 16, 7, 26),
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(0,0,0,0)", 0.08, "rgba(74,18,101,0.55)", 0.25, MAGMA[2], 0.45, MAGMA[3], 0.65, MAGMA[4], 0.85, MAGMA[5], 1, MAGMA[6],
        ],
        "heatmap-opacity": zoomRamp(3, 0.95, 6.5, dark ? 0.35 : 0.32),
      },
    },
    { id: "link-glow", type: "line", source: "links", minzoom: 3, paint: { "line-color": dark ? MAGMA[4] : MAGMA[3], "line-width": zoomRamp(4, 2, 10, 9), "line-blur": zoomRamp(4, 2, 10, 8), "line-opacity": 0.55 } },
    { id: "link", type: "line", source: "links", minzoom: 3, paint: { "line-color": dark ? MAGMA[6] : "#B3321C", "line-width": zoomRamp(4, 0.6, 10, 1.6), "line-opacity": 0.95 } },
    { id: "viirs-glow", type: "circle", source: "det", minzoom: 4.5, filter: viirs, paint: { "circle-color": cssVar("--viirs"), "circle-radius": zoomRamp(5, 4, 10, 14), "circle-blur": 1, "circle-opacity": 0.55 } },
    { id: "viirs", type: "circle", source: "det", minzoom: 4.5, filter: viirs, paint: { "circle-color": cssVar("--viirs"), "circle-radius": zoomRamp(5, 1.6, 10, 5), "circle-stroke-color": cssVar("--edge"), "circle-stroke-width": 0.6 } },
    { id: "modis", type: "symbol", source: "det", minzoom: 4.5, filter: modis, layout: { "icon-image": "marker-square", "icon-size": zoomRamp(5, 0.35, 10, 0.8), "icon-allow-overlap": true } },
    { id: "harm", type: "symbol", source: "harm", minzoom: 5.5, layout: { "icon-image": "marker-diamond", "icon-size": zoomRamp(6, 0.3, 10, 0.75), "icon-allow-overlap": true } },
    { id: "sel", type: "circle", source: "sel", paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 22, "circle-stroke-color": cssVar("--fg"), "circle-stroke-width": 1.5 } },
  );

  return {
    version: 8,
    sources: {
      bm: { type: "raster", tileSize: 256, maxzoom: 8, tiles: [BLUE_MARBLE_TILES], attribution: "Imagery: NASA GIBS Blue Marble" },
      land: { type: "geojson", data: ds.world.land, attribution: "Borders: Natural Earth" },
      borders: { type: "geojson", data: ds.world.borders },
      det: { type: "geojson", data: ds.geo.detections },
      harm: { type: "geojson", data: ds.geo.harmonized },
      links: { type: "geojson", data: ds.geo.links },
      sel: { type: "geojson", data: EMPTY },
    },
    layers,
  };
}

export function markerIcon(shape: "square" | "diamond", fill: string, stroke: string, size = 22) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.fillStyle = fill;
  g.strokeStyle = stroke;
  g.lineWidth = 2;
  const m = size / 2;
  g.beginPath();
  if (shape === "square") {
    g.rect(4, 4, size - 8, size - 8);
  } else {
    g.moveTo(m, 2);
    g.lineTo(size - 2, m);
    g.lineTo(m, size - 2);
    g.lineTo(2, m);
    g.closePath();
  }
  g.fill();
  g.stroke();
  return { width: size, height: size, data: new Uint8Array(g.getImageData(0, 0, size, size).data.buffer) };
}
