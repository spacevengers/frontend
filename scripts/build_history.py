#!/usr/bin/env python3
"""Build compact, paired NASA FIRMS country history files (Kenya by default)."""

from __future__ import annotations

import argparse
import csv
import json
import math
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "firms"
OUT = ROOT / "public" / "history"
YEARS = range(2018, 2026)
SOURCES = (("modis", "MODIS"), ("viirs-snpp", "VIIRS"), ("viirs-jpss1", "VIIRS"))
MAX_KM = 1.5
MAX_MINUTES = 30
RAD = math.pi / 180


def url_for(source: str, year: int, country: str) -> str:
    return f"https://firms.modaps.eosdis.nasa.gov/data/country/{source}/{year}/{source}_{year}_{country}.csv"


def fetch(source: str, year: int, country: str) -> Path | None:
    url = url_for(source, year, country)
    path = CACHE / country / f"{source}_{year}_{country}.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size:
        return path
    request = urllib.request.Request(url, headers={"User-Agent": "NASA-FIRMS-history-builder/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response, path.open("wb") as output:
            output.write(response.read())
        if path.stat().st_size == 0:
            path.unlink()
            return None
        return path
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"Unavailable: {url}: {exc}")
        return None


def parse_rows(path: Path, sensor: str):
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        fields = {name.lower(): name for name in reader.fieldnames or []}
        needed = ("latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp", "type")
        if any(name not in fields for name in needed):
            print(f"Skipping {path}: missing required columns")
            return
        for row in reader:
            try:
                lat, lon = float(row[fields["latitude"]]), float(row[fields["longitude"]])
                day = date.fromisoformat(row[fields["acq_date"]])
                hm = row[fields["acq_time"]].strip().zfill(4)
                minute = datetime(day.year, day.month, day.day, int(hm[:2]), int(hm[2:]), tzinfo=timezone.utc).timestamp() / 60
                frp = float(row[fields["frp"]] or 0)
                kind = int(float(row[fields["type"]] or 0))
                sat = row[fields["satellite"]].strip()
                conf = row[fields["confidence"]].strip()
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    continue
            except (ValueError, TypeError):
                continue
            if sensor == "MODIS":
                satellite = "Terra" if sat.lower() in ("t", "terra") else "Aqua"
                confidence = float(conf.rstrip("%")) if conf.lower() not in ("", "n", "l", "h") else 0
                yield {"lon": lon, "lat": lat, "time": minute, "frp": frp, "sat": satellite, "confidence": confidence, "type": kind, "month": day.strftime("%Y-%m")}
            else:
                satellite = "NOAA-20" if sat in ("1", "N20", "J1") else "S-NPP"
                cls = {"l": "low", "n": "nominal", "h": "high"}.get(conf.lower(), conf.lower())
                yield {"lon": lon, "lat": lat, "time": minute, "frp": frp, "sat": satellite, "confidence": cls, "type": kind, "month": day.strftime("%Y-%m")}


def distance(a, b):
    dlat, dlon = (b["lat"] - a["lat"]) * RAD, (b["lon"] - a["lon"]) * RAD
    h = math.sin(dlat / 2) ** 2 + math.cos(a["lat"] * RAD) * math.cos(b["lat"] * RAD) * math.sin(dlon / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(h)))


