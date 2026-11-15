"use client";

import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { type Area, parseBbox } from "@/lib/area";
import type { Bbox } from "@/lib/geo/world";
import { thermalTiles } from "@/lib/gibs";
import type { Dataset } from "@/lib/sample/dataset";
import { thresholds } from "@/lib/sample/stats";
import { cssVar, type Theme } from "@/lib/theme";
import { buildStyle, DATA_ANCHOR, FIRST_DATA_LAYER, MARKER_LAYERS, markerIcon } from "./map-style";
import { SELECTION_PITCH, useRaisedSelection } from "./useRaisedSelection";

export interface LayerFilters {
  viirs: ExpressionSpecification[];
  modis: ExpressionSpecification[];
  harm: ExpressionSpecification[];
}
export interface LayerVisibility {
  modis: boolean;
  viirs: boolean;
  harm: boolean;
  links: boolean;
}
export interface Camera {
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}

interface Props {
  ds: Dataset;
  mi: number;
  theme: Theme;
  initialCamera: Camera;
  label: string;
  className?: string;
  inset?: boolean;
  center?: [number, number] | null;
  filters?: LayerFilters;
  visibility?: LayerVisibility;
  area?: Area | null;
  selectedPoint?: [number, number] | null;
  projection?: "mercator" | "globe";
  overlay?: { layer: string; date: string } | null;
  drawing?: boolean;
  onDraw?: (bbox: Bbox | null) => void;
  onPickRecord?: (clusterId: string) => void;
  onPickObservation?: (detectionId: string) => void;
  onPickCountry?: (name: string) => void;
}

const NO_FILTERS: LayerFilters = { viirs: [], modis: [], harm: [] };
const ALL_VISIBLE: LayerVisibility = { modis: true, viirs: true, harm: true, links: true };

