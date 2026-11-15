import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export type Bbox = [west: number, south: number, east: number, north: number];
export type AreaGeometry = Polygon | MultiPolygon;
export type CountryFeature = Feature<AreaGeometry, { name: string }>;

export interface Country {
  name: string;
  bbox: Bbox;
  feature: CountryFeature;
}

export interface World {
  countries: Country[];
  land: FeatureCollection<AreaGeometry, { name: string }>;
  borders: MultiLineString;
  countriesLow: CountryFeature[];
  byName: Map<string, Country>;
}

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

async function fetchTopology(file: string): Promise<CountriesTopology> {
  const res = await fetch(`/geo/${file}`);
  if (!res.ok) throw new Error(`Could not load country outlines (${res.status} on /geo/${file})`);
  return (await res.json()) as CountriesTopology;
}

function toFeatures(topology: CountriesTopology): CountryFeature[] {
  const collection = feature(topology, topology.objects.countries) as FeatureCollection<AreaGeometry, { name: string }>;
  return collection.features.filter((f) => f.properties?.name && f.properties.name !== "Antarctica");
}

let worldPromise: Promise<World> | undefined;

export function loadWorld(): Promise<World> {
  worldPromise ??= Promise.all([fetchTopology("countries-50m.json"), fetchTopology("countries-110m.json")]).then(
    ([hi, lo]) => {
      const features = toFeatures(hi);
      const countries = features.map((f) => ({ name: f.properties.name, bbox: bboxOf(f.geometry), feature: f }));
      return {
        countries,
        land: { type: "FeatureCollection", features },
        borders: mesh(hi, hi.objects.countries, (a, b) => a !== b),
        countriesLow: toFeatures(lo),
        byName: new Map(countries.map((c) => [c.name, c])),
      };
    },
  );
  worldPromise.catch(() => {
    worldPromise = undefined;
  });
  return worldPromise;
}

const rings = (g: AreaGeometry) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

export function bboxOf(geometry: AreaGeometry): Bbox {
  let w = 180, s = 90, e = -180, n = -90;
  for (const polygon of rings(geometry)) {
    for (const [lon, lat] of polygon[0]) {
      if (lon < w) w = lon;
      if (lon > e) e = lon;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
  }
  return [w, s, e, n];
}

export const inBbox = (b: Bbox, lon: number, lat: number) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];

function inRing(ring: number[][], lon: number, lat: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function contains(geometry: AreaGeometry, lon: number, lat: number) {
  return rings(geometry).some(
    (polygon) => inRing(polygon[0], lon, lat) && !polygon.slice(1).some((hole) => inRing(hole, lon, lat)),
  );
}

export function countryAt(world: World, lon: number, lat: number): string | null {
  for (const c of world.countries) {
    if (inBbox(c.bbox, lon, lat) && contains(c.feature.geometry, lon, lat)) return c.name;
  }
  return null;
}

export const bboxPolygon = ([w, s, e, n]: Bbox): Polygon => ({
  type: "Polygon",
  coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
});

export function worldMinus(geometry: AreaGeometry): Polygon {
  const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  return { type: "Polygon", coordinates: [world, ...rings(geometry).map((polygon) => polygon[0])] };
}
