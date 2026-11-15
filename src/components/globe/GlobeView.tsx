"use client";

import type { GlobeInstance } from "globe.gl";
import { useEffect, useRef, useState } from "react";
import type { Area } from "@/lib/area";
import { densityColor } from "@/lib/color";
import { fmt } from "@/lib/format";
import { type AreaGeometry, bboxOf, contains, type CountryFeature, inBbox } from "@/lib/geo/world";
import { blueMarbleCrop, blueMarbleImage } from "@/lib/gibs";
import { HOME } from "@/lib/home";
import type { Dataset } from "@/lib/sample/dataset";
import { cssVar, type Theme } from "@/lib/theme";

export interface GlobeCallout {
  name: string;
  lon: number;
  lat: number;
  harmonized: number;
  viirs: number;
  modis: number;
}

interface Props {
  ds: Dataset;
  points: { lat: number; lng: number; w: number }[];
  area: Area | null;
  theme: Theme;
  callout: GlobeCallout | null;
  label: string;
  onPickCountry: (name: string | null) => void;
}

interface HexBin {
  sumWeight: number;
  points: { lat: number; lng: number }[];
}
type PolygonDatum = { properties: { name: string }; geometry: AreaGeometry; capMaterial?: object };

const GROUND = 0.004;
const SLAB = 0.035;
const COLUMN_PER_RECORD = 0.001;
const DRAWN_AREA = "__drawn_area__";
const START = { lat: HOME.lat, lng: HOME.lon, altitude: 1.05 };