export function MapView({
  ds, mi, theme, initialCamera, label, className = "mapbox", inset = false, center = null,
  filters = NO_FILTERS, visibility = ALL_VISIBLE, area = null, selectedPoint = null, overlay = null,
  drawing = false, onDraw, onPickRecord, onPickObservation, onPickCountry, projection = "mercator",
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const camera = useRef<Camera>(initialCamera);
  const fittedArea = useRef<Area | null>(null);

  const handlers = useRef({ onPickRecord, onPickObservation, onPickCountry });
  useEffect(() => {
    handlers.current = { onPickRecord, onPickObservation, onPickCountry };
  });

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | undefined;

    (async () => {
      const [maplibre] = await Promise.all([import("maplibre-gl"), import("@/lib/maplibre")]);
      if (cancelled || !container.current) return;

      const m = new maplibre.Map({
        container: container.current,
        style: buildStyle(ds, theme),
        ...camera.current,
        interactive: !inset,
        maxPitch: 60,
        attributionControl: inset ? false : { compact: true },
        canvasContextAttributes: { antialias: true },
      });
      instance = m;

      const icons: Record<string, () => ReturnType<typeof markerIcon>> = {
        "marker-square": () => markerIcon("square", cssVar("--modis"), cssVar("--edge")),
        "marker-diamond": () => markerIcon("diamond", cssVar("--pale"), cssVar("--edge")),
      };
      m.setMissingStyleImageResolver((id) => {
        const image = icons[id]?.();
        if (image && !m.hasImage(id)) m.addImage(id, image, { pixelRatio: 2 });
      });

      if (!inset) {
        m.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-right");
        m.on("moveend", () => {
          const c = m.getCenter();
          camera.current = { center: [c.lng, c.lat], zoom: m.getZoom(), pitch: m.getPitch(), bearing: m.getBearing() };
        });
        m.on("click", (e) => {
          const { x, y } = e.point;
          const markers = MARKER_LAYERS.filter((id) => m.getLayer(id));
          const hit = m.queryRenderedFeatures([[x - 5, y - 5], [x + 5, y + 5]], { layers: [...markers] })[0];
          if (hit) {
            if (hit.layer.id === "harm") handlers.current.onPickRecord?.(String(hit.properties.cid));
            else handlers.current.onPickObservation?.(String(hit.properties.id));
            return;
          }
          const country = m.queryRenderedFeatures(e.point, { layers: ["country-hit"] })[0];
          if (country) handlers.current.onPickCountry?.(String(country.properties.name));
        });
        for (const id of MARKER_LAYERS) {
          m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
        }
      }

      m.once("load", () => {
        if (!cancelled) setMap(m);
      });
    })();

    return () => {
      cancelled = true;
      setMap(null);
      instance?.remove();
    };
  }, [ds, theme, inset]);

  useEffect(() => {
    if (!map) return;
    const inMonth: ExpressionSpecification = ["<", ["get", "u"], ["at", ["get", "r"], ["literal", thresholds(mi)]]];
    const all = (...conditions: ExpressionSpecification[]): FilterSpecification => ["all", inMonth, ...conditions];
    const isViirs: ExpressionSpecification = ["==", ["get", "sensor"], "VIIRS"];
    const isModis: ExpressionSpecification = ["==", ["get", "sensor"], "MODIS"];
    map.setFilter("heat", inMonth);
    map.setFilter("link-glow", inMonth);
    map.setFilter("link", inMonth);
    map.setFilter("viirs-glow", all(isViirs, ...filters.viirs));
    map.setFilter("viirs", all(isViirs, ...filters.viirs));
    map.setFilter("modis", all(isModis, ...filters.modis));
    map.setFilter("harm", all(...filters.harm));

    const show = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    show("viirs", visibility.viirs);
    show("viirs-glow", visibility.viirs);
    show("modis", visibility.modis);
    show("harm", visibility.harm);
    show("link", visibility.links);
    show("link-glow", visibility.links);
  }, [map, mi, filters, visibility]);

  useEffect(() => {
    if (!map) return;
    map.setProjection({ type: projection });
    if (projection === "globe" && map.getZoom() > 3.2) map.easeTo({ zoom: 2.6, duration: 600 });
  }, [map, projection]);

  useEffect(() => {
    if (!map) return;
    map.getSource<GeoJSONSource>("sel")?.setData({
      type: "FeatureCollection",
      features: selectedPoint ? [{ type: "Feature", geometry: { type: "Point", coordinates: selectedPoint }, properties: {} }] : [],
    });
  }, [map, selectedPoint]);

  useEffect(() => {
    if (map && center) map.jumpTo({ center });
  }, [map, center]);

  useRaisedSelection(inset ? null : map, area?.geometry ?? null, DATA_ANCHOR, theme);
  useEffect(() => {
    if (!map || inset) return;
    if (fittedArea.current === area) return;
    fittedArea.current = area;
    if (!area) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
      return;
    }
    const wide = map.getContainer().clientWidth > 1100;
    const [w, s, e, n] = area.bbox;
    map.fitBounds([[w, s], [e, n]], {
      padding: wide ? { left: 390, right: 400, top: 120, bottom: 90 } : 40,
      pitch: SELECTION_PITCH,
      maxZoom: 7,
      duration: 700,
    });
  }, [map, area, inset]);

  useEffect(() => {
    if (!map || !overlay) return;
    const tiles = thermalTiles(overlay.layer, overlay.date);
    if (!tiles) return;
    map.addSource("gibs-thermal", { type: "raster", tiles: [tiles], tileSize: 512, attribution: "Detections: NASA GIBS / FIRMS" });
    map.addLayer({ id: "gibs-thermal", type: "raster", source: "gibs-thermal" }, FIRST_DATA_LAYER);
    return () => {
      try {
        map.removeLayer("gibs-thermal");
        map.removeSource("gibs-thermal");
      } catch {
      }
    };
  }, [map, overlay]);

  return (
    <>
      <div ref={container} className={className} role={inset ? undefined : "application"} aria-label={inset ? undefined : label} aria-hidden={inset || undefined} />
      {drawing && map && onDraw ? (
        <DrawCapture
          onDone={(a, b) => {
            if (!a || !b) return onDraw(null);
            const p = map.unproject(a);
            const q = map.unproject(b);
            onDraw(parseBbox([Math.min(p.lng, q.lng), Math.min(p.lat, q.lat), Math.max(p.lng, q.lng), Math.max(p.lat, q.lat)].join(",")));
          }}
        />
      ) : null}
    </>
  );
}

type Pixel = [number, number];

function DrawCapture({ onDone }: { onDone: (a: Pixel | null, b: Pixel | null) => void }) {
  const [box, setBox] = useState<{ start: Pixel; end: Pixel } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone(null, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const at = (e: ReactPointerEvent<HTMLDivElement>): Pixel => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  return (
    <div
      className="draw-capture"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setBox({ start: at(e), end: at(e) });
      }}
      onPointerMove={(e) => {
        if (box) setBox({ start: box.start, end: at(e) });
      }}
      onPointerUp={(e) => {
        if (!box) return;
        const end = at(e);
        const moved = Math.abs(end[0] - box.start[0]) > 4 && Math.abs(end[1] - box.start[1]) > 4;
        onDone(moved ? box.start : null, moved ? end : null);
      }}
    >
      {box ? (
        <div
          className="drawbox"
          style={{
            left: Math.min(box.start[0], box.end[0]),
            top: Math.min(box.start[1], box.end[1]),
            width: Math.abs(box.end[0] - box.start[0]),
            height: Math.abs(box.end[1] - box.start[1]),
          }}
        />
      ) : null}
    </div>
  );
}