def median(values):
    values = sorted(values)
    if not values:
        return None
    n = len(values)
    return values[n // 2] if n % 2 else (values[n // 2 - 1] + values[n // 2]) / 2


def histogram(values, limit, bins):
    result = [0] * bins
    for value in values:
        result[min(bins - 1, max(0, int(value / limit * bins)))] += 1
    return result


def compact(row, base, paired=0, nearest_km=-1, nearest_min=-1):
    if row["sat"] in ("Terra", "Aqua"):
        return [round(row["lon"], 5), round(row["lat"], 5), int(row["time"] - base), round(row["frp"], 1), row["confidence"], 0 if row["sat"] == "Terra" else 1, paired, round(nearest_km, 2), nearest_min, row["type"]]
    sat = {"S-NPP": 0, "NOAA-20": 1}[row["sat"]]
    conf = {"low": 0, "nominal": 1, "high": 2}.get(row["confidence"], 1)
    return [round(row["lon"], 5), round(row["lat"], 5), int(row["time"] - base), round(row["frp"], 1), conf, sat, nearest_min, row["type"]]


def build_month(month, modis, viirs, country):
    base = min([r["time"] for r in modis + viirs], default=0)
    viirs_cells = defaultdict(list)
    cell = 0.02
    for i, row in enumerate(viirs):
        viirs_cells[(math.floor(row["lat"] / cell), math.floor(row["lon"] / cell))].append(i)
    links, m_partners = [], [0] * len(modis)
    m_nearest = [(-1, -1)] * len(modis)
    v_nearest = [-1] * len(viirs)
    distances, gaps = [], []
    for mi, m in enumerate(modis):
        lat_cell, lon_cell = math.floor(m["lat"] / cell), math.floor(m["lon"] / cell)
        lon_reach = min(40, math.ceil((MAX_KM / 111) / max(0.05, math.cos(m["lat"] * RAD)) / cell))
        for a in range(lat_cell - 1, lat_cell + 2):
            for b in range(lon_cell - lon_reach, lon_cell + lon_reach + 1):
                for vi in viirs_cells.get((a, b), ()):
                    v = viirs[vi]
                    gap = abs(v["time"] - m["time"])
                    if gap > MAX_MINUTES:
                        continue
                    km = distance(m, v)
                    if km > MAX_KM:
                        continue
                    links.append([mi, vi, int(gap)])
                    m_partners[mi] += 1
                    if m_nearest[mi][1] < 0 or gap < m_nearest[mi][1]:
                        m_nearest[mi] = (km, int(gap))
                    if v_nearest[vi] < 0 or gap < v_nearest[vi]:
                        v_nearest[vi] = int(gap)
                    distances.append(km)
                    gaps.append(gap)
    month_data = {
        "country": country, "month": month, "baseTime": datetime.fromtimestamp(base * 60, timezone.utc).isoformat(),
        "generatedAt": datetime.now(timezone.utc).isoformat(), "rule": {"maxKm": MAX_KM, "maxMinutes": MAX_MINUTES},
        "modis": [compact(r, base, m_partners[i], *m_nearest[i]) for i, r in enumerate(modis)],
        "viirs": [compact(r, base, 0, -1, v_nearest[i]) for i, r in enumerate(viirs)], "links": links,
    }
    aqua = [i for i, r in enumerate(modis) if r["sat"] == "Aqua"]
    terra = [i for i, r in enumerate(modis) if r["sat"] == "Terra"]
    paired_m, paired_v = {link[0] for link in links}, {link[1] for link in links}
    summary = {
        "modis": len(modis), "modisBySatellite": {"Aqua": len(aqua), "Terra": len(terra)},
        "viirs": len(viirs), "viirsBySatellite": {sat: sum(r["sat"] == sat for r in viirs) for sat in ("S-NPP", "NOAA-20")},
        "pairs": len(links), "aquaPaired": sum(i in paired_m for i in aqua), "terraPaired": sum(i in paired_m for i in terra),
        "viirsPaired": len(paired_v), "medianPairKm": median(distances), "medianPairMinutes": median(gaps),
        "distanceBins": histogram(distances, MAX_KM, 15), "timeBins": histogram(gaps, MAX_MINUTES, 10),
        "modisConfidenceBins": histogram([r["confidence"] for r in modis], 101, 10),
        "viirsConfidence": {level: sum(r["confidence"] == level for r in viirs) for level in ("low", "nominal", "high")},
        "frp": [[round(sum(viirs[vi]["frp"] for m, vi, _ in links if m == mi), 1), round(row["frp"], 1)] for mi, row in enumerate(modis) if any(m == mi for m, _, _ in links)][:900],
        "harmonized": len(paired_m) + len(modis) - len(paired_m) + len(viirs) - len(paired_v),
    }
    return month_data, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", default="Kenya", choices=("Kenya",), help="Only Kenya is enabled until archive format is agreed with backend.")
    args = parser.parse_args()
    by_month = defaultdict(lambda: {"MODIS": [], "VIIRS": []})
    for year in YEARS:
        for source, sensor in SOURCES:
            path = fetch(source, year, args.country)
            if path:
                for row in parse_rows(path, sensor):
                    if row["month"].startswith(str(year)):
                        by_month[row["month"]][sensor].append(row)
    months = {}
    country_dir = OUT / args.country
    country_dir.mkdir(parents=True, exist_ok=True)
    for year in YEARS:
        for month_num in range(1, 13):
            key = f"{year}-{month_num:02d}"
            records = by_month[key]
            data, summary = build_month(key, records["MODIS"], records["VIIRS"], args.country)
            (country_dir / f"{key}.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
            months[key] = summary
            print(f"{key}: MODIS {summary['modis']}, VIIRS {summary['viirs']}, pairs {summary['pairs']}")
    summary = {"country": args.country, "years": [2018, 2025], "rule": {"maxKm": MAX_KM, "maxMinutes": MAX_MINUTES}, "months": months}
    (country_dir / "summary.json").write_text(json.dumps(summary, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
