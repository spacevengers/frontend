// SAMPLE DATA. Deterministic stand-in for the backend until the API contract is final:
// every number the screens show while the "Sample data" tag is visible comes from here.
// Shaped like NASA FIRMS active-fire records, but none of it is a real detection.

import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { countryAt, loadWorld, type World } from "@/lib/geo/world";

export type ViirsClass = "low" | "nominal" | "high";
export type ViirsSatellite = "S-NPP" | "NOAA-20" | "NOAA-21";
export type ModisSatellite = "Aqua" | "Terra";

interface DetectionBase {
  id: string;
  lon: number;
  lat: number;
  t: number;
  frp: number;
}
export interface ViirsDetection extends DetectionBase {
  sensor: "VIIRS";
  sat: ViirsSatellite;
  conf: ViirsClass;
}
export interface ModisDetection extends DetectionBase {
  sensor: "MODIS";
  sat: ModisSatellite;
  conf: number;
}
export type Detection = ViirsDetection | ModisDetection;

export interface Cluster {
  id: string;
  r: number;
  u: number;
  lon: number;
  lat: number;
  country: string;
  viirs: ViirsDetection[];
  modis: ModisDetection | null;
  pDetect: number;
}

export interface SoloModis extends ModisDetection {
  r: number;
  u: number;
  country: string;
}

export interface Region {
  name: string;
  lon: number;
  lat: number;
  spreadX: number;
  spreadY: number;
  clusters: number;
  peak: number;
  width: number;
}

const region = (
  name: string, lon: number, lat: number, spreadX: number, spreadY: number, clusters: number, peak: number, width: number,
): Region => ({ name, lon, lat, spreadX, spreadY, clusters, peak, width });

export const REGIONS: Region[] = [
  region("Eastern Angola", 20.5, -11.5, 3.2, 2.2, 360, 7, 1.6),
  region("Southern DR Congo", 24.5, -7.5, 4.0, 2.0, 380, 7, 1.6),
  region("Western Zambia", 25.5, -14.5, 2.8, 2.0, 260, 8, 1.6),
  region("Northern Mozambique", 37.0, -14.0, 2.5, 2.5, 190, 9, 1.5),
  region("Western Tanzania", 32.5, -6.5, 2.0, 2.5, 150, 8, 1.6),
  region("Central African Republic", 21.0, 7.0, 4.0, 1.6, 230, 0, 1.4),
  region("Northern Nigeria", 8.0, 10.0, 4.0, 1.4, 160, 0, 1.5),
  region("Kenya Rift", 36.5, 0.0, 1.4, 1.6, 70, 1, 1.5),
  region("Cerrado", -47.0, -11.0, 3.5, 3.0, 260, 8, 1.4),
  region("Southern Amazon", -60.0, -9.0, 4.0, 2.0, 200, 8, 1.3),
  region("Yakutia", 125.0, 62.0, 7.0, 3.0, 160, 6, 1.1),
  region("Northern Kazakhstan", 68.0, 51.0, 6.0, 2.0, 90, 7, 1.4),
  region("Myanmar–Thailand", 98.0, 20.0, 2.5, 3.0, 170, 2, 1.1),
  region("Punjab", 75.5, 30.5, 1.8, 1.2, 110, 10, 0.8),
  region("Northern Australia", 132.0, -15.0, 7.0, 2.2, 200, 9, 1.6),
  region("California", -121.0, 39.0, 2.0, 2.5, 50, 7, 1.2),
  region("Tsavo and the coast hinterland", 38.6, -3.0, 1.0, 0.9, 150, 8, 1.5),
  region("Maasai Mara and Narok", 35.4, -1.3, 0.7, 0.5, 120, 7, 1.4),
  region("Laikipia and Samburu", 37.2, 0.9, 0.9, 0.7, 110, 1, 1.3),
  region("Western Kenya", 34.7, 0.3, 0.5, 0.6, 80, 1, 1.2),
  region("Turkana and Marsabit", 36.6, 3.2, 1.3, 0.9, 60, 0, 1.3),
  region("South Sudan", 30.5, 7.5, 2.8, 1.8, 240, 0, 1.3),
  region("Southern Ethiopia", 37.5, 6.5, 2.2, 1.6, 120, 1, 1.3),
  region("Northern Uganda", 32.6, 2.8, 1.2, 0.9, 90, 0, 1.2),
  region("Southern Tanzania", 36.5, -9.5, 2.2, 1.6, 170, 8, 1.5),
  region("Central Madagascar", 46.8, -19.5, 1.2, 3.0, 150, 9, 1.3),
  region("Zimbabwe and Botswana", 28.5, -19.0, 3.0, 1.6, 150, 8, 1.4),
  region("Eastern South Africa", 30.0, -27.5, 2.2, 2.2, 120, 7, 1.5),
  region("Northern Ghana and Burkina Faso", -1.5, 10.5, 3.0, 1.3, 170, 11, 1.3),
  region("Guinea and Mali", -9.5, 11.5, 3.0, 1.4, 170, 1, 1.3),
  region("Chad and Sudan", 21.5, 11.0, 5.0, 1.3, 150, 10, 1.3),
  region("Cameroon and the Congo Basin edge", 14.0, 4.5, 2.5, 2.0, 120, 0, 1.3),
  region("Bolivian Chiquitania", -61.0, -16.5, 2.5, 1.6, 180, 8, 1.2),
  region("Paraguay and northern Argentina", -59.0, -24.0, 2.5, 2.2, 140, 8, 1.4),
  region("Venezuela and Colombia Llanos", -68.5, 6.5, 3.2, 1.4, 150, 2, 1.2),
  region("Yucatan and Central America", -89.0, 17.0, 2.5, 1.8, 130, 3, 1.1),
  region("Southeastern United States", -84.5, 32.0, 3.5, 1.6, 110, 2, 1.5),
  region("Western Canada", -118.0, 57.0, 6.0, 2.2, 110, 6, 1.1),
  region("Central Chile", -72.2, -37.0, 0.6, 2.0, 50, 1, 1.0),
  region("Iberia", -7.5, 40.5, 1.6, 1.8, 70, 7, 1.0),
  region("Greece and Turkey", 27.0, 38.5, 3.5, 1.2, 60, 7, 1.0),
  region("Ukraine and southern Russia", 38.0, 48.5, 5.0, 1.6, 150, 3, 1.2),
  region("Western Siberia", 75.0, 58.0, 7.0, 2.2, 110, 4, 1.1),
  region("Northeast China and Amur", 127.0, 47.5, 3.5, 1.8, 120, 3, 1.1),
  region("Central India", 80.5, 21.0, 3.0, 2.0, 170, 3, 1.1),
  region("Cambodia and Laos", 105.5, 14.0, 1.8, 2.2, 190, 1, 1.1),
  region("Sumatra", 102.5, -1.0, 1.5, 2.2, 110, 8, 1.2),
  region("Kalimantan", 113.5, -1.5, 2.0, 1.4, 120, 8, 1.2),
  region("Southeastern Australia", 148.5, -35.5, 2.2, 1.8, 70, 0, 1.1),
  region("Western Australia Kimberley", 126.0, -17.0, 2.5, 1.2, 110, 9, 1.4),
];

