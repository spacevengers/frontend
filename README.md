# TerraWatch — Frontend

Next.js 16 + Tailwind CSS 4 + MapLibre GL (via `react-map-gl/maplibre`). Package manager: pnpm.

```bash
pnpm install
cp .env.example .env.local   # then set NEXT_PUBLIC_API_URL to the backend
pnpm dev
```

## Layout

```
src/lib/types.ts       data contract (spec §7.3) — update when the backend schema is final
src/lib/api.ts         API client for spec §11 endpoints (needs NEXT_PUBLIC_API_URL)
src/lib/maplibre.ts    import before rendering a map (worker URL fix)
scripts/               copies the MapLibre worker into public/ on predev/prebuild
```

## MapLibre notes

- Render map components through `next/dynamic` with `{ ssr: false }`; MapLibre needs `window`.
- `import "@/lib/maplibre"` in the map component. Without it the worker 404s under Turbopack
  and the map is blank.
- `NEXT_PUBLIC_*` variables are shipped to the browser. Never put secrets in them.
