export const LIVE_VIIRS_SATS = ["S-NPP", "NOAA-20", "NOAA-21"] as const;
export const LIVE_MODIS_SATS = ["Terra", "Aqua"] as const;
export const LIVE_VIIRS_CLASSES = ["low", "nominal", "high"] as const;

/**
 * The widest time window the server pairs with. The screen narrows it without asking again.
 * Wider than the project's 30-minute rule on purpose: Aqua's orbit has drifted, so today it
 * passes about two hours from the VIIRS satellites and almost nothing pairs inside 30 minutes.
 */
export const LIVE_MAX_MINUTES = 180;

export type LiveModisRow = [number, number, number, number, number, number, number, number, number, number?];
export type LiveViirsRow = [number, number, number, number, number, number, number, number?];

export interface LiveCluster {
  cluster_uid: string;
  member_ids: string[];
  match_status: "matched" | "viirs_only" | "modis_only";
  p_modis_detect: number | null;
  frp_calibrated: number | null;
  prediction_model: string | null;
}

export interface LiveSource {
  name: string;
  url: string;
  rows: number;
  updated: string | null;
  ok: boolean;
}

export interface LiveFirms {
  generatedAt: string;
  baseTime: string;
  rule: { maxKm: number; maxMinutes: number; widestMinutes: number };
  sources: LiveSource[];
  modis: LiveModisRow[];
  viirs: LiveViirsRow[];
  links: [number, number, number, number?][];
  clusters?: LiveCluster[];
}