const VIIRS_SATS: ViirsSatellite[] = ["S-NPP", "NOAA-20", "NOAA-21"];
const VIIRS_CLASSES: ViirsClass[] = ["low", "nominal", "nominal", "high"];

import { MATCHING_RULE } from "@/lib/matching-rule";
export { MATCHING_RULE };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(random: () => number) {
  const u = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function season(r: number, month: number) {
  const { peak, width } = REGIONS[r];
  const d = Math.min(Math.abs(month - peak), 12 - Math.abs(month - peak));
  return 0.05 + 0.95 * Math.exp(-(d * d) / (2 * width * width));
}

function yearFactor(r: number, year: number) {
  const x = Math.sin((r + 1) * 12.9898 + year * 78.233) * 43758.5453;
  const f = 0.72 + 0.4 * (x - Math.floor(x));
  return r === 0 && year === 2025 ? f * 1.25 : f;
}

export function thresholds(mi: number, firstYear: number): number[] {
  const month = mi % 12;
  const year = firstYear + Math.floor(mi / 12);
  return REGIONS.map((_, r) => Math.min(1, season(r, month) * yearFactor(r, year)));
}

function generate(world: World) {
  const R = mulberry32(7);
  const clusters: Cluster[] = [];
  const solo: SoloModis[] = [];
  let viirsId = 0;
  let modisId = 0;

  REGIONS.forEach((reg, r) => {
    for (let k = 0; k < reg.clusters; k++) {
      const lon = reg.lon + gauss(R) * reg.spreadX * 0.55;
      const lat = reg.lat + gauss(R) * reg.spreadY * 0.55;
      const u = R();
      const overpass = 13.5 * 60 - (lon / 15) * 60;
      const sat = VIIRS_SATS[Math.floor(R() * 3)];
      const satOffset = sat === "NOAA-20" ? 50 : sat === "NOAA-21" ? -10 : 0;
      const count = 1 + Math.floor(R() ** 1.8 * 5);

      const viirs: ViirsDetection[] = [];
      let frpSum = 0;
      for (let j = 0; j < count; j++) {
        const frp = round1(1.2 + Math.exp(gauss(R) * 0.8 + 1.4));
        frpSum += frp;
        viirs.push({
          id: `V-${++viirsId}`, sensor: "VIIRS", sat,
          lon: lon + (R() - 0.5) * 0.012, lat: lat + (R() - 0.5) * 0.012,
          t: overpass + satOffset + (R() - 0.5) * 2,
          conf: VIIRS_CLASSES[Math.floor(R() * 4)], frp,
        });
      }

      const pDetect = 1 / (1 + Math.exp(-(frpSum - 22) / 7));
      let modis: ModisDetection | null = null;
      if (sat !== "NOAA-20" && R() < pDetect) {
        modis = {
          id: `M-${++modisId}`, sensor: "MODIS", sat: "Aqua",
          lon: lon + (R() - 0.5) * 0.014, lat: lat + (R() - 0.5) * 0.014,
          t: overpass + (R() - 0.5) * 40,
          conf: Math.round(40 + R() * 60),
          frp: round1(frpSum * Math.exp(gauss(R) * 0.32)),
        };
      }
      const aquaAlone: ModisDetection | null =
        !modis && sat === "NOAA-20" && R() < pDetect
          ? {
              id: `M-${++modisId}`, sensor: "MODIS", sat: "Aqua",
              lon: lon + (R() - 0.5) * 0.014, lat: lat + (R() - 0.5) * 0.014,
              t: overpass + (R() - 0.5) * 20, conf: Math.round(40 + R() * 60),
              frp: round1(frpSum * (0.8 + R() * 0.5)),
            }
          : null;
      const terra: (ModisDetection & { u: number }) | null =
        R() < 0.12
          ? {
              id: `M-${++modisId}`, sensor: "MODIS", sat: "Terra", u: R(),
              lon: lon + gauss(R) * 0.3, lat: lat + gauss(R) * 0.3,
              t: 10.5 * 60 - (lon / 15) * 60, conf: Math.round(30 + R() * 70),
              frp: round1(4 + R() * 40),
            }
          : null;

      const country = countryAt(world, lon, lat);
      if (country) {
        clusters.push({ id: `H-${20000 + clusters.length}`, r, u, lon, lat, country, viirs, modis, pDetect });
        if (aquaAlone) solo.push({ ...aquaAlone, r, u, country });
      }
      if (terra) {
        const terraCountry = countryAt(world, terra.lon, terra.lat);
        if (terraCountry) solo.push({ ...terra, r, country: terraCountry });
      }
    }
  });
  return { clusters, solo };
}

export interface DetectionProps {
  id: string;
  cid: string;
  sensor: "MODIS" | "VIIRS";
  sat: string;
  frp: number;
  r: number;
  u: number;
  paired: 0 | 1;
  conf?: ViirsClass;
  confp?: number;
}
export interface HarmonizedProps { cid: string; r: number; u: number; paired: 0 | 1; n: number }
export interface LinkProps { cid: string; r: number; u: number }

export interface Dataset {
  world: World;
  clusters: Cluster[];
  solo: SoloModis[];
  clusterById: Map<string, Cluster>;
  detectionById: Map<string, { detection: Detection; cluster: Cluster | null }>;
  geo: {
    detections: FeatureCollection<Point, DetectionProps>;
    harmonized: FeatureCollection<Point, HarmonizedProps>;
    links: FeatureCollection<LineString, LinkProps>;
  };
}

const point = <P>(lon: number, lat: number, properties: P): Feature<Point, P> => ({
  type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties,
});

function build(world: World): Dataset {
  const { clusters, solo } = generate(world);
  const detections: Feature<Point, DetectionProps>[] = [];
  const harmonized: Feature<Point, HarmonizedProps>[] = [];
  const links: Feature<LineString, LinkProps>[] = [];
  const detectionById: Dataset["detectionById"] = new Map();

  for (const c of clusters) {
    const paired = c.modis ? 1 : 0;
    for (const v of c.viirs) {
      detections.push(point(v.lon, v.lat, { id: v.id, cid: c.id, sensor: "VIIRS", sat: v.sat, conf: v.conf, frp: v.frp, r: c.r, u: c.u, paired }));
      detectionById.set(v.id, { detection: v, cluster: c });
    }
    if (c.modis) {
      const m = c.modis;
      detections.push(point(m.lon, m.lat, { id: m.id, cid: c.id, sensor: "MODIS", sat: m.sat, confp: m.conf, frp: m.frp, r: c.r, u: c.u, paired: 1 }));
      detectionById.set(m.id, { detection: m, cluster: c });
      for (const v of c.viirs) {
        links.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[m.lon, m.lat], [v.lon, v.lat]] },
          properties: { cid: c.id, r: c.r, u: c.u },
        });
      }
    }
    harmonized.push(point(c.lon, c.lat, { cid: c.id, r: c.r, u: c.u, paired, n: c.viirs.length + paired }));
  }
  for (const m of solo) {
    detections.push(point(m.lon, m.lat, { id: m.id, cid: "", sensor: "MODIS", sat: m.sat, confp: m.conf, frp: m.frp, r: m.r, u: m.u, paired: 0 }));
    detectionById.set(m.id, { detection: m, cluster: null });
  }

  return {
    world, clusters, solo,
    clusterById: new Map(clusters.map((c) => [c.id, c])),
    detectionById,
    geo: {
      detections: { type: "FeatureCollection", features: detections },
      harmonized: { type: "FeatureCollection", features: harmonized },
      links: { type: "FeatureCollection", features: links },
    },
  };
}

let datasetPromise: Promise<Dataset> | undefined;

export function loadDataset(): Promise<Dataset> {
  datasetPromise ??= loadWorld().then(build);
  datasetPromise.catch(() => {
    datasetPromise = undefined;
  });
  return datasetPromise;
}
