"use client";

import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import { useEffect } from "react";
import { type AreaGeometry, bboxOf, worldMinus } from "@/lib/geo/world";
import { cssVar, type Theme } from "@/lib/theme";

export const SELECTION_PITCH = 30;
const WALL_PX = 20;
const DURATION_MS = 300;
const METRES_PER_PX_Z0 = 78271.5;
const BASE_HEIGHT = (WALL_PX / Math.sin((SELECTION_PITCH * Math.PI) / 180)) * METRES_PER_PX_Z0;

const heightAt = (base: number, k: number): ExpressionSpecification => [
  "interpolate", ["exponential", 0.5], ["zoom"], 0, base * k, 22, (base * k) / 2 ** 22,
];

let instances = 0;

export function useRaisedSelection(map: MapLibreMap | null, geometry: AreaGeometry | null, beforeId: string, theme: Theme) {
  useEffect(() => {
    if (!map || !geometry) return;
    // On a theme change this runs once more with the map MapView just removed; the new map re-runs it.
    try {
      if (!map.getLayer(beforeId)) return;
    } catch {
      return;
    }

    const n = ++instances;
    const id = { src: `selection-${n}`, mask: `selection-mask-${n}`, dim: `selection-dim-${n}`, glow: `selection-glow-${n}`, cliff: `selection-cliff-${n}`, top: `selection-top-${n}` };

    const [, south, , north] = bboxOf(geometry);
    const base = BASE_HEIGHT * Math.cos((((south + north) / 2) * Math.PI) / 180);

    let alive = true;
    const safely = (fn: () => void) => {
      if (!alive) return;
      try {
        fn();
      } catch {
        alive = false;
      }
    };

    safely(() => {
      map.addSource(id.src, { type: "geojson", data: geometry });
      map.addSource(id.mask, { type: "geojson", data: worldMinus(geometry) });
      map.addLayer({ id: id.dim, type: "fill", source: id.mask, paint: { "fill-color": cssVar("--dim"), "fill-opacity": 0 } }, beforeId);
      map.addLayer({ id: id.glow, type: "line", source: id.src, paint: { "line-color": cssVar("--cliff-glow"), "line-width": 14, "line-blur": 12, "line-opacity": 0 } }, beforeId);
      map.addLayer({ id: id.cliff, type: "fill-extrusion", source: id.src, paint: { "fill-extrusion-color": cssVar("--cliff"), "fill-extrusion-height": 0, "fill-extrusion-vertical-gradient": true } }, beforeId);
      map.addLayer({ id: id.top, type: "fill-extrusion", source: id.src, paint: { "fill-extrusion-color": theme === "dark" ? "#ffffff" : cssVar("--slab-top"), "fill-extrusion-base": 0, "fill-extrusion-height": 0, "fill-extrusion-vertical-gradient": false, "fill-extrusion-opacity": theme === "dark" ? 0.1 : 0.85 } }, beforeId);
    });

    let progress = 0;
    const apply = (value: number) => {
      // A frame timestamp can be slightly earlier than the tween's start time; keep k in 0..1.
      const k = Math.min(1, Math.max(0, value));
      progress = k;
      safely(() => {
        map.setPaintProperty(id.cliff, "fill-extrusion-height", heightAt(base, k));
        map.setPaintProperty(id.top, "fill-extrusion-base", heightAt(base, k));
        map.setPaintProperty(id.top, "fill-extrusion-height", heightAt(base, k * 1.03));
        map.setPaintProperty(id.dim, "fill-opacity", k);
        map.setPaintProperty(id.glow, "line-opacity", k);
      });
    };

    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const tween = (to: number, done?: () => void) => {
      cancelAnimationFrame(frame);
      const from = progress;
      const start = performance.now();
      const step = (now: number) => {
        const p = instant ? 1 : Math.min(1, (now - start) / DURATION_MS);
        apply(from + (to - from) * (1 - (1 - p) ** 3));
        if (p < 1 && alive) frame = requestAnimationFrame(step);
        else done?.();
      };
      frame = requestAnimationFrame(step);
    };

    tween(1);

    return () => {
      tween(0, () =>
        safely(() => {
          for (const layer of [id.top, id.cliff, id.glow, id.dim]) map.removeLayer(layer);
          map.removeSource(id.src);
          map.removeSource(id.mask);
        }),
      );
    };
  }, [map, geometry, beforeId, theme]);
}
