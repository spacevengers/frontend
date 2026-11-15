# TerraWatch Frontend

This frontend supports the TerraWatch NASA MODIS and VIIRS active-fire project. Its current visible product name is still “Burn Calendar”; `src/lib/brand.ts` remains unchanged until the team settles the product name. The app includes a MapLibre map, a globe, a sample-history calendar, and a live FIRMS map mode.

## Run locally

Requires Node.js and pnpm 12 (the package manager and version are recorded in `package.json` and `pnpm-lock.yaml`).

```bash
pnpm install
pnpm dev --port 3100
```

Open `http://localhost:3100`. The map is available at `/map`, the globe at `/`, the calendar at `/calendar`, and data notes at `/about`.

## Data modes

- **Sample history** powers the map, globe, and calendar with generated placeholder records. These are not NASA observations.
- **Backend · month** on `/map` and `/` reads the Go backend through `/api/integration/*` when `NEXT_PUBLIC_API_URL` is set. It requests the selected month and area, then reuses the live map renderer. Set it in `.env.local`:
  ```bash
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```
- **Live · last 24 h** on `/map` and `/` requests `/api/firms/latest`, which downloads public NASA FIRMS CSV files on the server, spatially pairs MODIS and VIIRS detections, and caches the result for 30 minutes. The map and globe refresh every 30 minutes while their page is open. No FIRMS API key is required for these public CSVs. On the map, select a 30, 60, 120, or 180 minute time window to change which pairs are highlighted and counted; changing the window does not download the dataset again.
- NASA GIBS Blue Marble imagery and the optional daily thermal-anomaly overlay are separate products from the live FIRMS CSV mode.

The live endpoint reports each source's availability, row count, and upstream `Last-Modified` value. A partial or delayed source can make the snapshot incomplete. Pairing indicates possible correspondence under the displayed distance and time rule; it does not confirm that detections came from the same fire. See `/about` for interpretation and limitations.

## Attribution

We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) (https://earthdata.nasa.gov/lance) and NASA's Earth Science Data and Information System (ESDIS).

MapLibre GL's worker is copied into `public/` by the `predev` and `prebuild` scripts for compatibility with Turbopack. The generated asset is not source-controlled.
