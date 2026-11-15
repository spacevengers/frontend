"use client";

import type { ExpressionSpecification } from "maplibre-gl";
import { type FormEvent, useMemo, useState } from "react";
import { type Camera, type LayerFilters, type LayerVisibility, MapView } from "@/components/map/MapView";
import { LoadState, Panel, SplitBars } from "@/components/Panel";
import { areaLabel, parseBbox } from "@/lib/area";
import { exportMonth } from "@/lib/export";
import { capitalize, fmt, fmtLat, fmtLon } from "@/lib/format";
import { isIsoDate, THERMAL_LAYERS, type ThermalLayerId } from "@/lib/gibs";
import { EMPTY_LIVE_GEOJSON, liveDetail, liveStats, useLiveFirms, useLiveGeoJSON } from "@/lib/firms/live";
import { HOME } from "@/lib/home";
import { FIRST_YEAR, fromYearMonth, LAST_YEAR, monthBounds, monthLabel, toYearMonth } from "@/lib/period";
import { BACKEND_CONFIGURED, useBackendFirms } from "@/lib/backend/live";
import type { Filters } from "@/lib/types";
import { type Cluster, type Dataset, type Detection, REGIONS } from "@/lib/sample/dataset";
import { recordDetail, statsFor, thresholds } from "@/lib/sample/stats";
import { useDataset } from "@/lib/sample/use-dataset";
import { useTheme } from "@/lib/theme";
import { useArea } from "@/lib/use-area";
import { useViewState } from "@/lib/view-state";
import { archiveLiveShape, useArchiveMonth } from "@/lib/history/client";

type Status = "all" | "pairs" | "one" | "harm";
type ViirsFilter = "all" | "nh" | "h";
type Selection = { kind: "record"; id: string } | { kind: "detection"; id: string } | { kind: "live"; id: string };

const SATELLITES = ["Terra", "Aqua", "S-NPP", "NOAA-20", "NOAA-21"];
const SOURCE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isSourceStale(updated: string | null) {
  if (!updated) return false;
  const timestamp = Date.parse(updated);
  return Number.isFinite(timestamp) && Date.now() - timestamp > SOURCE_STALE_AFTER_MS;
}

function openingRecord(ds: Dataset, mi: number): Cluster | null {
  const t = thresholds(mi);
  const home = ds.clusters.filter((c) => c.country === HOME.country && c.u < t[c.r]);
  const paired = home.filter((c) => c.modis).sort((a, b) => b.viirs.length - a.viirs.length);
  return paired[0] ?? home[0] ?? null;
}

