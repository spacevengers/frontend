import type { Area } from "@/lib/area";
import { monthShort } from "@/lib/period";
import { type Dataset, REGIONS } from "@/lib/sample/dataset";
import { inArea, thresholds } from "@/lib/sample/stats";

type Cell = string | number | null | undefined;

/**
 * CSV text with a formula-injection guard: a cell that starts with = + - @ tab or CR is
 * prefixed with a quote, so Excel/Sheets show it as text instead of running it.
 * Real FIRMS fields are numbers, but exports will also carry free text (names, notes).
 */
export function toCsv(rows: Cell[][]) {
  const cell = (value: Cell) => {
    let s = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\n");
}

function download(filename: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportMonth(ds: Dataset, mi: number, area: Area | null) {
  const t = thresholds(mi);
  const rows: Cell[][] = [["harmonized_id", "status", "latitude", "longitude", "country", "region", "n_viirs", "n_modis", "month"]];
  for (const c of ds.clusters) {
    if (c.u >= t[c.r] || !inArea(area, c)) continue;
    rows.push([
      c.id, c.modis ? "potentially_corresponding" : "viirs_only",
      c.lat.toFixed(4), c.lon.toFixed(4), c.country, REGIONS[c.r].name, c.viirs.length, c.modis ? 1 : 0, monthShort(mi),
    ]);
  }
  for (const m of ds.solo) {
    if (m.u >= t[m.r] || !inArea(area, m)) continue;
    rows.push([m.id, "modis_only", m.lat.toFixed(4), m.lon.toFixed(4), m.country, REGIONS[m.r].name, 0, 1, monthShort(mi)]);
  }
  download(`burn-calendar_${monthShort(mi).replace(" ", "-")}_sample.csv`, toCsv(rows), "text/csv");
}
