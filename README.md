# RDx Civil QM — Quality Control & Lab Testing

Standalone mobile-first PWA for road-construction quality control & lab testing.
Separate app from the RDx ERP. Play Store bound (via TWA/Bubblewrap).

## Stack
- Frontend: React 19 + Vite + Tailwind CSS v4, mobile-first, PWA (manifest + service worker + offline IndexedDB queue)
- Backend: Node.js + Express + tRPC 11 + superjson
- ORM: Drizzle + mysql2 (TiDB Cloud Serverless, MySQL-compatible)
- Deploy: Docker + render.yaml (free tier)

## Quick start (local dev)
```bash
cp .env.example .env        # set DATABASE_URL to your TiDB `qm` database
pnpm install
pnpm exec drizzle-kit migrate   # or: pnpm db:migrate
pnpm dev                    # server on :3000, vite proxy for /api
```

## Test masters (36 tests, 7 categories)
All definitions live in `shared/testDefinitions.ts` — single source of truth used by
both client (live form calc) and server (authoritative compute on save).

| Category | Tests |
|---|---|
| Soil (9) | Grain Size, Liquid Limit, Plastic Limit & PI, Std Proctor, Mod Proctor, Sand Replacement, Core Cutter, Lab CBR, Free Swell Index |
| Aggregate (8) | Sieve Analysis, Impact Value, Crushing Value, LA Abrasion, Flakiness, Elongation, Water Absorption, Specific Gravity |
| Bitumen (6) | Penetration, Softening Point, Ductility, Viscosity, Flash & Fire Point, Specific Gravity |
| Bituminous Mix (3) | Marshall Stability & Flow, Binder Content, Air Voids/VMA/VFB |
| Concrete (2) | Cube Strength 7/28d, Slump |
| Cement (5) | Fineness, Consistency, Setting Time, Soundness, Compressive Strength |
| Steel (3) | Tensile/Yield/Elongation, Bend Test, Weight per metre |

Each test: typed input fields → auto calculations → MoRTH/IS pass/fail limits
(grade-aware where applicable, e.g. bitumen VG grades, concrete grades, steel grades).

## Key files
- `shared/testDefinitions.ts` — all test definitions + compute engine
- `drizzle/schema.ts` — projects, test_masters, test_entries
- `drizzle/0001_seed_masters.sql` — seeds all 36 test masters (idempotent)
- `server/routers.ts` — tRPC: projects, testMasters, entries, dashboard
- `client/src/components/TestForm.tsx` — dynamic form renderer (fields → live calcs → limits)
- `client/src/pages/` — Dashboard, Projects, Tests, Entry, Register, Report (print)

## Deploy (Render free tier)
1. Push to GitHub, Render → New → Blueprint → select repo
2. Set `DATABASE_URL` (TiDB Cloud, database `qm`) and `DB_SSL=true`
3. Migrations run automatically at boot via `entrypoint.sh`

## Play Store (TWA)
PWA is installable (manifest + SW + icons generated at build time).
AAB via Bubblewrap against the deployed HTTPS URL — to be done after first deploy.