function HarmonizedRecord({ cluster, mi }: { cluster: Cluster; mi: number }) {
  const d = recordDetail(cluster, mi);
  const modisCount = cluster.modis ? 1 : 0;
  return (
    <>
      <p className="rec-h">Harmonized {cluster.id}</p>
      <p className="muted mt-0 mb-2">
        {REGIONS[cluster.r].name}, {cluster.country} · {fmtLat(cluster.lat, 2)}, {fmtLon(cluster.lon, 2)} · {d.date}
      </p>
      <span className="chip">{d.status}</span>
      <p className="my-2.5">
        Built from {modisCount} MODIS and {cluster.viirs.length} VIIRS detection{cluster.viirs.length > 1 ? "s" : ""}
        {modisCount ? " that potentially correspond" : ""}.
      </p>
      <table className="src">
        <thead>
          <tr><th>Source</th><th>UTC</th><th>Confidence</th><th>FRP, MW</th></tr>
        </thead>
        <tbody>
          {d.rows.map((row, i) => (
            <tr key={i}>
              <td><i className={`sw ${row.sensor === "MODIS" ? "sq" : "ci"} mr-1.5`} />{row.source}</td>
              <td className="num">{row.time}</td>
              <td>{row.confidence}</td>
              <td className="num">{row.frp.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Confidence and FRP are each product&apos;s original values. The two confidence scales are not equivalent.</p>
      <dl className="kv mt-3">
        <dt>Farthest apart</dt><dd className="num">{d.farthestKm.toFixed(2)} km</dd>
        <dt>Time spread</dt><dd className="num">{d.spreadMinutes} min</dd>
        <dt>Calibrated FRP</dt>
        <dd>
          {d.calibratedFrp === null ? <span className="muted">not produced</span> : (
            <><span className="num">{d.calibratedFrp.toFixed(1)} MW</span> <span className="muted">calibrated, kept separate</span></>
          )}
        </dd>
        <dt>P(MODIS detects footprint)</dt>
        <dd><span className="num">{cluster.pDetect.toFixed(2)}</span> <span className="muted">planned ML output</span></dd>
        <dt>Products</dt><dd>MCD14ML C6.1 · VNP14IMG (placeholder)</dd>
      </dl>
    </>
  );
}

function DetectionRecord({ detection, cluster, onOpen }: { detection: Detection; cluster: Cluster | null; onOpen: (id: string) => void }) {
  const modis = detection.sensor === "MODIS";
  return (
    <>
      <p className="rec-h">{detection.sensor} {detection.sat} detection</p>
      <p className="muted mt-0 mb-2">{detection.id} · {fmtLat(detection.lat, 3)}, {fmtLon(detection.lon, 3)}</p>
      <dl className="kv">
        <dt>Original confidence</dt>
        <dd>{modis ? `${detection.conf}%` : capitalize(String(detection.conf))} <span className="muted">{modis ? "percent scale" : "class scale"}</span></dd>
        <dt>Original FRP</dt><dd className="num">{detection.frp.toFixed(1)} MW</dd>
        <dt>Pixel</dt><dd>{modis ? "1 km" : "375 m"}</dd>
        <dt>Product</dt><dd>{modis ? "MCD14ML C6.1" : "VNP14IMG"} (placeholder)</dd>
      </dl>
      {cluster ? (
        <button className="btn sm mt-3" type="button" onClick={() => onOpen(cluster.id)}>Open harmonized record {cluster.id}</button>
      ) : (
        <p className="note">
          Seen by one sensor only.{" "}
          {detection.sat === "Terra" ? "Terra passes about 3 hours before VIIRS, so it cannot pair inside the matching window. " : ""}
          This is not an error.
        </p>
      )}
    </>
  );
}

function LiveDetectionRecord({ detail, baseTime, windowMinutes }: { detail: NonNullable<ReturnType<typeof liveDetail>>; baseTime: string; windowMinutes: number }) {
  const date = new Date(Date.parse(baseTime) + detail.minutesAfterBase * 60_000);
  const time = Number.isNaN(date.getTime()) ? "Unknown" : `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
  const partners = detail.partners.filter((partner) => partner.minutes <= windowMinutes);
  return (
    <>
      <p className="rec-h">{detail.sensor} {detail.satellite} detection</p>
      <p className="muted mt-0 mb-2">{detail.id} · {fmtLat(detail.lat, 3)}, {fmtLon(detail.lon, 3)} · {time}</p>
      <dl className="kv">
        <dt>Original confidence</dt><dd>{detail.confidence}</dd>
        <dt>Fire radiative power</dt><dd className="num">{detail.frp.toFixed(1)} MW</dd>
        <dt>Pixel size</dt><dd>{detail.sensor === "MODIS" ? "1 km" : "375 m"}</dd>
        <dt>Pairs in selected window</dt><dd>{partners.length}</dd>
      </dl>
      {partners.length ? (
        <ul className="note mt-3">
          {partners.slice(0, 8).map((partner) => <li key={partner.id}>{partner.id}: {partner.minutes} min, {partner.km?.toFixed(2)} km away</li>)}
        </ul>
      ) : (
        <p className="note">No partner falls inside the selected {windowMinutes}-minute time window. This is not evidence that there was no fire.</p>
      )}
    </>
  );
}

export function MapScreen() {
  const { ds, status: load, error } = useDataset();
  if (!ds) {
    return (
      <main className="stage with-filterbar" aria-label="2D map explorer">
        <div className="map-status"><LoadState status={load === "error" ? "error" : "loading"} error={error} /></div>
      </main>
    );
  }
  return <Explorer ds={ds} />;
}

function Explorer({ ds }: { ds: Dataset }) {
  const [view, setView] = useViewState();
  const theme = useTheme();
  const area = useArea(ds.world, view);
  const { mi } = view;

  const [status, setStatus] = useState<Status>("all");
  const [dataMode, setDataMode] = useState<"sample" | "live" | "backend">("live");
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [satellite, setSatellite] = useState("all");
  const [modisMin, setModisMin] = useState(0);
  const [viirsFilter, setViirsFilter] = useState<ViirsFilter>("all");
  const [layers, setLayers] = useState({ modis: true, viirs: true, harm: true, links: true });
  const [drawing, setDrawing] = useState(false);
  const [areaMessage, setAreaMessage] = useState<string | null>(null);
  const [realOn, setRealOn] = useState(false);
  const [realLayer, setRealLayer] = useState<ThermalLayerId>(THERMAL_LAYERS[0].id);
  const [realDate, setRealDate] = useState<string | null>(null);

  const [opening] = useState(() => openingRecord(ds, mi));
  const [selection, setSelection] = useState<Selection | null>(opening ? { kind: "record", id: opening.id } : null);
  const [initialCamera] = useState<Camera>(() => ({ center: [HOME.lon, HOME.lat], zoom: HOME.mapZoom }));
  const [projection, setProjection] = useState<"mercator" | "globe">("mercator");

  const sampleStats = useMemo(() => statsFor(ds, mi, area), [ds, mi, area]);
  const liveState = useLiveFirms(dataMode === "live");
  const backendFilters = useMemo<Filters | null>(() => {
    if (dataMode !== "backend") return null;
    const [start, end] = monthBounds(mi);
    return { start, end, sensors: ["MODIS", "VIIRS"], bbox: area?.bbox ?? [33.5, -5, 42, 5.5] };
  }, [dataMode, mi, area?.bbox]);
  const backendState = useBackendFirms(dataMode === "backend", backendFilters);
  const archiveState = useArchiveMonth(dataMode === "sample" && area?.kind === "country" ? area.name : null, mi);
  const archiveActive = dataMode === "sample" && area?.kind === "country" && archiveState.value?.country === area.name;
  const archiveRaw = useMemo(() => archiveActive && archiveState.value ? archiveLiveShape(archiveState.value) : null, [archiveActive, archiveState.value]);
  const displayRaw = dataMode === "live" ? liveState.data : dataMode === "backend" ? backendState.data : archiveRaw;
  const liveMap = useLiveGeoJSON(displayRaw);
  const liveSummary = useMemo(() => displayRaw ? liveStats(displayRaw, area, windowMinutes) : null, [displayRaw, area, windowMinutes]);
  const remoteState = dataMode === "live" ? liveState : dataMode === "backend" ? backendState : null;
  const remoteActive = dataMode === "live" || dataMode === "backend" || archiveActive;
  const remoteStats = liveSummary ? { ...sampleStats, modis: liveSummary.modis, viirs: liveSummary.viirs, pairs: liveSummary.pairs, harmonized: liveSummary.modis + liveSummary.viirs - liveSummary.pairedViirs } : sampleStats;
  const displayStats = (archiveActive || dataMode === "backend") && liveSummary ? remoteStats : sampleStats;
  const incompleteSources = remoteState?.data?.sources.filter((source) => !source.ok || source.rows === 0 || isSourceStale(source.updated)) ?? [];

  const filters = useMemo<LayerFilters>(() => {
    const f: LayerFilters = { viirs: [], modis: [], harm: [] };
    const paired = (v: 0 | 1): ExpressionSpecification => ["==", ["get", "paired"], v];
    if (satellite !== "all") {
      f.viirs.push(["==", ["get", "sat"], satellite]);
      f.modis.push(["==", ["get", "sat"], satellite]);
    }
    if (modisMin > 0) f.modis.push([">=", ["get", "confp"], modisMin]);
    if (viirsFilter === "nh") f.viirs.push(["in", ["get", "conf"], ["literal", ["nominal", "high"]]]);
    if (viirsFilter === "h") f.viirs.push(["==", ["get", "conf"], "high"]);
    if (status === "pairs" || status === "one") {
      const want = paired(status === "pairs" ? 1 : 0);
      f.viirs.push(want);
      f.modis.push(want);
      f.harm.push(want);
    }
    return f;
  }, [satellite, modisMin, viirsFilter, status]);

  const visibility = useMemo<LayerVisibility>(() => {
    const detections = status !== "harm";
    return {
      modis: layers.modis && detections,
      viirs: layers.viirs && detections,
      harm: layers.harm,
      links: layers.links && detections && status !== "one",
    };
  }, [layers, status]);

  const selectedCluster = selection?.kind === "record" ? ds.clusterById.get(selection.id) ?? null : null;
  const selectedDetection = selection?.kind === "detection" ? ds.detectionById.get(selection.id) ?? null : null;
  const selectedLive = selection?.kind === "live" && displayRaw ? liveDetail(displayRaw, selection.id) : null;
  const focusLon = selectedCluster?.lon ?? selectedDetection?.detection.lon ?? selectedLive?.lon ?? null;
  const focusLat = selectedCluster?.lat ?? selectedDetection?.detection.lat ?? selectedLive?.lat ?? null;
  const selectedPoint = useMemo<[number, number] | null>(() => (focusLon === null || focusLat === null ? null : [focusLon, focusLat]), [focusLon, focusLat]);

  const date = realDate && realDate.startsWith(toYearMonth(mi)) ? realDate : `${toYearMonth(mi)}-15`;
  const overlay = useMemo(() => (realOn ? { layer: realLayer, date } : null), [realOn, realLayer, date]);

  const clearArea = () => {
    setAreaMessage(null);
    setView({ country: null, bbox: null });
  };

  function applyBounds(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const bbox = parseBbox(["w", "s", "e", "n"].map((k) => String(data.get(k) ?? "")).join(","));
    if (!bbox) {
      setAreaMessage("Enter W < E and S < N, in degrees (longitude −180 to 180, latitude −85 to 85).");
      return;
    }
    setAreaMessage(null);
    setView({ bbox });
  }

  const layerRows: { key: keyof typeof layers; swatch: string; label: string; count: number }[] = [
    { key: "modis", swatch: "sq", label: "MODIS", count: displayStats.modis },
    { key: "viirs", swatch: "ci", label: "VIIRS", count: displayStats.viirs },
    { key: "harm", swatch: "di", label: "Harmonized", count: displayStats.harmonized },
    { key: "links", swatch: "ln", label: "Pair links", count: displayStats.pairs },
  ];

  return (
    <main className="stage with-filterbar" aria-label="2D map explorer">
      <MapView
        ds={ds}
        mi={mi}
        theme={theme}
        initialCamera={initialCamera}
        projection={projection}
        label="Map of detections. Click a marker for its record, or a country to select it."
        filters={filters}
        visibility={visibility}
        area={area}
        selectedPoint={selectedPoint}
        overlay={overlay}
        live={dataMode !== "sample" || archiveActive ? liveMap ?? EMPTY_LIVE_GEOJSON : null}
        windowMinutes={windowMinutes}
        drawing={drawing}
        onDraw={(bbox) => {
          setDrawing(false);
          if (bbox) setView({ bbox });
        }}
        onPickRecord={(id) => setSelection({ kind: "record", id })}
        onPickObservation={(id) => setSelection({ kind: "detection", id })}
        onPickLive={(id) => setSelection({ kind: "live", id })}
        onPickCountry={(name) => (area?.kind === "country" && area.name === name ? clearArea() : setView({ country: name }))}
      />
      <div className="fade-l" />
      <div className="fade-r" />

      {dataMode === "sample" && selectedCluster ? (
        <div className="inset" aria-hidden="true">
          <div className="disc">
            <MapView ds={ds} mi={mi} theme={theme} inset className="absolute inset-0" label="" initialCamera={{ center: [selectedCluster.lon, selectedCluster.lat], zoom: 13.6 }} center={selectedPoint} />
          </div>
          <span className="cap">{selectedCluster.id}, zoomed in</span>
        </div>
      ) : null}

      <div className="filterbar filters" role="toolbar" aria-label="Filters">
        <div className="seg" role="group" aria-label="Projection">
          <button type="button" aria-pressed={projection === "globe"} onClick={() => setProjection("globe")}>3D globe</button>
          <button type="button" aria-pressed={projection === "mercator"} onClick={() => setProjection("mercator")}>2D map</button>
        </div>
        <div className="seg" role="group" aria-label="Data source">
          <button type="button" aria-pressed={dataMode === "sample"} onClick={() => { setSelection(null); setDataMode("sample"); }}>{archiveActive ? "NASA FIRMS archive" : "Sample history"}</button>
          <button type="button" aria-pressed={dataMode === "live"} onClick={() => { setSelection(null); setDataMode("live"); }}>Live · last 24 h</button>
          {BACKEND_CONFIGURED ? <button type="button" aria-pressed={dataMode === "backend"} onClick={() => { setSelection(null); setDataMode("backend"); }}>Backend · month</button> : null}
        </div>
        {dataMode !== "sample" ? (
          <span className="pill">
            <label htmlFor="f-window">Pair window</label>
            <select id="f-window" value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))}>
              {[30, 60, 120, 180].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
            </select>
          </span>
        ) : <span className="pill">
          <label htmlFor="f-month">Month</label>
          <input
            id="f-month" type="month" min={`${FIRST_YEAR}-01`} max={`${LAST_YEAR}-12`} value={toYearMonth(mi)}
            onChange={(e) => {
              const next = fromYearMonth(e.target.value);
              if (next !== null) setView({ mi: next });
            }}
          />
        </span>}
        {dataMode === "sample" ? <>
        <span className="pill">
          <label htmlFor="f-status">Status</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="all">All records</option>
            <option value="pairs">Potentially corresponding</option>
            <option value="one">Seen by one sensor only</option>
            <option value="harm">Harmonized</option>
          </select>
        </span>
        <span className="pill">
          <label htmlFor="f-sat">Satellite</label>
          <select id="f-sat" value={satellite} onChange={(e) => setSatellite(e.target.value)}>
            <option value="all">All</option>
            {SATELLITES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </span>
        <span className="pill">
          <label htmlFor="f-mconf">MODIS confidence ≥</label>
          <input id="f-mconf" type="range" min={0} max={100} step={5} value={modisMin} onChange={(e) => setModisMin(Number(e.target.value))} />
          <span className="num">{modisMin}%</span>
        </span>
        <span className="pill">
          <label htmlFor="f-vconf">VIIRS confidence</label>
          <select id="f-vconf" value={viirsFilter} onChange={(e) => setViirsFilter(e.target.value as ViirsFilter)}>
            <option value="all">All classes</option>
            <option value="nh">Nominal, high</option>
            <option value="h">High only</option>
          </select>
        </span>
        </> : null}
        <button className="btn sm" type="button" aria-pressed={drawing} onClick={() => setDrawing((d) => !d)}>✎ Draw area</button>
      </div>

      <div className="overlay">
        <aside className="side" aria-label="Summary and layers">
          <Panel title="Overview" aside={dataMode === "live" ? "Live · last 24 h" : dataMode === "backend" ? `Backend · ${monthLabel(mi)}` : archiveActive ? "NASA FIRMS archive" : monthLabel(mi)}>
            <div className="flex flex-col gap-2.5">
              <span className="chip self-start">Area · {areaLabel(area)}</span>
              <div>
                {dataMode !== "sample" ? <>
                  <div className="kpi-big num" style={{ fontSize: 42 }}>{liveSummary ? fmt(liveSummary.modis + liveSummary.viirs) : remoteState?.loading ? "…" : "—"}</div>
                  <div className="kpi-label">{dataMode === "backend" ? "backend detections in the selected month" : "real detections in the last 24 hours"}</div>
                  <p className="note">MODIS {fmt(liveSummary?.modis ?? 0)} · VIIRS {fmt(liveSummary?.viirs ?? 0)}</p>
                </> : <>
                  <div className="kpi-big num" style={{ fontSize: 42 }}>{fmt(displayStats.harmonized)}</div>
                  <div className="kpi-label">{archiveActive ? "NASA FIRMS archive records" : "generated sample records"}</div>
                </>}
              </div>
              {dataMode === "sample" && archiveState.loading ? <p className="note" role="status">Loading NASA FIRMS archive…</p> : null}
              {remoteState?.loading ? <p className="note" role="status">{dataMode === "backend" ? "Loading backend data…" : "Fetching NASA FIRMS data…"}</p> : null}
              {remoteState?.error ? <p className="note" role="alert">{remoteState.error} <button className="btn sm" type="button" onClick={remoteState.retry}>Retry</button></p> : null}
              {remoteState?.data ? <>
                <p className="note">Snapshot generated {new Date(remoteState.data.generatedAt).toLocaleString()}{dataMode === "live" ? " · server cache may be up to 30 minutes old" : ""}.</p>
              {incompleteSources.length ? <p className="note" role="status">{incompleteSources.length} source file{incompleteSources.length === 1 ? " is" : "s are"} empty, unavailable, or more than 24 hours old; counts may be incomplete or stale.</p> : null}
              </> : null}
            </div>
          </Panel>

          <Panel title="Layers" aside={remoteActive ? (dataMode === "backend" ? "Backend" : "NASA FIRMS") : "generated sample"}>
            {remoteActive && liveSummary ? <>
              {liveSummary.modisBySatellite.map((row) => <div className="layer" style={{ gridTemplateColumns: "auto 1fr auto", cursor: "default" }} key={row.satellite}><i className="sw sq" /><span>MODIS · {row.satellite}</span><span className="num muted">{fmt(row.count)} · {fmt(row.paired)} paired</span></div>)}
              {liveSummary.viirsBySatellite.map((row) => <div className="layer" style={{ gridTemplateColumns: "auto 1fr auto", cursor: "default" }} key={row.satellite}><i className="sw ci" /><span>VIIRS · {row.satellite}</span><span className="num muted">{fmt(row.count)} · {fmt(row.paired)} paired</span></div>)}
              <p className="note">Heat density, detections, and pair links are real {dataMode === "backend" ? "backend" : "FIRMS"} observations.</p>
              {dataMode === "live" ? liveState.data?.sources.map((source) => <p className="note" key={source.name}>{source.name}: {source.ok ? `${fmt(source.rows)} rows${source.updated ? ` · updated ${source.updated}` : ""}${source.rows === 0 ? " · empty" : ""}${isSourceStale(source.updated) ? " · stale" : ""}` : "unavailable"}</p>) : dataMode === "backend" ? remoteState?.data?.sources.map((source) => <p className="note" key={source.name}>{source.name}: {fmt(source.rows)} rows</p>) : <p className="note">Historical NASA FIRMS detections for {area?.kind === "country" ? area.name : "selected area"}, {monthLabel(mi)}.</p>}
            </> : dataMode === "sample" ? layerRows.map((row) => (
              <label className="layer" key={row.key}>
                <input type="checkbox" checked={layers[row.key]} onChange={(e) => setLayers({ ...layers, [row.key]: e.target.checked })} />
                <i className={`sw ${row.swatch}`} />
                <span>{row.label}</span>
                <span className="num muted">{fmt(row.count)}</span>
              </label>
            )) : <p className="note">Loading satellite counts…</p>}
          </Panel>

          {dataMode === "sample" ? <Panel title="Real NASA detections" aside="GIBS">
            <label className="layer" style={{ gridTemplateColumns: "auto 1fr" }}>
              <input type="checkbox" checked={realOn} onChange={(e) => setRealOn(e.target.checked)} />
              <span>Show the actual detections for one day</span>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <select className="field" aria-label="Sensor and satellite" value={realLayer} onChange={(e) => setRealLayer(e.target.value as ThermalLayerId)}>
                {THERMAL_LAYERS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <input className="field" type="date" aria-label="Day" value={date} onChange={(e) => { if (isIsoDate(e.target.value)) setRealDate(e.target.value); }} />
            </div>
            <p className="note">
              {archiveActive
                ? "This NASA GIBS layer shows one day. The markers and counts above use the monthly NASA FIRMS archive."
                : "These are NASA&apos;s own thermal-anomaly layers for that day. The markers and counts above are generated sample data, so the two will not line up."}
            </p>
          </Panel> : null}

          <Panel title="Seen by both sensors, or one" aside={remoteActive && liveSummary ? `${fmt(liveSummary.pairs)} pair links` : undefined}>
            {remoteActive && liveSummary ? <>
              <SplitBars rows={[
                { label: "Matched detections", value: liveSummary.pairedModis + liveSummary.pairedViirs, color: "var(--magma-5)" },
                { label: "MODIS only", value: liveSummary.modis - liveSummary.pairedModis, color: "var(--cool)" },
                { label: "VIIRS only", value: liveSummary.viirs - liveSummary.pairedViirs, color: "var(--hot)" },
              ]} />
              <p className="note">Pair links indicate a possible match within {windowMinutes} minutes and {displayRaw?.rule.maxKm} km. Detections outside the window remain visible as unmatched.</p>
              {liveSummary.medianKm !== null ? <p className="note">Median pair distance {liveSummary.medianKm.toFixed(2)} km; median time gap {liveSummary.medianMinutes?.toFixed(0)} min.</p> : null}
              {dataMode !== "sample" ? <p className="note">Aqua and Terra pass at different times from VIIRS, so a 30-minute window can leave detections unmatched; this does not mean no fire was detected.</p> : null}
            </> : dataMode === "sample" ? <SplitBars
              rows={[
                { label: "Potentially corresponding pairs", value: sampleStats.pairs, color: "var(--magma-5)" },
                { label: "MODIS only", value: sampleStats.modisOnly, color: "var(--cool)" },
                { label: "VIIRS only", value: sampleStats.viirsOnly, color: "var(--hot)" },
              ]}
            /> : <p className="note">Loading pair counts…</p>}
          </Panel>

          <Panel title="Area of interest">
            <select
              className="field mb-2" aria-label="Country" value={area?.kind === "country" ? area.name : ""}
              onChange={(e) => (e.target.value ? setView({ country: e.target.value }) : clearArea())}
            >
              <option value="">Choose a country…</option>
              {[...ds.world.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
            <form key={area?.bbox.join(",") ?? "world"} onSubmit={applyBounds}>
              <div className="aoi-inputs">
                {(["w", "s", "e", "n"] as const).map((k, i) => (
                  <input key={k} name={k} inputMode="decimal" placeholder={k.toUpperCase()} aria-label={["West longitude", "South latitude", "East longitude", "North latitude"][i]} defaultValue={area?.kind === "bbox" ? area.bbox[i] : ""} />
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button className="btn sm solid" type="submit">Apply</button>
                <button className="btn sm" type="button" onClick={clearArea}>Whole world</button>
              </div>
            </form>
            <p className="note" role={areaMessage ? "alert" : undefined}>
              {areaMessage ?? "Click a country, or press Draw area and drag a rectangle. The area applies to every screen."}
            </p>
          </Panel>

          <Panel title={dataMode === "live" ? "Export" : dataMode === "backend" ? "Backend export" : archiveActive ? "Export NASA FIRMS archive" : "Export sample history"}>
            <div className="flex flex-wrap gap-2">
              <button className="btn sm" type="button" disabled={dataMode !== "sample" || archiveActive} title={dataMode === "backend" ? "Use the backend export API" : dataMode === "live" ? "Live CSV export is not available yet" : archiveActive ? "Archive CSV export is not available yet" : undefined} onClick={() => exportMonth(ds, mi, area)}>CSV</button>
              <button className="btn sm" type="button" disabled title="Needs the backend export endpoint">GeoJSON</button>
            </div>
            {dataMode === "live" ? <p className="note">CSV export is available in Sample history.</p> : dataMode === "backend" ? <p className="note">Use the backend <code>/api/exports</code> endpoint for this dataset.</p> : archiveActive ? <p className="note">CSV export is not available for archive detections yet.</p> : null}
          </Panel>
        </aside>

        <aside className="side right" aria-label="Selected record">
          <Panel title="Selected record">
            <div aria-live="polite">
              {selectedCluster ? (
                <HarmonizedRecord cluster={selectedCluster} mi={mi} />
              ) : selectedDetection ? (
                <DetectionRecord detection={selectedDetection.detection} cluster={selectedDetection.cluster} onOpen={(id) => setSelection({ kind: "record", id })} />
              ) : selectedLive && displayRaw ? (
                <LiveDetectionRecord detail={selectedLive} baseTime={displayRaw?.baseTime ?? ""} windowMinutes={windowMinutes} />
              ) : (
                <p className="muted m-0">Select a marker on the map.</p>
              )}
            </div>
          </Panel>
          <Panel title="Legend">
            <div className="flex flex-col gap-3">
              <div className="markers flex-col items-start">
                <span><i className="sw sq" />MODIS detection, 1 km{archiveActive ? " · NASA FIRMS archive" : dataMode === "sample" ? " · sample" : dataMode === "backend" ? " · backend" : " · FIRMS"}</span>
                <span><i className="sw ci" />VIIRS detection, 375 m{archiveActive ? " · NASA FIRMS archive" : dataMode === "sample" ? " · sample" : dataMode === "backend" ? " · backend" : " · FIRMS"}</span>
                <span><i className="sw ln" />{archiveActive ? `Archive pairs · ≤ ${windowMinutes} min` : dataMode === "sample" ? "Potentially corresponding" : `${dataMode === "backend" ? "Backend" : "FIRMS"} pairs · ≤ ${windowMinutes} min`}</span>
                {dataMode === "sample" && !archiveActive ? <span><i className="sw di" />Harmonized record</span> : null}
              </div>
              <div className="legend">
                <div className="title">Detection density (zoomed out)</div>
                <div className="ramp" />
                <div className="ends"><span>Fewer</span><span>More</span></div>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
