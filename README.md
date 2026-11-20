# MeterIQ — Smart Meter Analytics Platform

MeterIQ is a smart-meter analytics application built around three services:

- a React + Vite analyst console,
- a Node.js/Express API that owns authentication, MongoDB persistence, and the public API contract,
- a Python/FastAPI service that reads the processed meter data and exposes analytics, anomaly, and forecasting endpoints.

The frontend talks only to the Express API. Express proxies analytics requests to FastAPI and stores users, meter metadata, and investigation cases in MongoDB.

> **Status:** every module is wired to live services: dashboard, meter
> catalogue, consumption analytics, anomaly detection (meter summary **and**
> observation records), load forecasting, investigations, reports/CSV, data
> quality, meter health, settings, and authentication. The anomaly and
> forecasting artifacts described below have been generated from the real
> dataset in this workspace. The UI never substitutes mock rows; a module only
> shows an unavailable state when its artifact is genuinely absent. See
> [Known limitations](#known-limitations).

## Architecture

| Layer | Technology | Default address |
| --- | --- | --- |
| Frontend | React 19 + Vite 6 | `http://localhost:5173` |
| API | Node.js + Express 4 | `http://localhost:5050` |
| Database | MongoDB 7 | `mongodb://localhost:27017/meteriq` |
| ML service | Python 3.9+ + FastAPI | `http://127.0.0.1:8000` |

```
frontend  ──HTTP/JWT──▶  Express API  ──Mongoose──▶  MongoDB
                              │
                              └──HTTP──▶  FastAPI ML service  ──▶  Parquet / CSV artifacts
```

Port `5050` is used instead of `5000` because macOS Control Center already binds `5000` on many machines. The ML service uses `8000`; use `ML_PORT`/`ML_HOST` to change it.

## Repository layout

```
backend/                 Express API
  server.js              process entry point
  src/app.js             middleware, routes, health check, error handling
  src/controllers/       auth, meters, analytics, anomalies, forecast, reports, investigations
  src/models/            User, Meter, Anomaly, Investigation
  src/services/          ML HTTP client
  src/utils/             CSV helpers
frontend/                React console
  src/pages/             one component per screen
  src/services/          API clients, session storage, preferences
  src/components/        layout, toasts, state views, badges
  src/charts/            Recharts wrappers
ml-service/              FastAPI analytics service + ML pipeline code
  main.py                API entry point
  ml/api_data.py         hourly Parquet cache and artifact loaders
  ml/anomaly/            anomaly detection pipeline
  ml/forecasting/        forecasting pipeline
  data/Data/             raw source CSVs (not committed)
  data/processed/        cleaned 3-minute CSVs (not committed)
  data/output/           generated artifacts
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- MongoDB 7 running locally (or a connection string to another instance)
- The MeterIQ processed data under `ml-service/data/processed/` for live analytics

The processed files are large and are not included in the source ZIP. The API expects files named `processed_*.csv` with at least these columns:

```
timestamp, consumption, meter_id
```

The current dataset uses 3-minute sampling (20 intervals per hour).

## Environment files

Copy the examples and replace the secrets. Never commit a populated `.env`.

### `backend/.env`

```env
PORT=5050
MONGODB_URI=mongodb://localhost:27017/meteriq
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_TIMEOUT_MS=60000
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
NODE_ENV=development
```

`JWT_SECRET` is required; the API refuses to start without it.

### `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:5050/api
VITE_USE_LIVE_API=true
```

### ML service (optional)

The ML service works without an env file and resolves paths relative to `ml-service/`. Override them only if the data lives elsewhere:

```env
ML_HOST=127.0.0.1
ML_PORT=8000
METERIQ_DATA_DIR=/absolute/path/to/ml-service/data
METERIQ_OUTPUT_DIR=/absolute/path/to/ml-service/data/output
METERIQ_CACHE_DIR=/absolute/path/to/ml-service/data/cache
ML_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Running the stack

Start each service in its own terminal from the repository root.

### 1. MongoDB

```bash
brew services start mongodb-community
# or: mongod --dbpath /path/to/db
```

### 2. ML service

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

Using `python main.py` is equivalent. The first analytics request may build
`data/output/api/hourly_consumption.parquet` from the processed CSVs. This is a
real aggregation of the 3-minute telemetry into hourly sums; it takes a few
minutes and is then reused.

### 3. Express API

```bash
cd backend
npm install
cp .env.example .env   # then set a real JWT_SECRET
npm start
```

The API prints `MeterIQ API listening on http://localhost:5050`.

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev -- --port 5173
```

Open `http://localhost:5173`.

### Health checks

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:5050/health
```

`/health` returns `503` when MongoDB or the ML service is unreachable, and
reports each dependency separately.

## Authentication and roles

- Public signup always creates an **analyst**. The API rejects attempts to
  request another role with `403`.
- **Analyst**: read access to dashboards, meters, analytics, anomalies,
  forecasts, reports, and investigations; can add notes to cases.
- **Supervisor / admin**: everything an analyst can do, plus creating cases,
  assigning priority/status, recording resolutions, and dispatching anomalies
  to investigations.
- Tokens are stateless JWTs. Logout calls the API then clears the client token.
  Expired or invalid tokens cause the frontend to return to the login screen.

There are no seeded demo accounts and no credentials in the UI. Provision a
supervisor directly in MongoDB after creating the account through signup:

```bash
mongosh mongodb://localhost:27017/meteriq --eval \
  'db.users.updateOne({email:"supervisor@example.com"},{$set:{role:"supervisor"}})'
```

The user must log in again for a new token to carry the updated role. Supported
roles are `analyst`, `supervisor`, and `admin`.

## API surface (Express, all protected unless noted)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API, MongoDB, ML dependency health (public) |
| `POST` | `/api/auth/signup` | Create analyst account (public) |
| `POST` | `/api/auth/login` | Issue JWT (public) |
| `POST` | `/api/auth/logout` | Explicit logout acknowledgement |
| `GET` | `/api/auth/me` | Current session user |
| `GET` | `/api/meters` | Meter catalogue with filters and pagination |
| `GET` | `/api/meters/health` | Reporting status, health grade, hardware fields |
| `GET` | `/api/meters/pipeline/status` | Anomaly/forecast pipeline state |
| `GET` | `/api/meters/:id` | Meter detail |
| `GET` | `/api/meters/:id/consumption` | Meter consumption series and anomaly context |
| `GET` | `/api/analytics/consumption` | Aggregate consumption by range/region/meter |
| `GET` | `/api/analytics/diurnal` | Hour-of-day weekday/weekend profile |
| `GET` | `/api/analytics/regional` | Regional risk/coverage summary |
| `GET` | `/api/analytics/data-quality` | Completeness, sampling, dropout, flags |
| `GET` | `/api/anomalies/summary` | Global anomaly KPIs |
| `GET` | `/api/anomalies/status` | Availability of observation-level records |
| `GET` | `/api/anomalies` | Observation records (503 while artifact is absent) |
| `GET` | `/api/anomalies/meters/:id` | Per-meter observations (503 while absent) |
| `GET` | `/api/forecast/meta` | Available meters, horizons, model metadata |
| `GET` | `/api/forecast?meterId=...` | Forecast series (503 while artifact is absent) |
| `GET` | `/api/investigations` | Case list with filters |
| `POST` | `/api/investigations` | Create case (supervisor/admin) |
| `PATCH` | `/api/investigations/:id` | Update status/priority/assignment (supervisor/admin) |
| `POST` | `/api/investigations/:id/notes` | Add note (any authenticated role) |
| `GET` | `/api/reports/summary` | Cross-module reporting KPIs |
| `GET` | `/api/reports/meters.csv` | Meter CSV download |
| `GET` | `/api/reports/anomalies.csv` | Anomaly CSV download (503 while artifact is absent) |
| `GET` | `/api/reports/regional.csv` | Regional CSV download |
| `GET` | `/api/reports/investigations.csv` | Investigation CSV download |

CSV responses set `Content-Disposition`; the Express CORS configuration exposes
that header so the browser uses the server-provided filename.

## Data and ML artifacts

The ML service reads generated files from `ml-service/data/output/`:

| Artifact | Used by | State in this delivery |
| --- | --- | --- |
| `api/hourly_consumption.parquet` | meters, analytics, reports, data quality, meter health | Present; built from processed telemetry |
| `anomaly/meter_anomaly_summary.parquet` | dashboard, anomaly KPIs, regional risk, meter detail | Present |
| `anomaly/anomaly_observations.parquet` | observation-level anomaly table, anomaly CSV | Present (generated; ~1 GB, excluded from the source ZIP) |
| `anomaly/anomaly_run.json` | pipeline status | Present |
| `forecasting/forecast_predictions.parquet` | forecast chart and metrics | Present |
| `forecasting/forecast_report.json` | model metrics | Present |

When an artifact is absent the API returns `503` with the expected path, and the
UI shows an unavailable state instead of mock rows. This delivery does not
fabricate any of them.

### Regenerating the ML artifacts

All three pipelines run from `ml-service/` with the virtualenv active:

```bash
# 1. Phase A: raw CSVs -> cleaned 3-minute data -> feature cache
python -m ml.pipeline --data-dir data/Data

# 2. UC1 anomaly detection -> summary + observation-level records
python -m ml.anomaly.pipeline

# 3. UC2 load forecasting -> predictions + evaluation report
python -m ml.forecasting.pipeline
```

Measured on this dataset (19,648,865 rows, 84 meters): Phase A ≈ 72 s,
anomaly ≈ 120 s, forecasting ≈ 49 s, with peak memory well under the machine's
RAM. `POST /pipeline/run` on the ML service runs phase A and the anomaly
pipeline in the background.

The forecasting pipeline reads the Phase A **feature cache** and uses its
precomputed 3-minute lag/rolling features, a pooled
`HistGradientBoostingRegressor` trained on each meter's history before a
30-day chronological holdout, and `lag_1w` as the same-hour-last-week baseline.
The report records the feature list, training/test row counts, and per-meter
MAE/MAPE for both the model and the baseline.

## Delivery package

`MeterIQ-delivery.zip` in the repository root is the source deliverable
(179 files, ~11 MB): backend, frontend, ML service, docs, env examples, and the
small ML artifacts. It excludes `node_modules`, virtualenvs, `dist`, logs,
`.env` files, raw/processed/feature data, and the ~1 GB observation artifact;
regenerate those with the pipeline commands below.

## Verification performed

- Frontend production build: `npm run build` completes (758 kB JS; Vite emits
  its >500 kB warning).
- ML test suite: `python -m pytest -q` → **76 passed** (synthetic data, no
  CSVs required).
- ML pipelines executed end-to-end on the real dataset: Phase A feature build
  (19,648,865 rows), anomaly detection (all 84 meters, observation artifact
  written), and load forecasting (878,187 holdout predictions for 84 meters).
- API smoke tests: `/health`, auth (`signup`/`login`/`me`/`logout`), role
  enforcement, meters, meter detail/consumption, all analytics endpoints,
  anomaly summary/status/list/per-meter list, forecast meta/series, report
  summary, and all four CSV exports.
- Browser walkthrough: dashboard, meters, meter detail, consumption analytics,
  anomalies (observation table with filters/pagination), forecasting (chart,
  model and baseline metrics), investigations, reports, data quality, meter
  health, settings, and about; no console errors.
- Browser CSV download verified, including the server-provided filename.
- Unavailable-state fallbacks were verified earlier in development by removing
  artifacts; both now report `available: true` with real records.

There is no ESLint configuration in the frontend and no automated Express test
suite in this delivery; the API checks above were run manually against the live
stack.

## Known limitations

1. **Some raw hardware fields are absent.** Meter health reports what the
   telemetry actually contains; missing voltage/current/frequency metadata is
   shown as unavailable rather than invented.
2. **Large generated artifacts are not shipped in the source ZIP.**
   `anomaly_observations.parquet` (~1 GB) and the Phase A feature/processed
   caches (~900 MB) are excluded from the ZIP for size; regenerate them with
   the commands above. The ZIP includes the small artifacts (anomaly summary,
   forecast predictions/report, hourly cache) so analytics work immediately.
3. **The bundle is larger than Vite's 500 kB warning threshold.** This is a
   build warning, not a production failure.
4. **No automated Express tests or lint step.** Verification is via the live
   API/browser checks listed above.
5. **The forecasting model is a backtest, not a live scheduler.** It predicts
   the final 30 days of each meter's recorded history against held-out actuals;
   it is not connected to a future-data feed.

## Security notes

- Replace the example `JWT_SECRET`; the server exits if it is missing.
- CORS allows configured `FRONTEND_URL` origins plus localhost/127.0.0.1 in
  development. Tighten this for a deployed environment.
- Privileged roles are never self-assigned through the public API.
- `.env` files and generated logs are excluded from source control and from the
  delivery ZIP.
