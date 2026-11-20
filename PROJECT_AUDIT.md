# MeterIQ Implementation Audit

This document reflects the delivered state of the repository, not the original
prototype audit. The earlier version described a FastAPI-only backend with mock
frontend fallbacks; that is no longer the architecture.

## 1. Delivered architecture

- **Frontend:** React 19 + Vite. All screens call `frontend/src/services/*`,
  which call the Express API. Session state is stored client-side and restored
  through `GET /api/auth/me`.
- **API:** Node.js + Express at port `5050`. It owns JWT authentication, role
  enforcement, MongoDB persistence, response shaping, CSV generation, and the
  HTTP contract used by the browser.
- **Database:** MongoDB (`meteriq`) owns `users`, `meters`, `anomalies`, and
  `investigations`.
- **ML service:** FastAPI at port `8000`. It reads processed 3-minute CSVs,
  builds an hourly Parquet cache, and serves meter/analytics/anomaly/forecast
  data. Express proxies these endpoints rather than exposing FastAPI directly
  to the browser.

## 2. Module status

| Module | Data source | Status |
| --- | --- | --- |
| Login / Signup / Logout | Express + MongoDB | Live; server-assigned roles; no demo credentials |
| Dashboard | Express → FastAPI summary/cache | Live |
| Meter Management | Express → ML catalogue | Live; filtering, search, pagination |
| Meter Analysis | Express → ML meter/consumption | Live; coverage, risk, series |
| Consumption Analytics | Express → ML hourly cache | Live; 7D/30D/3M ranges |
| Anomaly Detection | Express → ML summary + observation artifact | Live; meter KPIs, filters, pagination, per-meter records |
| Load Forecasting | Express → ML forecast artifact | Live; backtested chart, model/baseline metrics, horizons |
| Investigations | Express + MongoDB | Live; create/assign/status/notes/history, role-gated |
| Reports | Express + ML/Mongo | Live; summary and four CSV exports; anomaly CSV unavailable with the artifact |
| Data Quality | Express → ML aggregate | Live |
| Meter Health | Express → ML meter catalogue | Live; missing hardware fields shown as unavailable |
| Settings | Local preferences + read-only ML metadata | Live; no fake threshold controls |
| About | Static project/limitations copy | Live |

## 3. Contract fixes made

- Added the Node/Express API layer and routed the frontend through it.
- Added MongoDB models and persistence for users, meter metadata, anomaly
  records, and investigations.
- Replaced frontend mock data and mock fallbacks with live service calls,
  loading/empty/error states, and explicit artifact-unavailable states.
- Added JWT authentication, role checks, expired-token handling, and protected
  rendering.
- Added server-side CSV exports with `Content-Disposition`; exposed that header
  through CORS.
- Fixed the ML `/analytics/consumption` endpoint where a parameter named
  `range` shadowed Python's built-in `range()`.
- Fixed ML path configuration to derive `BASE_DIR` from the repository instead
  of a hard-coded absolute path.
- Added a real hourly cache built from processed 3-minute CSVs
  (`data/output/api/hourly_consumption.parquet`).
- Fixed the anomaly scoring path (found by a failing end-to-end test):
  `_process_one_meter` never created the `isolation_forest_used` column the
  pipeline and explainability layers required, and `scoring.py` had been
  replaced with a shared-threshold weighted average that contradicted the
  documented methodology and reproduced the Phase B.1 83 %-flag bug. Scoring is
  again `max(baseline_strength, IF_strength)` with the IF percentile converted
  using its own 90/97 thresholds; explainability now checks the IF percentile
  threshold instead of the baseline severity threshold.
- Rewrote `ml/forecasting/pipeline.py` for the actual dataset: it reads the
  Phase A feature cache, uses 3-minute lag/rolling features, applies a
  per-meter 30-day chronological holdout, trains a pooled
  `HistGradientBoostingRegressor` over 18,770,678 training rows, and writes
  `forecast_predictions.parquet`/`forecast_report.json` with per-meter MAE/MAPE
  for model and baseline.
- Generated both previously missing artifacts from the real data:
  `anomaly_observations.parquet` (19,648,865 scored rows, 84 meters) and
  `forecast_predictions.parquet` (878,187 holdout rows, 84 meters).
- Fixed small-value display bugs in the forecast/consumption charts, where
  `toFixed(1)`/`toFixed(2)` rendered real kWh predictions as "0.0 kWh".
- Added FastAPI/Uvicorn requirements and the missing frontend env example.
- Removed unused mock/demo files and decorative controls.

## 4. Known unresolved issues

1. Raw hardware fields such as voltage/current/frequency metadata are absent
   for many meters; Meter Health reports the gap instead of synthesizing values.
2. Large generated artifacts are excluded from the source ZIP for size
   (`anomaly_observations.parquet` ≈ 1 GB, Phase A feature/processed caches
   ≈ 900 MB). They exist in this workspace and are regenerated with
   `python -m ml.pipeline`, `python -m ml.anomaly.pipeline`, and
   `python -m ml.forecasting.pipeline`. The ZIP ships the small artifacts.
3. The frontend bundle exceeds Vite's 500 kB warning threshold. This is a build
   warning only.
4. There is no configured ESLint run and no automated Express test suite; live
   API and browser checks were used for verification.
5. Forecasting is a chronological backtest of the last 30 days per meter, not a
   live future-feed scheduler.

## 5. Verification summary

- `frontend/npm run build` succeeds.
- `ml-service` `python -m pytest -q`: **76 passed**.
- Phase A, anomaly, and forecasting pipelines all ran to completion on the real
  dataset; artifacts and manifests written under `ml-service/data/output/`.
- `curl /health` reports API/MongoDB/ML status; ML health flags
  `anomaly_observations`, `forecast_predictions`, and `hourly_cache` all true.
- Authenticated smoke tests passed for health, auth, role enforcement, meters,
  meter detail/consumption, analytics (consumption/diurnal/regional/data
  quality), anomaly summary/status/list/per-meter list, forecast meta/series,
  reports summary, all four CSV exports (with `Content-Disposition`), and
  investigation create/note/status flows.
- Browser walkthrough passed for every routed page with no console errors,
  including the anomaly observation table and forecast chart with real metrics.
- Browser CSV download used the server-provided filename.

## 6. Setup

See `README.md` for prerequisites, environment files, exact start commands,
role provisioning, and the artifact regeneration caveats.
