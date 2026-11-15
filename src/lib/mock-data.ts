// Deterministic fake FIRMS-like data for Kenya, used until the backend is live.
// The shape follows src/lib/types.ts; the numbers loosely follow the ML findings
// (VIIRS ~5x more detections than MODIS, summed VIIRS FRP ~ MODIS FRP).

import type { HarmonizedObservation, Observation } from "./types";

function rng(seed: number) {
  // mulberry32: tiny seeded PRNG so every reload shows the same map
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rough fire-prone zones inside Kenya: [lat, lon, spread in degrees]
const ZONES: [number, number, number][] = [
  [-1.4, 35.2, 0.6], // Maasai Mara / Narok
  [0.6, 35.3, 0.4], // Uasin Gishu
  [-2.9, 38.4, 0.8], // Tsavo
  [1.0, 37.5, 0.7], // Samburu / Laikipia
  [-0.4, 39.5, 0.5], // Tana River
];

const DAYS = ["2023-02-10", "2023-02-11", "2023-02-12", "2023-02-13", "2023-02-14"];

function build() {
  const r = rng(42);
  const observations: Observation[] = [];
  const harmonized: HarmonizedObservation[] = [];
  let oid = 0;

  for (let f = 0; f < 140; f++) {
    const [zlat, zlon, s] = ZONES[Math.floor(r() * ZONES.length)];
    const lat = zlat + (r() - 0.5) * 2 * s;
    const lon = zlon + (r() - 0.5) * 2 * s;
    const day = DAYS[Math.floor(r() * DAYS.length)];
    const night = r() < 0.25;
    const time = night ? "22:30" : "10:30"; // ~13:30 / 01:30 EAT in UTC
    const at = `${day}T${time}:00Z`;

    // VIIRS: 1-9 pixels inside a ~1 km footprint
    const nV = 1 + Math.floor(r() ** 2 * 9);
    const ids: string[] = [];
    let frpSum = 0;
    for (let k = 0; k < nV; k++) {
      const frp = +(1 + r() ** 2 * 25).toFixed(1);
      frpSum += frp;
      const id = `v-${oid++}`;
      ids.push(id);
      observations.push({
        observation_id: id,
        sensor: "VIIRS",
        satellite: "N",
        latitude: lat + (r() - 0.5) * 0.008,
        longitude: lon + (r() - 0.5) * 0.008,
        acquired_at: at,
        confidence: (["l", "n", "n", "h"] as const)[Math.floor(r() * 4)],
        frp,
        daynight: night ? "N" : "D",
        source_product: "VIIRS_SNPP_SP",
      });
    }

    // MODIS sees it more often when the footprint is hot (that's the ML signal)
    const p = 1 / (1 + Math.exp(-(frpSum - 40) / 12));
    const modisSaw = r() < p;
    let frpModis: number | null = null;
    if (modisSaw) {
      frpModis = +(frpSum * (0.8 + r() * 0.5)).toFixed(1);
      const id = `m-${oid++}`;
      ids.push(id);
      observations.push({
        observation_id: id,
        sensor: "MODIS",
        satellite: "Aqua",
        latitude: lat + (r() - 0.5) * 0.01,
        longitude: lon + (r() - 0.5) * 0.01,
        acquired_at: at,
        confidence: Math.round(30 + r() * 70),
        frp: frpModis,
        daynight: night ? "N" : "D",
        source_product: "MODIS_SP",
      });
    }

    harmonized.push({
      harmonized_id: `h-${f}`,
      latitude: lat,
      longitude: lon,
      acquired_at: at,
      match_status: modisSaw ? "matched" : "viirs_only",
      member_ids: ids,
      n_viirs: nV,
      n_modis: modisSaw ? 1 : 0,
      frp_viirs_sum: +frpSum.toFixed(1),
      frp_modis: frpModis,
      p_modis_detect: +p.toFixed(3),
    });
  }

  // A few Terra-only detections: no VIIRS partner within the time window
  for (let k = 0; k < 15; k++) {
    const [zlat, zlon, s] = ZONES[Math.floor(r() * ZONES.length)];
    const id = `m-${oid++}`;
    const lat = zlat + (r() - 0.5) * 2 * s;
    const lon = zlon + (r() - 0.5) * 2 * s;
    const at = `${DAYS[Math.floor(r() * DAYS.length)]}T07:30:00Z`;
    const frp = +(5 + r() * 40).toFixed(1);
    observations.push({
      observation_id: id,
      sensor: "MODIS",
      satellite: "Terra",
      latitude: lat,
      longitude: lon,
      acquired_at: at,
      confidence: Math.round(30 + r() * 70),
      frp,
      daynight: "D",
      source_product: "MODIS_SP",
    });
    harmonized.push({
      harmonized_id: `h-t${k}`,
      latitude: lat,
      longitude: lon,
      acquired_at: at,
      match_status: "modis_only",
      member_ids: [id],
      n_viirs: 0,
      n_modis: 1,
      frp_viirs_sum: null,
      frp_modis: frp,
      p_modis_detect: null,
    });
  }

  return { observations, harmonized };
}

export const MOCK = build();
export const MOCK_DATE_RANGE = { start: DAYS[0], end: DAYS[DAYS.length - 1] };
