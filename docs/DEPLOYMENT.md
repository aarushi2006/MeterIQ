# MeterIQ deployment guide

All deployable source lives under `code/`. The deployment targets are:

| Piece | Technology | Host | Root directory |
| --- | --- | --- | --- |
| Frontend | React 19 + Vite (static) | **Vercel** | `code/frontend` |
| Backend API | Node 20 + Express | **Render** (Docker) or Railway | `code/backend` |
| ML service | Python 3.11 + FastAPI | **Render** (Docker) or Railway | `code/ml-service` |
| Database | MongoDB | **MongoDB Atlas** (M0 is enough) | — |

```
browser
  └─ Vercel  (static bundle, VITE_API_BASE_URL baked in at build time)
       └─ Express API  (Render, /api/*)
            ├─ MongoDB Atlas   (users, investigations, meter catalogue)
            └─ FastAPI ML      (Render, internal URL)
                 └─ artifacts in /app/data/output
```

The browser never talks to the ML service directly; Express is the only public
API surface. GitHub Pages is **not** used for the application — the Pages site in
this repository stays the MkDocs documentation site (`mkdocs.yml`).

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (region close to the API, e.g. Mumbai/Singapore).
2. Database Access → add a user with a strong password.
3. Network Access → allow the API host. Render has no fixed egress IPs on
   Starter, so `0.0.0.0/0` with a strong password is the practical option; pin
   CIDRs on a paid plan.
4. Copy the SRV string and append the database name:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/meteriq?retryWrites=true&w=majority
```

5. Provision the first supervisor directly in Atlas (public signup only ever
   creates `analyst`):

```js
db.users.insertOne({
  email: "you@example.com",
  password: "<bcrypt hash>",
  fullName: "Your Name",
  role: "supervisor",
  createdAt: new Date(),
});
```

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'YourPassword'
```

---

## 2. ML service (Render)

Deployed from `code/ml-service` with its Dockerfile.

- **New → Web Service → Docker**, root directory `code/ml-service`.
- Plan: **Standard (2 GB)**. The service holds the hourly cache, anomaly summary
  and forecast artifacts in memory (~1.1 GB observed); the 512 MB Starter plan
  will OOM.
- Health check path: `/health`.
- Environment:

| Variable | Value |
| --- | --- |
| `ML_CORS_ORIGINS` | `https://<your-vercel-domain>` |
| `METERIQ_OUTPUT_DIR` | `/app/data/output` |
| `METERIQ_CACHE_DIR` | `/app/data/cache` |

`PORT` is injected by Render and honoured by `main.py`.

### Artifacts

The image bakes in the small serving artifacts (hourly cache 4.8 MB, anomaly
summary 14 KB, forecast predictions 7.6 MB + report), so dashboard,
anomaly-summary and forecast endpoints work immediately after deploy.

`anomaly_observations.parquet` is ~1 GB and is **not** in the image. Without it:

- `/anomalies/status` reports `available: false`
- the observation table and the anomaly CSV export show the unavailable state

To enable it, attach a persistent disk at `/app/data/output` (Render Disk,
≥ 2 GB) and upload `anomaly_observations.parquet` to
`/app/data/output/anomaly/` on that disk (Render Shell or `scp`), then restart.
`/anomalies/status` flips to `available: true`.

Regenerating artifacts in the cloud needs the raw CSVs and far more CPU than a
web instance has; run the three pipelines locally (see `README.md`) and upload
the outputs.

---

## 3. Backend API (Render)

- **New → Web Service → Docker**, root directory `code/backend`.
- Health check path: `/health`.
- Environment: copy `code/backend/.env.production.example`.
  - `MONGODB_URI` → Atlas string
  - `JWT_SECRET` → Render "Generate" or `openssl rand -hex 48`
  - `ML_SERVICE_URL` → `http://meteriq-ml:8000` (same region) or its public URL
  - `FRONTEND_URL` → `https://<your-vercel-domain>` (no trailing slash)
  - `TRUST_PROXY=1`, `NODE_ENV=production`
- The server binds `0.0.0.0` and honours `PORT`.

Verify:

```bash
curl -s https://<api-host>/health
# {"status":"healthy","services":{"api":"up","mongodb":"connected","ml":"up"}}
```

`degraded` + `503` means Mongo or the ML service is unreachable; the payload
names which one.

---

## 4. Frontend (Vercel)

1. **Add New → Project → Import** the repository.
2. **Root Directory:** `code/frontend`. Vercel reads `vercel.json` from that
   folder (`framework: vite`, `dist` output) and `package-lock.json` for `npm ci`.
3. **Environment Variables** (Production and Preview):

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://<api-host>/api` |
| `VITE_BASE_PATH` | `/` |

4. Deploy. Vite inlines both values at build time, so changing
   `VITE_API_BASE_URL` requires a redeploy.
5. Add the Vercel domain to `FRONTEND_URL` on the backend, otherwise CORS
   returns no `Access-Control-Allow-Origin` and every request fails.

There is no client-side router (`App.jsx` switches views in state), so no SPA
rewrite rule is needed and a refresh on any page returns `index.html`.

Any static host works the same way (`npm run build` → `dist`); only
`VITE_API_BASE_URL` and the backend `FRONTEND_URL` change.

---

## 5. Environment variable matrix

### Frontend (build time, Vercel)
| Variable | Local | Production |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5050/api` | `https://<api-host>/api` |
| `VITE_BASE_PATH` | `/` | `/` |

`VITE_USE_LIVE_API` is **not** used: the client always calls the live API. The
old toggle and its mock fallback were removed rather than kept as a
non-functional switch.

### Backend
`NODE_ENV`, `PORT`, `HOST`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`ML_SERVICE_URL`, `ML_SERVICE_TIMEOUT_MS`, `FRONTEND_URL`, `TRUST_PROXY`.

### ML service
`ML_HOST`, `ML_PORT`/`PORT`, `ML_CORS_ORIGINS`, `METERIQ_OUTPUT_DIR`,
`METERIQ_CACHE_DIR`, plus the optional `METERIQ_*` pipeline tuning variables in
`code/ml-service/ml/config.py` (thresholds unchanged).

---

## 6. Post-deploy verification

```bash
API=https://<api-host>
APP=https://<vercel-domain>

curl -s $API/health
curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | head -c 200

TOKEN=...
for p in /api/meters /api/analytics/regional /api/anomalies/status \
         /api/forecast/meta /api/reports/summary; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" $API$p)" "$p"
done

curl -s -o /dev/null -w 'app %{http_code}\n' $APP
```

Then open the Vercel URL, sign in, and walk Dashboard → Meters → Anomalies →
Forecasting → Investigations → Reports with the browser console open; there
should be no CORS or 4xx errors.

---

## 7. What still needs account access

| Step | Needs |
| --- | --- |
| Atlas cluster + connection string | your MongoDB account |
| Render/Railway service creation | your platform login (the Railway CLI session here is expired) |
| Uploading the 1 GB observation artifact | a persistent disk on the ML service |
| Vercel project import | your Vercel account |
| `git push` of the reorganisation | your explicit approval |

No credentials are stored in this repository; every value above is supplied
through the platform's environment settings.
