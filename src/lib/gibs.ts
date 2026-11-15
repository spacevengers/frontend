const GIBS = "https://gibs.earthdata.nasa.gov";

export const BLUE_MARBLE_TILES = `${GIBS}/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`;

export const blueMarbleImage = (width: number, height: number) =>
  `${GIBS}/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief_Bathymetry` +
  `&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=${Math.round(width)}&HEIGHT=${Math.round(height)}`;

export function blueMarbleCrop([west, south, east, north]: [number, number, number, number], longestSide = 1024): string | null {
  const ok = [west, south, east, north].every(Number.isFinite) && west >= -180 && east <= 180 && south >= -90 && north <= 90 && east > west && north > south;
  if (!ok) return null;
  const scale = longestSide / Math.max(east - west, north - south);
  const width = Math.max(16, Math.round((east - west) * scale));
  const height = Math.max(16, Math.round((north - south) * scale));
  return (
    `${GIBS}/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief_Bathymetry` +
    `&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326&BBOX=${south},${west},${north},${east}&WIDTH=${width}&HEIGHT=${height}`
  );
}

export const THERMAL_LAYERS = [
  { id: "VIIRS_SNPP_Thermal_Anomalies_375m_All", label: "VIIRS S-NPP, 375 m", from: "2012-01-20" },
  { id: "VIIRS_NOAA20_Thermal_Anomalies_375m_All", label: "VIIRS NOAA-20, 375 m", from: "2020-01-01" },
  { id: "MODIS_Aqua_Thermal_Anomalies_All", label: "MODIS Aqua, 1 km", from: "2002-07-04" },
  { id: "MODIS_Terra_Thermal_Anomalies_All", label: "MODIS Terra, 1 km", from: "2000-02-24" },
] as const;

export type ThermalLayerId = (typeof THERMAL_LAYERS)[number]["id"];

export const isThermalLayer = (id: string): id is ThermalLayerId => THERMAL_LAYERS.some((l) => l.id === id);

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const isIsoDate = (value: string) => ISO_DATE.test(value);

export function thermalTiles(layer: string, date: string): string | null {
  if (!isThermalLayer(layer) || !isIsoDate(date)) return null;
  return (
    `${GIBS}/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}` +
    `&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=512&HEIGHT=512&TIME=${date}`
  );
}
