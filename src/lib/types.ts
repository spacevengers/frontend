// Data contract shared with the backend. Mirrors section 7.3 of the project spec.
// When the backend publishes its real schema, update this file first; the
// compiler will point at every component that needs to change.

export type Sensor = "MODIS" | "VIIRS";

/** One original detection, exactly as a sensor reported it (spec §7.3). */
export interface Observation {
  observation_id: string;
  sensor: Sensor;
  satellite: string; // "Aqua" | "Terra" | "N" (S-NPP) | "N20" | "N21"
  latitude: number;
  longitude: number;
  acquired_at: string; // ISO 8601, UTC
  /** Original value, NOT comparable across sensors: MODIS 0-100, VIIRS "l"|"n"|"h". */
  confidence: number | "l" | "n" | "h";
  frp: number; // MW, as reported
  daynight: "D" | "N";
  source_product: string; // e.g. "MODIS_SP", "VIIRS_SNPP_SP"
}

export type MatchStatus = "matched" | "viirs_only" | "modis_only";

/**
 * One harmonized hotspot: a cluster of observations that probably correspond
 * to the same fire activity. Proposed contract; agree it with backend + ML.
 */
export interface HarmonizedObservation {
  harmonized_id: string;
  latitude: number;
  longitude: number;
  acquired_at: string;
  match_status: MatchStatus;
  member_ids: string[]; // links back to Observation.observation_id
  n_viirs: number;
  n_modis: number;
  frp_viirs_sum: number | null; // summed VIIRS FRP in the MODIS footprint
  frp_modis: number | null;
  /** ML output: P(MODIS would detect this footprint). One scale for both sensors. */
  p_modis_detect: number | null;
}

export interface Filters {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
  sensors: Sensor[];
  bbox?: [number, number, number, number]; // west, south, east, north
}

export interface Statistics {
  counts: Record<Sensor, number>;
  harmonized: Record<MatchStatus, number>;
}
