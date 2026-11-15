// Frontend-facing contract. Backend view adapters in
// backend/internal/api/handlers_integration.go preserve these shapes.

export type Sensor = "MODIS" | "VIIRS";

/** One original detection, exactly as a sensor reported it. */
export interface Observation {
  observation_id: string;
  sensor: Sensor;
  satellite: string; // Terra, Aqua, S-NPP, NOAA-20, NOAA-21
  latitude: number;
  longitude: number;
  acquired_at: string; // ISO 8601, UTC
  /** Original value, NOT comparable across sensors: MODIS 0-100, VIIRS "l"|"n"|"h". */
  confidence: number | "l" | "n" | "h";
  frp: number; // MW, as reported; 0 when the source did not report FRP
  daynight: "D" | "N" | "";
  source_product: string; // e.g. "MODIS_SP", "VIIRS_SNPP_SP"
}

export type MatchStatus = "matched" | "viirs_only" | "modis_only";

/**
 * One harmonized hotspot: a cluster of observations that probably correspond
 * to the same fire activity.
 */
export interface HarmonizedObservation {
  harmonized_id: string;
  cluster_uid: string;
  run_id: number;
  latitude: number;
  longitude: number;
  acquired_at: string;
  match_status: MatchStatus;
  member_ids: string[]; // links back to Observation.observation_id
  n_viirs: number;
  n_modis: number;
  frp_viirs_sum: number | null; // summed VIIRS FRP in the MODIS footprint
  frp_modis: number | null;
  /** ML output: P(MODIS would detect this footprint). Null until produced. */
  p_modis_detect: number | null;
  /** ML output: calibrated FRP, kept separate from the source values. */
  frp_calibrated: number | null;
  prediction_model: string | null;
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
