# SatQuery AI — Backend Foundation

## 1. Purpose

This is the backend foundation for SatQuery AI: a REST API that sits between the existing SatQuery frontend and Supabase (PostgreSQL + Storage). It registers satellite imagery metadata, records analysis *requests*, and retrieves stored results/evidence.

**AI models and agentic orchestration are intentionally not implemented in this milestone.** The `analysis_type` values, `analysis_jobs` table, and `/analysis` endpoint exist only as a stable, future-ready API contract — no VLM, SAR model, change-detection model, captioning model, or agent framework runs behind them. A job created today stays in `queued` status until a future milestone adds real processing.

Current flow:

```
Existing SatQuery UI → FastAPI → Supabase → stored metadata / analysis requests / results
```

## 2. Existing frontend integration

The frontend (repo root, outside `backend/`) is a Vite + React app — see the root [`CLAUDE.md`](../CLAUDE.md) for its architecture. It previously had no API layer at all; every "AI analysis" in `Workspace.jsx` is keyword-matched mock data.

This milestone adds one new frontend file, [`src/lib/apiClient.ts`](../src/lib/apiClient.ts) — a typed `fetch` wrapper for every endpoint below. **It is not wired into any screen yet.** Wiring the chat UI to real backend calls is deferred until an AI layer exists to actually answer queries; doing it now would mean replacing the existing mock analysis text with permanently-empty `queued` jobs, which is a worse user experience than the current demo. No existing component, route, or styling was changed.

To point the frontend at a running backend, copy the root `.env.example` to `.env` and set `VITE_API_BASE_URL` (defaults to `http://localhost:8000/api/v1`).

## 3. Architecture

```
Existing SatQuery UI
        │  REST API (fetch)
        ▼
┌──────────────────────┐
│      FastAPI          │
│  api/routes  (thin)    │
│  schemas     (Pydantic)│
│  services    (logic)   │
│  db/supabase (client)  │
│  core        (config,  │
│               errors,  │
│               logging) │
└──────────┬────────────┘
           ▼
┌──────────────────────┐
│       Supabase         │
│  PostgreSQL + Storage   │
└──────────────────────┘
```

Routes never talk to Supabase directly — they call a service function, which calls `app/db/supabase.py`. Business logic and error translation live in `services/`, not in routes.

## 4. Folder structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, exception handlers, router wiring
│   ├── api/routes/          # health, imagery, analysis, jobs, results, evidence
│   ├── schemas/             # Pydantic request/response models + the ApiResponse envelope
│   ├── services/            # business logic, talks to Supabase via db/supabase.py
│   ├── db/supabase.py       # single place the Supabase client is constructed
│   └── core/                # config (env vars), logging, security (UUID validation), exceptions
├── tests/                   # pytest suite, uses an in-memory fake Supabase client
├── supabase/schema.sql      # DDL for all 5 tables — run this in the Supabase SQL editor
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── .env                     # local only, gitignored — fill in real Supabase values here
```

## 5. Python setup (without Docker)

Requires Python 3.12+.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
cp .env.example .env          # then fill in your Supabase values
uvicorn app.main:app --reload --port 8000
```

## 6-7. Supabase setup, URL/key configuration

1. Create a Supabase project (or use an existing one).
2. In the Supabase dashboard, go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / publishable key** → `SUPABASE_PUBLISHABLE_KEY` (not currently used server-side, kept for parity with the frontend)
   - **service_role / secret key** → `SUPABASE_SECRET_KEY` — **server-side only, never send this to the frontend**
3. Paste these into `backend/.env` (copy from `.env.example` first). `.env` is gitignored and must never be committed.

## 8. Database schema

Run [`supabase/schema.sql`](supabase/schema.sql) once, in the Supabase SQL editor (Project → SQL Editor → New query → paste → Run). It creates:

| Table | Purpose |
|---|---|
| `imagery` | Registered satellite scene metadata |
| `analysis_jobs` | An analysis *request* — status stays `queued` until a future AI layer processes it |
| `analysis_results` | Stored results (retrieval only — this API never writes AI answers) |
| `evidence` | Stored evidence records tied to a result (retrieval only) |
| `audit_logs` | Backend/API activity log table (schema only; nothing currently writes to it) |

## 9. Storage setup

Create a bucket named `satquery-data` in the Supabase dashboard (**Storage → New bucket**), or run the commented `insert into storage.buckets ...` statement at the bottom of `schema.sql`. Conceptual folder layout inside the bucket (see `app/services/storage_service.py`):

```
satquery-data/
  imagery/
  results/
  evidence/
  exports/
```

This milestone only registers/resolves storage *paths* as imagery metadata (`file_path`, `storage_url`) — it does not implement file upload or GeoTIFF processing.

### Row Level Security

The backend connects with the `service_role` (`SUPABASE_SECRET_KEY`), which always bypasses RLS, so RLS is not required for FastAPI ↔ Supabase to work. `schema.sql` includes commented-out `enable row level security` statements for all 5 tables as defense-in-depth, with no policies for `anon`/`authenticated` — since the frontend never talks to Supabase directly (only through FastAPI), those roles should have zero access. Uncomment and run them if you want that extra layer.

## 10-11. API endpoints & examples

Most responses use one envelope:

```json
{ "success": true, "data": { ... }, "error": null }
{ "success": false, "data": null, "error": { "code": "IMAGE_NOT_FOUND", "message": "..." } }
```

The two connectivity checks below are the exception — they put status in `data` on both success *and* failure, so a caller can render "disconnected" without special-casing:

```json
{ "success": true, "data": { "status": "connected", "provider": "supabase" }, "error": null }
{ "success": false, "data": { "status": "disconnected" }, "error": { "code": "SUPABASE_CONNECTION_ERROR", "message": "Unable to connect to Supabase." } }
```

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Liveness check |
| GET | `/api/v1/health/supabase` | Verifies backend ↔ Supabase Postgres connectivity (runs a real query, not just a URL check) |
| GET | `/api/v1/health/storage` | Verifies backend ↔ Supabase Storage connectivity (lists the `satquery-data` bucket) |
| POST | `/api/v1/imagery` | Register imagery metadata |
| GET | `/api/v1/imagery?page=1&page_size=20` | List imagery (paginated) |
| GET | `/api/v1/imagery/{imagery_id}` | Get one imagery record |
| DELETE | `/api/v1/imagery/{imagery_id}` | Unregister an imagery record |
| POST | `/api/v1/analysis` | Create an analysis job (**no AI inference**) |
| GET | `/api/v1/jobs/{job_id}` | Get job status |
| GET | `/api/v1/results/{result_id}` | Get a stored result (404 if none exists yet) |
| GET | `/api/v1/results/{result_id}/evidence` | Get stored evidence for a result |

Example — register imagery, then create an analysis request:

```bash
curl -X POST http://localhost:8000/api/v1/imagery \
  -H "Content-Type: application/json" \
  -d '{"name":"sentinel_scene_001","source":"Sentinel-2","sensor":"MSI","file_path":"imagery/sample.tif"}'
# → { "success": true, "data": { "id": "<uuid>", "name": "sentinel_scene_001", "status": "registered" }, "error": null }

curl -X POST http://localhost:8000/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{"imagery_id":"<uuid>","analysis_type":"vqa","query":"What is visible in this image?"}'
# → { "success": true, "data": { "job_id": "<uuid>", "status": "queued" }, "error": null }
```

Interactive docs: `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc`.

## 12-14. Docker

### What these tools are (first-time setup)

- **Docker**: a tool that packages an application with everything it needs to run (Python, dependencies, code) so it behaves identically on any machine.
- **Docker image**: the packaged, read-only blueprint built from the `Dockerfile` — think of it as a frozen snapshot of the app + its environment.
- **Docker container**: a running instance of an image — the actual live process.
- **Dockerfile**: the recipe (`backend/Dockerfile`) that builds the image: start from `python:3.12-slim`, install `requirements.txt`, copy the app, run `uvicorn` on port 8000.
- **docker-compose.yml**: describes how to run one or more containers together (here, just the `api` service) with one command, instead of typing a long `docker run ...` line every time.

### Commands

```bash
docker --version              # confirm Docker is installed
docker compose version        # confirm Compose is available

docker compose build          # build the image from the Dockerfile
docker compose up             # build (if needed) and start the container, logs in foreground
docker compose up -d          # same, but detached (runs in background)
docker compose down           # stop and remove the container
docker compose ps             # list running containers for this project
docker compose logs -f        # follow the container's logs
docker compose build --no-cache   # rebuild from scratch, ignoring cached layers
```

`docker-compose.yml` reads `backend/.env` and exposes the API on `localhost:8000`, same as running `uvicorn` directly.

### Why Docker is used here

At this stage, Docker's job is reproducibility and dependency isolation — not performance and not GPU access. It lets the exact same backend environment run identically on a developer's laptop, a teammate's laptop, a test environment, a server, and (later) a GPU server or ISRO/SAC infrastructure, without "works on my machine" drift. **Docker itself does not provide GPU acceleration** — that would need separate GPU-passthrough configuration when a real model workload exists.

Per current scope, there are **no** containers for Postgres, Redis, Celery, MinIO, AI models, GPU, Nginx, Prometheus, or Grafana — only the `api` service talking to Supabase Cloud.

## 15. Local development

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The frontend runs separately (`npm run dev` at the repo root) and talks to the backend over HTTP via `VITE_API_BASE_URL` — the two are not coupled at build time.

## 16. Testing

```bash
cd backend
pytest -v
```

Tests use an in-memory fake Supabase client (`tests/fakes.py`) so they run without a live Supabase project or network access. Coverage: health, Supabase health, imagery CRUD + pagination, invalid UUIDs, analysis creation (including invalid `analysis_type` and missing imagery), job retrieval, and result/evidence retrieval (including not-found cases).

## 17. Frontend integration

See section 2 above. `src/lib/apiClient.ts` is ready to import from any component once a future milestone needs to display real (non-mock) data — e.g. `registerImagery(...)`, `createAnalysis(imageryId, "vqa", query)`, `getJob(jobId)`.

## 18. Current limitations

- No AI/model/agentic layer — `analysis_jobs` never progress past `status: "queued"`, and `/results` will 404 until something writes to `analysis_results` (nothing does yet).
- No authentication/authorization layer.
- No file upload endpoint or GeoTIFF processing — imagery registration is metadata-only.
- `audit_logs` table exists in the schema but nothing writes to it yet.
- Docker build was written and reviewed but could not be verified on this machine (Docker was not installed in this environment) — verify `docker compose build && docker compose up` locally before relying on it.

## 19. Future AI integration point

When an AI/agentic layer is ready, it should:
1. Poll or subscribe to `analysis_jobs` rows with `status = 'queued'`.
2. Set `status = 'processing'`, run inference, then write a row to `analysis_results` (and `evidence` if applicable).
3. Update the job with `status = 'completed'` (or `'failed'` + `error_message`), `result_id`, and `completed_at`.

The `/api/v1/analysis`, `/jobs/{id}`, `/results/{id}`, and `/results/{id}/evidence` contracts are designed to stay stable through that change — no frontend changes should be required beyond consuming non-null `answer`/`evidence` data once it exists.

**AI models and agentic orchestration are intentionally not implemented in this milestone.**
