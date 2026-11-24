# MeterIQ deployment guide

MeterIQ is three deployable pieces plus a database. GitHub Pages can only host
the first one, so a complete deployment needs four targets:

| Piece | Technology | Host | Why |
| --- | --- | --- | --- |
| Frontend | React 19 + Vite (static) | **GitHub Pages** (already wired) | Free, matches the existing workflow |
| Backend API | Node 20 + Express | **Render** (Docker) or Railway | Long-running process, needs env vars + health checks |
| ML service | Python 3.11 + FastAPI | **Render** (Docker) or Railway | Needs ~2 GB RAM to hold the artifacts |
| Database | MongoDB | **MongoDB Atlas** (M0 free tier is enough) | User + investigation persistence |

```
browser
  └─ GitHub Pages  (static bundle, VITE_API_BASE_URL baked in at build time)
       └─ Express API  (Render, /api/*)
            ├─ MongoDB Atlas   (users, investigations, meter catalogue)
            └─ FastAPI ML      (Render, internal URL)
                 └─ artifacts in /app/data/output
```

The browser never talks to the ML service directly; the Express API is the only
public API surface.

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (region: Mumbai/Singapore to match the API).
2. Database Access → add a user with a strong password.
3. Network Access → allow the API host. Render has no fixed egress IPs on the
   Starter plan, so use `0.0.0.0/0` **with** a strong password, or pin CIDRs on a
   paid plan.
4. Copy the connection string and append the database name:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/meteriq?retryWrites=true&w=majority
```

The app creates collections on first write. If you want meters in the catalogue
collection before the first request, run `backend/src/scripts/seedMeters.js`
(if present) or import the existing `meters` collection export.

5. Provision the first supervisor directly in Atlas (public signup only ever
   creates `analyst`):

```js
db.users.insertOne({
  email: "you@example.com",
  password: "<bcrypt hash — generate with the snippet below>",
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

The ML service is deployed from `ml-service/` using its Dockerfile.

- **New → Web Service → Docker**, root directory `ml-service`.
- Plan: **Standard (2 GB)**. The service holds the hourly cache, anomaly summary
  and forecast artifacts in memory (~1.1 GB observed); the 512 MB Starter plan
  will OOM.
- Health check path: `/health`.
- Environment:

| Variable | Value |
| --- | --- |
| `ML_CORS_ORIGINS` | `https://<your-pages-origin>` |
| `METERIQ_OUTPUT_DIR` | `/app/data/output` |
| `METERIQ_CACHE_DIR` | `/app/data/cache` |

`PORT` is injected by Render and honoured by `main.py`.

### Artifacts

The image bakes in the small serving artifacts (hourly cache 4.8 MB, anomaly
summary 14 KB, forecast predictions 7.6 MB + report), so every dashboard,
anomaly-summary and forecast endpoint works immediately after deploy.

`anomaly_observations.parquet` is ~1 GB and is **not** in the image. Without it:

- `/anomalies/status` reports `available: false`
- the observation table and the anomaly CSV export show the unavailable state

To enable it, attach a persistent disk at `/app/data/output` (Render: Disk,
≥ 2 GB), then upload `anomaly_observations.parquet` into
`/app/data/output/anomaly/` on that disk (Render Shell or `scp`). Restart the
service; `/anomalies/status` flips to `available: true`.

Regenerating artifacts instead of uploading them requires the raw CSVs and far
more CPU than a small web instance provides; run the three pipelines locally
(see `README.md`) and upload the outputs.

---

## 3. Backend API (Render)

- **New → Web Service → Docker**, root directory `backend`.
- Health check path: `/health`.
- Environment: copy `backend/.env.production.example`.
  - `MONGODB_URI` → Atlas string
  - `JWT_SECRET` → Render "Generate" or `openssl rand -hex 48`
  - `ML_SERVICE_URL` → `http://meteriq-ml:8000` (same region) or the public URL
  - `FRONTEND_URL` → `https://<owner>.github.io` (no trailing slash)
  - `TRUST_PROXY=1`, `NODE_ENV=production`
- The server binds `0.0.0.0` and honours `PORT`.

Verify:

```bash
curl -s https://<api-host>/health
# {"status":"healthy","services":{"api":"up","mongodb":"connected","ml":"up"}}
```

A `degraded` status with a `503` means Mongo or the ML service is unreachable —
the payload names which one.

---

## 4. Frontend (GitHub Pages)

`.github/workflows/deploy.yml` builds `frontend/` and publishes `dist/`.

One-time setup **before the first successful deploy**:

1. Repository → Settings → Pages → Source: **GitHub Actions**.
2. Add the API URL as a repository variable (not a secret — it is public and
   inlined into the bundle):

```bash
gh variable set VITE_API_BASE_URL --repo <owner>/<repo> \
  --body 'https://<api-host>/api'
```

3. Push to `master` (or run the workflow manually). The build injects
   `VITE_BASE_PATH=/<repo-name>/` so assets resolve on a project site.

The workflow **fails on purpose** if `VITE_API_BASE_URL` is missing or points at
localhost: deploying a bundle that cannot reach an API would look like a working
release while every screen shows an error.

### Hosting elsewhere (Vercel/Netlify)

Both work unchanged: root directory `frontend`, build `npm run build`, output
`dist`, with `VITE_API_BASE_URL` set to the API URL and `VITE_BASE_PATH=/`.
Remember to add the new origin to `FRONTEND_URL` on the backend.

---

## 5. Environment variable matrix

### Frontend (build time)
| Variable | Dev | Production |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5050/api` | `https://<api-host>/api` |
| `VITE_BASE_PATH` | `/ucs503p-202627odd-MeterIQ/` | `/<repo>/` on Pages, `/` elsewhere |

`VITE_USE_LIVE_API` is **not** used: the client always calls the live API. The
old toggle and its mock fallback were removed rather than left as a
non-functional switch.

### Backend
`NODE_ENV`, `PORT`, `HOST`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`ML_SERVICE_URL`, `ML_SERVICE_TIMEOUT_MS`, `FRONTEND_URL`, `TRUST_PROXY`.

### ML service
`ML_HOST`, `ML_PORT`/`PORT`, `ML_CORS_ORIGINS`, `METERIQ_OUTPUT_DIR`,
`METERIQ_CACHE_DIR`, plus the optional `METERIQ_*` pipeline tuning variables in
`ml-service/ml/config.py` (thresholds live there and are unchanged).

---

## 6. Post-deploy verification

```bash
API=https://<api-host>
PAGES=https://<owner>.github.io/<repo>/

curl -s $API/health
curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | head -c 200

TOKEN=...
for p in /api/meters /api/analytics/regional /api/anomalies/status \
         /api/forecast/meta /api/reports/summary; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" $API$p)" "$p"
done

curl -s -o /dev/null -w 'pages %{http_code}\n' $PAGES
```

Then open the Pages URL, sign in, and walk Dashboard → Meters → Anomalies →
Forecasting → Investigations → Reports with the browser console open; there
should be no CORS or 4xx errors.

---

## 7. What cannot be automated from this machine

These steps need account access that is not available in the workspace:

| Step | Needs |
| --- | --- |
| Atlas cluster + connection string | your MongoDB account |
| Render/Railway service creation | your platform login (Railway CLI session is expired) |
| Uploading the 1 GB observation artifact | a persistent disk on the ML service |
| `git push` to the shared repo | push access (already granted to the current `gh` account) |
| Setting `VITE_API_BASE_URL` | the API host, which exists only after step 2–3 |

Nothing in this repository contains credentials; every value above is supplied
through the platform's environment settings.