const el = (tag: string, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function calloutElement(c: GlobeCallout) {
  const root = el("div", "callout");
  root.append(el("span", "ring"));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100");
  svg.setAttribute("height", "40");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", "0,0 60,34 96,34");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "var(--fg)");
  line.setAttribute("stroke-width", "1");
  svg.append(line);
  root.append(svg);

  const box = el("div", "box");
  box.append(el("b", undefined, c.name), el("span", "muted", `${fmt(c.harmonized)} harmonized records`));
  const mini = el("div", "mini");
  const bar = (label: string, value: number, width: number, color: string) => {
    const fill = el("i");
    fill.style.width = `${width}%`;
    fill.style.background = color;
    mini.append(el("span", undefined, label), fill, el("span", "num", fmt(value)));
  };
  bar("VIIRS", c.viirs, 100, "var(--hot)");
  bar("MODIS", c.modis, (c.modis / Math.max(c.viirs, 1)) * 100, "var(--cool)");
  box.append(mini);
  root.append(box);
  return root;
}

function lightTexture(countries: CountryFeature[]): Promise<string | null> {
  const width = 4096;
  const height = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) return Promise.resolve(null);
  g.fillStyle = "#B9D3EE";
  g.fillRect(0, 0, width, height);
  g.fillStyle = "#F7FAFD";
  g.strokeStyle = "rgba(15,42,71,0.28)";
  g.lineWidth = 1.2;
  for (const f of countries) {
    const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    g.beginPath();
    for (const polygon of polygons) {
      for (const ring of polygon) {
        ring.forEach(([lon, lat], i) => {
          const x = ((lon + 180) / 360) * width;
          const y = ((90 - lat) / 180) * height;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.closePath();
      }
    }
    g.fill("evenodd");
    g.stroke();
  }
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/png"));
}

export function GlobeView({ ds, points, area, theme, callout, label, onPickCountry }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [globe, setGlobe] = useState<GlobeInstance | null>(null);

  const handlers = useRef({ onPickCountry, area });
  useEffect(() => {
    handlers.current = { onPickCountry, area };
  });

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let cancelled = false;
    let instance: GlobeInstance | undefined;
    let observer: ResizeObserver | undefined;

    (async () => {
      const { default: Globe } = await import("globe.gl");
      if (cancelled) return;
      const g = new Globe(host, { animateIn: false, rendererConfig: { antialias: true, alpha: true } })
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereAltitude(0.17)
        .hexBinPointWeight("w")
        .hexBinResolution(3)
        .hexMargin(0.3)
        .hexBinMerge(true)
        .hexTransitionDuration(0)
        .polygonsTransitionDuration(300)
        .polygonLabel((d) => el("span", undefined, (d as PolygonDatum).properties.name === DRAWN_AREA ? "Selected area" : (d as PolygonDatum).properties.name))
        .htmlElement((d) => calloutElement(d as GlobeCallout))
        .htmlLat((d) => (d as GlobeCallout).lat)
        .htmlLng((d) => (d as GlobeCallout).lon)
        .htmlAltitude(0.03)
        .onPolygonClick((d) => {
          const name = (d as PolygonDatum).properties.name;
          const current = handlers.current.area;
          const isCurrent = name === DRAWN_AREA || (current?.kind === "country" && current.name === name);
          handlers.current.onPickCountry(isCurrent ? null : name);
        })
        .onGlobeClick(() => handlers.current.onPickCountry(null))
        .pointOfView(START, 0);

      const controls = g.controls();
      controls.minDistance = 125;
      controls.maxDistance = 420;

      const resize = () => g.width(host.clientWidth).height(host.clientHeight);
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(host);
      instance = g;
      // A globe.gl instance is a function. Passed bare, React would call it as a state updater.
      setGlobe(() => g);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      setGlobe(null);
      instance?._destructor();
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!globe) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    const material = globe.globeMaterial() as unknown as { color: { set(color: string): void } };
    if (theme === "dark") {
      material.color.set("#AEB7C2");
      globe.globeImageUrl(blueMarbleImage(4096, 2048)).atmosphereColor("#3D86E0");
    } else {
      material.color.set("#FFFFFF");
      globe.atmosphereColor("#9CC4EE");
      lightTexture(ds.world.land.features).then((url) => {
        if (cancelled || !url) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        globe.globeImageUrl(url);
      });
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [globe, theme, ds]);

  useEffect(() => {
    if (!globe) return;
    const low = ds.world.countriesLow as PolygonDatum[];
    const selected = area ? (area.kind === "country" ? area.name : DRAWN_AREA) : null;
    const needsOwnPolygon = area && !low.some((d) => d.properties.name === selected);
    let data: PolygonDatum[] = needsOwnPolygon ? [...low, { properties: { name: selected as string }, geometry: area.geometry }] : low;
    const dark = theme === "dark";
    let cancelled = false;
    const disposables: { dispose(): void }[] = [];

    if (dark && selected) {
      const whole = data.find((d) => d.properties.name === selected);
      if (whole) {
        const parts = whole.geometry.type === "Polygon" ? [whole.geometry.coordinates] : whole.geometry.coordinates;
        const pieces: PolygonDatum[] = parts.map((coordinates) => ({ properties: { name: selected }, geometry: { type: "Polygon", coordinates } }));
        data = [...data.filter((d) => d !== whole), ...pieces];
        import("three").then((THREE) => {
          if (cancelled) return;
          const loader = new THREE.TextureLoader();
          for (const piece of pieces) {
            const box = bboxOf(piece.geometry);
            const url = box[2] - box[0] < 180 ? blueMarbleCrop(box) : null;
            if (!url) continue;
            loader.load(url, (texture) => {
              disposables.push(texture);
              if (cancelled) return;
              texture.colorSpace = THREE.SRGBColorSpace;
              const material = new THREE.MeshBasicMaterial({ map: texture });
              disposables.push(material);
              piece.capMaterial = material;
              globe.polygonCapMaterial((d) => (d as PolygonDatum).capMaterial as never);
            });
          }
        });
      }
    }

    const cliff = cssVar("--cliff");
    const edge = dark ? cssVar("--fg") : "#FFFFFF";
    const top = dark ? "rgba(120,140,165,0.35)" : cssVar("--slab-top");
    const dim = selected ? cssVar("--dim") : "rgba(0,0,0,0)";
    const border = dark ? "rgba(255,255,255,0.22)" : "rgba(15,42,71,0.2)";
    const isSelected = (d: object) => (d as PolygonDatum).properties.name === selected;

    globe
      .polygonsData(data)
      .polygonGeoJsonGeometry((d) => (d as PolygonDatum).geometry as never)
      .polygonAltitude((d) => (isSelected(d) ? SLAB : GROUND))
      .polygonCapColor((d) => (isSelected(d) ? top : dim))
      .polygonSideColor((d) => (isSelected(d) ? cliff : "rgba(0,0,0,0)"))
      .polygonStrokeColor((d) => (isSelected(d) ? edge : border))
      .polygonCapMaterial((d) => (d as PolygonDatum).capMaterial as never);

    return () => {
      cancelled = true;
      for (const d of disposables) d.dispose();
    };
  }, [globe, ds, area, theme]);

  useEffect(() => {
    if (!globe) return;
    const onSlab = (c: { lat: number; lng: number }) => {
      if (!area || !inBbox(area.bbox, c.lng, c.lat)) return false;
      return area.kind === "bbox" || contains(area.geometry, c.lng, c.lat);
    };
    globe
      .hexBinPointsData(points)
      .hexAltitude((d) => (onSlab((d as HexBin).points[0]) ? SLAB : 0) + Math.min((d as HexBin).sumWeight, 130) * COLUMN_PER_RECORD)
      .hexTopColor((d) => densityColor((d as HexBin).sumWeight))
      .hexSideColor((d) => densityColor((d as HexBin).sumWeight * 0.55));
  }, [globe, points, area]);

  useEffect(() => {
    globe?.htmlElementsData(callout ? [callout] : []);
  }, [globe, callout]);

  useEffect(() => {
    if (!globe || !area) return;
    const [w, s, e, n] = area.bbox;
    const span = Math.max(e - w, n - s);
    globe.pointOfView({ lat: (s + n) / 2, lng: (w + e) / 2, altitude: Math.min(1.6, Math.max(0.55, span / 45)) }, 900);
  }, [globe, area]);

  return <div ref={container} className="mapbox" role="application" aria-label={label} />;
}
