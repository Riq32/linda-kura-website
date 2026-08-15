# Linda-Kura

**A live, drill-down election results explorer for Kenya.**
National → county → constituency → ward, on a tilted 3D map, with results for
President, Governor, MP, and MCA races at every level.

> *Kura* is Swahili for "vote." Linda-Kura combines that with "protect" —
> reflecting the project's emphasis on transparent data provenance over raw
> speed.

---

## What this is

Linda-Kura lets a user tap through Kenya's administrative hierarchy — from
the national map down to an individual ward — and see who's leading each
race at that level, color-coded by party, with turnout and vote-share
detail. It supports both live API-fed results and clearly-labeled
mock/historical data where live numbers aren't yet available for a given
race or level.

**This is not an official results source.** Kenya's Independent Electoral
and Boundaries Commission (IEBC) is the only legally authoritative source
for election results. Every number shown in Linda-Kura is tagged with its
provenance (official / verified crowdsourced / historical / mock) so this
distinction is never ambiguous to the user.

---

## Features

- **3D drill-down map** — county → constituency → ward, built on real
  boundary geometry, with hover tooltips and a clickable breadcrumb trail.
- **Search-to-navigate** — type a county, constituency, or ward name to jump
  straight to it, as an alternative to clicking through the map.
- **Race tabs per unit** — President, Governor, MP, and MCA results shown
  together for whichever unit is selected, with non-native races (e.g.
  presidential results while viewing a ward) clearly labeled as a
  contribution to the parent-level race rather than presented as native to
  that unit.
- **Party-coded, margin-shaded choropleth** — each unit is colored by its
  leading party, with fill opacity reflecting the margin of victory.
- **Party filter** — isolate results by one or more political parties across
  the current view.
- **Provenance badges** — every figure is marked as official, verified
  crowdsourced, historical, or mock — never presented ambiguously.
- **Public / Admin modes** — public users get full read-only access with no
  login wall; authenticated admins get result submission/correction tools
  and an audit trail.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend framework | Next.js (React, TypeScript) |
| Map | MapLibre GL JS (`fill-extrusion` for the 3D tilt) |
| Styling / motion | Tailwind CSS + Framer Motion |
| Backend | Node.js (Fastify) |
| Database | PostgreSQL + PostGIS |
| Cache | Redis |
| Realtime | Socket.IO (WebSocket, with polling fallback) |
| Auth | Auth.js (self-hosted) |
| Hosting (target) | Vercel (frontend) + Render/Fly.io (backend) + Cloudflare R2/S3 (static GeoJSON) |

See `kura-product-design-spec.md` for the full palette, typography, and
motion design tokens.

---

## Data

### Boundaries
`counties.geojson` (47 features), `constituencies.geojson` (290 features),
`wards.geojson` (1,452 features) — sourced from geoBoundaries, cleaned and
joined in QGIS/geopandas so that every constituency carries its parent
county's `shapeID`/`shapeName`, and every ward carries both its parent
constituency's and county's.

**Known gap:** six constituencies (Dagoretti, Mbeere North/South,
Chuka/Igambang'ombe, Mwingi Central, and one unresolved) use outdated
boundary geometry and did not join cleanly against current candidate data.
See `MATCH_REPORT.md` for details — these need corrected source geometry
before their ~126 wards can be considered reliable.

### Results
- **Live**: `GET /api/v1/dashboard` and `POST /api/v1/results` from the
  project's results API. County/constituency/ward are returned as plain
  name strings, not `shapeID`s — the frontend resolves these via a shared
  `nameToShapeID()` matching utility before writing into the results store.
- **Historical (2022)**: real candidate rosters and party affiliation for
  Governor, MP, and MCA races (`governor_candidates.json`,
  `mp_candidates.json`, `mca_candidates.json`), plus real vote counts for
  the presidential race at county level (`president_results_by_county.json`).
  Governor/MP/MCA vote counts are not available in this source and are
  mock-generated (seeded by `shapeID`, so stable across reloads) until real
  figures can be sourced.
- **Registered voters**: real, at all three levels
  (`registered_voters_county.json`, `_constituency.json`, `_ward.json`).

All results are keyed internally by `shapeID`, regardless of source, so map
and panel components never need to know whether they're rendering live,
historical, or mock data.

---

## Project structure

```
/app                 Next.js app router pages and layouts
/components
  /map                Map component, drill-down + hover + search logic
  /results-panel       Race tabs, candidate bars, party filter, provenance badges
  /admin                Admin login, result submission/correction forms
/lib
  nameToShapeID.ts     Shared boundary-name matching utility
  store.ts             shapeID-keyed results store
/data
  counties.geojson
  constituencies.geojson
  wards.geojson
  governor_candidates.json
  mp_candidates.json
  mca_candidates.json
  president_candidates.json
  president_results_by_county.json
  registered_voters_county.json
  registered_voters_constituency.json
  registered_voters_ward.json
/server               Fastify backend, PostGIS schema, Socket.IO setup
kura-product-design-spec.md
MATCH_REPORT.md
```

---

## Getting started

```bash
# install dependencies
npm install

# copy environment variables
cp .env.example .env.local
# set NEXT_PUBLIC_API_BASE_URL, DATABASE_URL, REDIS_URL, AUTH_SECRET

# run the frontend
npm run dev

# run the backend (separate terminal)
cd server && npm run dev
```

The frontend expects the results API reachable at
`NEXT_PUBLIC_API_BASE_URL` (currently `http://34.68.88.79/api/v1` for the
shared dev instance — point this at your own instance for local backend
work).

---

## Known limitations

- Party affiliation is not yet present in the live results API (`party` is
  always `null`); a local candidate-name-to-party fallback mapping is used
  until this is resolved server-side.
- The live API's per-county/per-constituency aggregate figures in
  `/dashboard` have not been verified against a multi-result dataset — their
  exact aggregation semantics (total votes cast vs. leading candidate's
  votes) should be confirmed with the API's maintainers before relying on
  them for map coloring at scale.
- Ward-level MCA vote counts are the least-covered data point nationally;
  full national coverage will likely require IEBC's original Form 36
  declarations, which are not available as structured data.

---

## License

TBD.