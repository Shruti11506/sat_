# Project Status & Technical Documentation — SatQuery AI

_Last audited: 2026-09-23, on branch `feat/backend-foundation-supabase` at commit `7efa2ef` (open PR: Shruti11506/sat_#1)._

Everything marked as working was **verified during the audit**: live HTTP calls against the running backend, live queries against the real Supabase project, `pytest`, `vite build`, and static tracing of the source. Anything that could not be verified is marked **Unknown / Requires Verification**. No secret values appear in this document. Only variable names are listed.

Status legend: ✅ Fully implemented · 🟡 Partially implemented · 🔴 Not implemented · ⚠️ Implemented but broken/misleading · 🧪 Implemented but not tested

---

## 1. Executive Summary

SatQuery AI is a React/Vite UI for conversational satellite-imagery analysis. It is backed by a FastAPI service that persists uploads and queries to Supabase (PostgreSQL + Storage). The **persistence foundation works end to end**. Real image bytes reach the private `Satquery` bucket and an `imagery` row is created. Queries create `analysis_jobs` rows. The sidebar history comes only from the database, and sessions survive a page reload. There is currently **one real user record** in the live database: one image (5.2 MB JPEG) and two queued jobs. DB↔Storage consistency checks came back clean: no broken records and no orphan files. **41/41 backend tests pass.**

**There is no AI/ML layer** (by design): jobs stay `queued` with `model_name = NULL`, and `analysis_results`/`evidence` are empty. There is **no authentication**.

The audit found **3 high-severity issues**:

1. **Secret leak into logs.** In development mode the service-role key is written to stdout in plaintext.
2. **RLS is disabled on all 5 tables.** The publishable key alone can read every query and every imagery record.
3. **TIFF/GeoTIFF previews are wrong.** They show a stock Bengaluru sample image instead of the user's file.

The image viewer also still overlays **fabricated coordinates** and pseudo-spectral "NDWI/SAR" filters on real uploads. Docker is **unverified** because the Docker daemon is not running on this machine.

## 2. Project Purpose

Upload a satellite scene (JPEG/PNG/WEBP/TIFF/GeoTIFF) and ask natural-language questions about it, ChatGPT-style. The current milestone covers only **persistence**: `UI → FastAPI → Supabase`. Analysis (VLM, SAR, change detection, captioning, grounding, agent orchestration) is **intentionally pending** and belongs to a later milestone.

## 3. Current Implementation Status

| Module | Status | Implementation | Issues |
|---|---|---|---|
| Frontend (primary flow) | 🟡 | Upload → query → history → refresh is backend-driven | TIFF preview shows stock image; fake coordinate HUD; hardcoded user profile |
| Frontend (legacy screens) | ⚠️ | Change/Fusion/Pipeline/Analytics/Report render 100% mock data | Out of scope so far; still reachable from Workspace + sidebar |
| Backend | ✅ | FastAPI, 13 routes, layered routes → services → db | Secret leak via DEBUG logging |
| Database | 🟡 | 5 tables, FKs, indexes (per `schema.sql`) | RLS off; `audit_logs` never written |
| Authentication | 🔴 | None anywhere (verified by grep: no JWT/session/login/Depends) | All data globally visible |
| Upload | ✅ | Multipart → validation → Storage → DB, atomic enough, FK-safe delete | TIFF preview (frontend); 50 MB limit is an assumed platform default |
| AI/ML | 🔴 (intentionally pending) | None. No libraries, no calls | — |
| Storage | ✅ | Private `Satquery` bucket, anon access denied (verified) | Signed URLs expire after 1 h |
| API | ✅ | Consistent envelope, `/docs` + `/redoc` live | Health endpoints return 200 even when unhealthy |
| Docker | 🟡 / Unknown | Dockerfile + compose exist | Never built/run: daemon not running |
| Testing | 🟡 | 41 backend tests (fake Supabase) | No frontend tests, no automated E2E, no CORS/Docker tests |
| Deployment | 🔴 | No deploy config, no CI | — |

## 4. Complete Tech Stack

### Currently used (verified from `package.json`, `requirements.txt`, installed versions)

| Layer | Technology | Purpose | Status |
|---|---|---|---|
| Frontend | React 19.2, Vite 8.3 | SPA + dev server/build | ✅ |
| Frontend styling | Tailwind CSS 4.3 (`@tailwindcss/vite`), hand-rolled CSS tokens in `index.css`/`App.css` | Styling, dual theme | ✅ |
| Frontend UI | Radix UI (dialog, label, separator, slot, tooltip), shadcn/ui pattern, class-variance-authority, clsx, tailwind-merge, framer-motion 13, lucide-react | Components/icons/animation | ✅ |
| Frontend language | JavaScript (`.jsx`) + some TypeScript (`.tsx`/`.ts`) | — | 🟡 TS is **not type-checked** (build is `vite build` only; `tsconfig` has `strict: false`) |
| Lint | oxlint 1.81 | Linting | ✅ (63 warnings, mostly unused imports) |
| Backend | Python 3.12, FastAPI 0.141.1, Uvicorn 0.53 | REST API | ✅ |
| Validation/config | Pydantic 2.13, pydantic-settings 2.15 (+ python-dotenv 1.2 for `.env` loading) | Schemas, settings | ✅ |
| Uploads | python-multipart 0.0.32 | `multipart/form-data` parsing | ✅ |
| Supabase client | supabase-py 2.31 (PostgREST table API + storage3) | DB + Storage access | ✅ |
| HTTP | httpx 0.28 | Used by supabase-py and the test client | ✅ |
| Database | Supabase PostgreSQL (via PostgREST, **no ORM**) | Persistence | ✅ |
| Storage | Supabase Storage, bucket `Satquery` (private) | File persistence | ✅ |
| Testing | pytest 9.1 + in-memory fake Supabase client (`backend/tests/fakes.py`) | Backend tests | ✅ |
| DevOps | Docker (`python:3.12-slim`), docker-compose (single `api` service) | Containerized backend | Unknown / Requires Verification |
| Dev tooling | `.claude/launch.json` (preview server), `.mcp.json` (Supabase MCP connector for Claude Code) | Tooling | — |

**Not present (verified by search):** authentication library, ORM, migrations tool, Redis, Celery/RQ/any queue, background workers, Nginx, MinIO, AI/ML libraries (PyTorch, Transformers, LangChain, LangGraph, OpenAI/Anthropic/Gemini SDKs), CI (no `.github/`), frontend test framework.

### Planned / recommended (not in the codebase)

AI/VLM inference service, a job worker for `queued → processing → completed`, Supabase Auth, CI (GitHub Actions running `pytest` + `vite build` + lint), a migration tool (Supabase CLI).

## 5. Project Structure

Actual layout (excluding `node_modules`, `.venv`, `dist`, caches):

```text
sat_/
├── CLAUDE.md                 # Guidance for AI agents / developers
├── PROJECT_STATUS.md         # This audit
├── README.md                 # ⚠️ Still the default Vite template boilerplate
├── .env.example              # Frontend: VITE_API_BASE_URL (no root .env exists)
├── .mcp.json                 # Supabase MCP connector config (project ref only, no keys)
├── .claude/launch.json       # Dev-server config for Claude's preview browser
├── package.json, vite.config.js, tsconfig.json, components.json, tailwind.config.js, .oxlintrc.json
├── public/assets/            # Stock sample images used by the legacy mock screens (optical, SAR, fusion, before/after) + logos
├── src/
│   ├── main.jsx              # React root (StrictMode)
│   ├── App.jsx               # Screen routing state, real session state, refresh-restore
│   ├── lib/apiClient.ts      # The ONLY place the frontend talks to the backend
│   ├── lib/utils.ts          # cn() helper
│   ├── data/mockData.js      # SATELLITE_SCENARIOS (legacy screens only) + SUGGESTED_QUERIES (UI chips)
│   ├── hooks/use-mobile.tsx  # (re-exported by components/hooks/use-mobile.tsx)
│   └── components/
│       ├── LandingHero.jsx, Workspace.jsx, UserHistorySidebar.tsx   # Primary backend-driven flow
│       ├── ImageViewer.jsx                                          # Used by Workspace (+ unreachable 'viewer' screen)
│       ├── ChangeDetection.jsx, FusionViewer.jsx, AgentPipeline.jsx, AnalyticsDashboard.jsx, ReportScreen.jsx  # Legacy mock screens
│       ├── ui/               # shadcn primitives, ChitravitsLogo, oceanic-shimmer background
│       └── (dead code)       # Navbar.jsx, demo.tsx, blocks/*, ui/demo.tsx, ui/git-hub-sky.tsx, ui/github-sky-demo.tsx, ui/label.tsx, ui/nav-header.tsx
└── backend/
    ├── app/
    │   ├── main.py           # App init, CORS, global exception handlers, router wiring (/api/v1)
    │   ├── api/routes/       # health, imagery, analysis, jobs, results, evidence (thin)
    │   ├── services/         # imagery_, analysis_, job_, result_, storage_service (all logic)
    │   ├── schemas/          # Pydantic: common (envelope), imagery, analysis, jobs, results, history
    │   ├── db/supabase.py    # Single cached Supabase client (service-role key)
    │   └── core/             # config, exceptions, logging, security (parse_uuid: unused)
    ├── supabase/schema.sql   # Full schema for a fresh project (RLS statements commented out)
    ├── supabase/migrations/0002_imagery_upload_fields.sql   # Applied to the live project
    ├── tests/                # 41 pytest tests + fakes.py (fake DB + fake Storage)
    ├── Dockerfile, docker-compose.yml, .dockerignore
    ├── requirements.txt, pytest.ini, .env.example, .gitignore
    └── README.md             # Backend setup, Docker primer, endpoints
```

Dead-code determination: a reachability trace from `src/main.jsx` over all relative/`@/` imports. The 9 files listed as dead code are never imported by the running app.

## 6. System Architecture

```text
                     Browser (localhost:5173)
                              │
                     React SPA (Vite)
                  src/lib/apiClient.ts  (fetch)
                              │  HTTP/JSON + multipart
                              ▼
                  FastAPI (localhost:8000, /api/v1)          🟢 verified live
        routes (thin) → services (logic) → db/supabase.py
                              │  service-role key
              ┌───────────────┴───────────────┐
              ▼                               ▼
   Supabase PostgreSQL (PostgREST)    Supabase Storage
   imagery, analysis_jobs,            bucket "Satquery" (private)
   analysis_results*, evidence*,      imagery/{uuid}/{filename}
   audit_logs*                        🟢 anon access denied (verified)
   🔴 RLS off (anon can read)
                              
   * empty: no AI layer / nothing writes to them
   AI/ML layer:  ⚪ intentionally pending (no code, no libraries)
   Auth layer:   🔴 none
   Workers/queue: 🔴 none
```

There is **no direct frontend → Supabase access**. The search found no Supabase client and no Supabase keys under `src/`.

## 7. Backend Architecture

- **Entry point:** `backend/app/main.py` loads settings (`core/config.py`, pydantic-settings reading `backend/.env`) and configures logging. It builds the `FastAPI` app, adds `CORSMiddleware` (explicit origin allowlist, wildcard methods/headers, credentials allowed), registers 3 exception handlers, and mounts 6 routers under `/api/v1`.
- **Layering:** routes validate the HTTP shape and wrap results in `ApiResponse`. Services hold all business logic and raise `ApiError` subclasses (`core/exceptions.py`: `NotFoundError` 404, `ValidationAppError` 422, `SupabaseError` 500, `StorageError` 500 with an overridable code). `db/supabase.py::get_supabase()` is the only client constructor (`lru_cache`, service-role key).
- **Error handling:** `ApiError` → its status/code; `RequestValidationError` → 422 `VALIDATION_ERROR`; any other exception → 500 `INTERNAL_ERROR` with no traceback in the response (the traceback goes to the logs).
- **Validation:** UUID path params (FastAPI type coercion), Pydantic bodies, `AnalysisType` enum (8 values), non-empty query check (`INVALID_QUERY`), and for uploads: extension allowlist, non-empty file, size ≤ `MAX_UPLOAD_SIZE_MB`, and metadata must be a JSON object.
- **Storage logic (`services/storage_service.py`):** builds the unique path `imagery/{uuid4}/{filename}` (`/` stripped from the filename). It uploads with the content type and classifies Supabase-side size rejections as `FILE_TOO_LARGE`. It resolves a signed URL (1 h TTL) because the bucket is private, and it deletes objects.
- **Atomicity:** Storage upload happens first and the DB insert only runs after it succeeds. If the insert then fails, the Storage object is left behind (reported as `SUPABASE_ERROR`, but it is **not cleaned up**; see Remaining Work). Delete runs DB-first, then Storage, so an FK-blocked delete leaves both sides intact.
- **Logging (`core/logging.py`):** DEBUG in development, INFO otherwise; `httpx`/`httpcore` are silenced. ⚠️ `hpack` is **not** silenced, so it leaks secrets at DEBUG (see §20).
- **Not present:** auth middleware, rate limiting, background jobs, AI services, request-ID/correlation logging.

```text
Client (React)
      ↓
FastAPI routes (/api/v1)  ── CORS middleware, global exception handlers
      ↓
Pydantic validation  (no authentication layer)
      ↓
Service layer
 ┌────┴──────────┐
 ↓               ↓
Supabase DB    Supabase Storage          (no AI/ML, no workers)
```

## 8. API Documentation

All routes were verified against the live `/openapi.json`. Envelope: `{"success": bool, "data": ..., "error": null | {"code", "message"}}`. **No route requires auth** (none exists). Interactive docs: `/docs`, `/redoc`.

| Method | Endpoint | Purpose | Request | Response `data` | Tested | Used by UI |
|---|---|---|---|---|---|---|
| GET | `/api/v1/health` | Liveness | — | `status, service, version` | ✅ live + pytest | No |
| GET | `/api/v1/health/supabase` | DB + Storage + bucket check | — | `supabase, database, storage, bucket` | ✅ live + pytest | No |
| GET | `/api/v1/health/storage` | Storage-only check | — | `status, bucket` | ✅ live + pytest | No |
| POST | `/api/v1/imagery/upload` | Real upload → Storage → `imagery` row | multipart: `file` (required), `name`, `source`, `sensor`, `acquisition_date`, `metadata` (JSON string) | `id, name, original_filename, bucket, storage_path, mime_type, file_size, status` | ✅ live + pytest | Yes (LandingHero, Workspace) |
| POST | `/api/v1/imagery` | Register metadata only (no file) | JSON `ImageryCreate` | `id, name, status` | ✅ pytest | No |
| GET | `/api/v1/imagery?page&page_size` | Paginated list from DB | query params | `items[], pagination` | ✅ pytest | No |
| GET | `/api/v1/imagery/{id}` | One record + fresh signed `url` | UUID | `ImageryOut` | ✅ live + pytest | Yes (restore, history click) |
| DELETE | `/api/v1/imagery/{id}` | Delete DB row, then Storage object | UUID | `id, status` | ✅ pytest | No (no UI control) |
| POST | `/api/v1/analysis` | Create queued job (no AI) | JSON `imagery_id, analysis_type, query` | `job_id, imagery_id, analysis_type, query, status` | ✅ live + pytest | Yes |
| GET | `/api/v1/analysis/history?limit` | Jobs joined with imagery name, newest first | `limit` 1–200 | `[{job_id, imagery_id, imagery_name, query, analysis_type, status, created_at}]` | ✅ live + pytest | Yes (sidebar, restore) |
| GET | `/api/v1/jobs/{id}` | Job status | UUID | `JobOut` | ✅ pytest | No |
| GET | `/api/v1/results/{id}` | Stored result (404 until AI exists) | UUID | `ResultOut` | ✅ pytest (404 path) | No |
| GET | `/api/v1/results/{id}/evidence` | Stored evidence list | UUID | `[EvidenceOut]` | ✅ pytest (empty path) | No |

**Error codes in use:** `VALIDATION_ERROR`, `INVALID_QUERY`, `UNSUPPORTED_FILE_TYPE`, `EMPTY_FILE`, `MISSING_FILENAME`, `FILE_TOO_LARGE`, `INVALID_METADATA` (422) · `IMAGE_NOT_FOUND`, `JOB_NOT_FOUND`, `RESULT_NOT_FOUND` (404) · `SUPABASE_ERROR`, `STORAGE_ERROR`, `STORAGE_UPLOAD_FAILED`, `INTERNAL_ERROR` (500) · `SUPABASE_CONNECTION_ERROR`, `SUPABASE_STORAGE_ERROR` (health only).

**API issues:**
- The health endpoints return **HTTP 200 even when unhealthy** (`success: false` in the body), so status-code-based probes won't detect an outage.
- 4 endpoints are implemented and tested but unused by the UI (list, metadata-only POST, delete, job status).
- No duplicate routes found.
- 401/403/409/413 are never produced. There is no auth, no conflict semantics, and oversize uploads return 422 rather than 413.

## 9. Database Architecture

- **Technology:** Supabase PostgreSQL accessed through PostgREST via supabase-py (no ORM, no raw SQL in the app).
- **Connection:** `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (service role, which bypasses RLS).
- **Schema source of truth:** `backend/supabase/schema.sql` (fresh projects) plus `migrations/0002_imagery_upload_fields.sql` (applied live). Migrations are applied **manually** in the Supabase SQL editor; there is no migration tool or tracking table.
- **Verified live:** all 5 tables exist. Column sets of `imagery` and `analysis_jobs` match `schema.sql` exactly, as seen in live rows.
- **Unknown / Requires Verification:** that the indexes and FK `ON DELETE` behaviour exist exactly as written. PostgREST does not expose `pg_indexes`, and the empty tables can't be probed without writing data.

```text
imagery                      (1 live row)
 ├── id uuid PK, name text NOT NULL, source, sensor, acquisition_date
 ├── original_filename, bucket, storage_path, mime_type, file_size bigint
 ├── storage_url (unused), cloud_cover, latitude, longitude, bbox jsonb (unused)
 └── metadata jsonb, created_at
        ▲ FK imagery_id (enforced: blocks deleting imagery that has jobs; verified live)
analysis_jobs                (2 live rows, all status=queued, model_name=NULL)
 ├── id, imagery_id → imagery.id, analysis_type NOT NULL, query, status DEFAULT 'queued'
 ├── model_name, result_id → analysis_results.id (ON DELETE SET NULL), error_message
 └── created_at, started_at, completed_at
        ▲ FK job_id
analysis_results             (0 rows: intentionally unused until AI exists)
 └── id, job_id → analysis_jobs.id, answer, confidence, model_name, analysis_type, raw_output, created_at
        ▲ FK result_id
evidence                     (0 rows: intentionally unused until AI exists)
 └── id, result_id → analysis_results.id, evidence_type, description, source_reference, bbox, confidence, metadata, created_at
audit_logs                   (0 rows: nothing in the code writes to it)
 └── id, job_id (no FK), event_type, component, message, metadata, created_at
```

- **Indexes (per `schema.sql`):** `analysis_jobs(imagery_id)`, `analysis_results(job_id)`, `evidence(result_id)`, `audit_logs(job_id)`. There is **no index on `analysis_jobs(created_at)`**, which the history query orders by.
- **RLS:** ❌ **disabled on all 5 tables**. Verified: the anon/publishable key gets HTTP 200 and real rows from `imagery` and `analysis_jobs`. The enabling statements exist in `schema.sql` but are commented out.
- **Triggers/functions:** none defined in the repo. No `exec_sql`-style RPC exists (verified).
- **Seed/dummy data:** none in the database. The only rows are genuine user activity.
- **Consistency (verified live 2026-09-23):** 1/1 imagery rows have a matching Storage object with a matching byte size. 0 broken records, 0 orphan objects, 0 jobs with a missing imagery reference.
- **Users/projects tables:** do not exist (no auth).

## 10. Frontend Architecture

- **Routing:** no router library. `App.jsx` holds `activeScreen` and a `historyStack` and renders one screen at a time.
- **Primary flow components** (backend-driven): `LandingHero.jsx` (upload), `Workspace.jsx` (chat + `ImageViewer`), `UserHistorySidebar.tsx` (history), `App.jsx` (session state + refresh restore).
- **Legacy mock screens** (`ChangeDetection`, `FusionViewer`, `AgentPipeline`, `AnalyticsDashboard`, `ReportScreen`): render `SATELLITE_SCENARIOS[0]` from `mockData.js`. They are reachable from Workspace's "Compare"/"Full Report" buttons and from sidebar shortcuts (Images → fusion, Plugins → pipeline, Deep research / See plans and pricing → report, Help & Mission Guide → pipeline).
- **API access:** only via `src/lib/apiClient.ts` (base URL = `VITE_API_BASE_URL`, falling back to `http://localhost:8000/api/v1`; no root `.env` exists, so the fallback is what's used).
- **State:** React component state. `localStorage` holds only `satquery-theme` and the pointer `satquery-last-imagery-id` (never data).
- **Loading/empty/error states:**
  - Sidebar: ✅ all three ("Loading history…", "No analysis history yet.", "Unable to load analysis history." + Retry).
  - Landing upload: ✅ spinner. On failure it shows a "Not saved to backend" badge and an honest error message in Workspace.
  - Query submission: ✅ typing indicator, then a real "Analysis request submitted." / Queued or the real error.
  - Refresh restore: 🟡 no visible loading indicator. It silently lands on the landing page if restore fails (the pointer is cleared).

## 11. Frontend ↔ Backend Data Flow

```text
Expected                                   Actual (verified)
User selects image                         ✅ LandingHero.processFile / Workspace.handleFileAttach
Frontend receives file                     ✅ real File object
Frontend sends API request                 ✅ FormData, field "file", browser-set boundary
Backend receives + validates file          ✅ UploadFile, extension/size/empty checks
Backend stores file                        ✅ Satquery/imagery/{uuid}/{filename}
Database record created                    ✅ imagery row (bucket, path, mime, size)
Processing starts                          ⚪ No: job created with status=queued, nothing consumes it
AI/ML processing                           ⚪ intentionally pending
Result stored                              ⚪ analysis_results never written
Frontend retrieves result                  ⚪ UI never calls /results
Result displayed                           🟡 UI shows "Analysis request submitted." + Queued (truthful, no fake result)
Refresh / reload                           ✅ pointer → GET /imagery/{id} + GET /analysis/history → chat rebuilt
```

The flow **ends by design at `status = queued`**. It is not broken; nothing downstream exists yet.

## 12. File/Image Upload Flow

**Where does an uploaded file actually go right now?** Into Supabase Storage, bucket `Satquery`, at `imagery/{uuid4}/{original filename}`. A matching `imagery` row stores the bucket, path, MIME type and byte size. This was verified live: DB `file_size` 5,226,830 = Storage object size 5,226,830.

| Check | Status | Evidence / notes |
|---|---|---|
| Frontend file selection | ✅ | Drag-drop + browse (`LandingHero`), attach button (`Workspace`) |
| Multipart handling | ✅ | `apiClient.request()` omits `Content-Type` for `FormData` |
| Upload endpoint | ✅ | `POST /api/v1/imagery/upload` |
| Type validation | 🟡 | Extension allowlist (`.jpg .jpeg .png .webp .tif .tiff`). The client MIME type is accepted if it starts with `image/`. No magic-byte check |
| Size validation | 🟡 | 50 MB, both sides. **Assumed** Supabase platform default: the bucket has no `file_size_limit`, and the project-wide limit is a dashboard setting not visible via API (**Unknown / Requires Verification**). Supabase-side rejection is classified as `FILE_TOO_LARGE` |
| Temporary storage | ✅ none | The whole file is read into memory (`await file.read()`), up to 50 MB per request. No temp files, so nothing to clean up |
| Permanent storage | ✅ | Supabase Storage |
| DB metadata | ✅ | See §9 |
| URL generation | 🟡 | Signed URL, 1 h TTL, generated on each `GET /imagery/{id}`. A session left open over 1 h shows a broken image until reload |
| Image preview (JPEG/PNG/WEBP) | ✅ | Local `blob:` URL in-session; signed URL after reload |
| Image preview (TIFF/GeoTIFF) | ⚠️ | **Shows `/assets/optical_satellite.jpg` (a stock Bengaluru sample) instead of the user's file** (`LandingHero.jsx:43`, `Workspace.jsx:152`). After reload the viewer gets a signed URL to a `.tif`, which browsers cannot render, so the image appears broken. The file itself is stored correctly |
| Persistence after refresh | ✅ | Verified live |
| Duplicate uploads | 🟡 | Each upload gets a new UUID, so no overwrite, but there is no de-duplication |
| Invalid/failed uploads | ✅ | Specific error codes; no DB row if Storage fails (tested) |
| DB insert fails after Storage succeeds | ⚠️ | The error is reported, but **the Storage object is not deleted**, which creates a possible orphan (`routes/imagery.py`, upload handler) |

## 13. AI/ML Architecture

**None exists, intentionally.** A search of `backend/` and `src/` found no model loading, inference, prompting, embeddings, or AI SDK/library (the only matches were the word "Gemini" in UI-style comments). The `AnalysisType` enum (`vqa`, `captioning`, `scene_description`, `change_detection`, `change_vqa`, `optical_sar_analysis`, `region_grounding`, `general_analysis`) is an **API-level contract only**.

```text
UI → POST /analysis → analysis_service → job_service → analysis_jobs (queued)  ■ stops here
Model / Inference / Result: not implemented (intentionally pending)
```

**Pseudo-AI UI that remains** (misleading, not real): the ImageViewer band selector ("NIR False Color", "NDWI Water Mask", "SAR Radar Fusion") applies CSS filters to the same image. The 5 legacy screens display fabricated NDVI/NDWI values, confidences, bounding boxes, model names and execution traces from `mockData.js`.

**Future integration point:** a worker polls `analysis_jobs` where `status='queued'`. It sets `processing`, writes `analysis_results`/`evidence`, then sets `completed` + `result_id` + `completed_at` (or `failed` + `error_message`). The existing API contracts stay the same.

## 14. Authentication & Security

**Authentication/authorization: none.** No users table, sessions, JWT, or auth middleware. Every visitor can read the global history and every image, and can create jobs.

| Finding | Severity | Location | Evidence |
|---|---|---|---|
| Service-role key written to logs in plaintext when `APP_ENV=development` (DEBUG) | **HIGH** | `backend/app/core/logging.py` (silences `httpx`/`httpcore` but not `hpack`) | 147 `apikey` + 147 `authorization` header lines in one session's log (values not reproduced). Also affects `docker compose logs`, since `.env` sets `APP_ENV=development` |
| RLS disabled on all 5 tables | **HIGH** | Supabase project; `schema.sql` lines 111–115 commented out | Anon key → HTTP 200 + real rows from `imagery`, `analysis_jobs` |
| No authentication; history is global | MEDIUM (single-user prototype) / HIGH (multi-user) | Whole app | — |
| Hardcoded user identity in UI ("Shruti Daware", "ISRO Remote Sensing Lab") | LOW | `UserHistorySidebar.tsx:357–364` | Implies a logged-in user that doesn't exist |
| MIME trusted from client; no magic-byte check | LOW | `storage_service.validate_upload` | Extension allowlist is the real gate |
| No rate limiting on upload or analysis | LOW (prototype) | — | — |
| Container runs as root, no `HEALTHCHECK` | LOW | `backend/Dockerfile` | — |
| Secrets in Git | ✅ none | `git check-ignore` confirms `backend/.env` is ignored; no history for it | — |
| Secrets in frontend | ✅ none | No Supabase key or client under `src/`; root `.env.example` has only `VITE_API_BASE_URL` | — |
| CORS | ✅ acceptable | Explicit origins `localhost:3000,5173`; wildcard methods/headers | — |
| Storage bucket | ✅ private; anon list returns `[]` and anon GET is refused | — | — |
| Path traversal | ✅ not possible | `build_storage_path` = fixed prefix + `uuid4` + filename with `/` stripped | — |
| SQL injection | ✅ low risk | Only parameterized PostgREST builder calls; no raw SQL | — |
| Stack traces to client | ✅ none | Global handler returns `INTERNAL_ERROR` | — |

**Recommendations:**
1. Set `logging.getLogger("hpack").setLevel(logging.WARNING)` (and `h2`) in `core/logging.py`.
2. As a precaution, **rotate the service-role key**. It was written to local plaintext logs, and it also appeared in an AI session transcript when `backend/.env` was read.
3. Run the commented RLS statements in `schema.sql`.
4. Add Supabase Auth and scope `imagery`/`analysis_jobs` by `user_id` before any multi-user use.

## 15. Docker & Infrastructure

```text
docker-compose.yml
   └── api  (build: backend/Dockerfile, python:3.12-slim, port 8000:8000,
             env_file: backend/.env, volume ./app:/app/app)
                │
                └── HTTPS → Supabase Cloud (PostgreSQL + Storage)
No frontend container, no DB container, no Redis/worker/Nginx/MinIO (by design).
```

- **Verification:** ❌ **not verified.** The Docker CLI 29.8.0 is installed, but the daemon is not running (`docker info` cannot connect to `dockerDesktopLinuxEngine`). `docker compose build/up` has never succeeded on this machine.
- **Issues found by reading:**
  - The `./app` volume is mounted, but uvicorn runs without `--reload`, so code changes aren't picked up until restart.
  - There is no `HEALTHCHECK` and the container runs as root.
  - `.env` sets `APP_ENV=development`, so container logs would include the §14 secret leak.
- **Networking:** the frontend runs on the host (Vite) and reaches `localhost:8000`, which matches the compose port mapping.

## 16. Current Features (verified)

- Real image upload to the private `Satquery` bucket, with DB metadata (JPEG/PNG/WEBP/TIFF; 50 MB)
- Specific upload error codes; no DB row when Storage fails
- Query persistence to `analysis_jobs` (`queued`, `model_name = NULL`) with empty-query and imagery-existence validation
- Backend-driven sidebar history with loading/empty/error+retry states and date grouping
- Session restore after page reload, from backend data only
- Signed URLs for private images
- FK-safe imagery delete (API only)
- Combined health check (DB + Storage + bucket existence via `get_bucket`)
- OpenAPI docs (`/docs`, `/redoc`)
- 41 backend tests
- Dual dark/light theme (pre-existing)

## 17. Partially Implemented Features

- **TIFF/GeoTIFF support:** stored correctly, but preview is wrong or broken (§12)
- **Upload consistency:** no cleanup of the Storage object if the DB insert fails
- **Size limit:** 50 MB is an assumed default and needs to be confirmed in the Supabase dashboard
- **Docker:** files exist but have never been run
- **Refresh restore:** works, but has no loading indicator and a silent fallback to landing
- **Results/evidence API:** endpoints exist; tables are empty by design
- **`audit_logs`:** table exists; nothing writes to it
- **TypeScript:** `.tsx` files are not type-checked

## 18. Broken / Misleading Features

- ⚠️ TIFF preview shows a stock sample image (§12)
- ⚠️ `ImageViewer` HUD shows **fabricated Bengaluru coordinates** (`12.9716, 77.5946`), elevation (`910–935 m`) and a zoom-derived "~500 m" scale bar over *any* image, including real uploads (`ImageViewer.jsx:27, 54–58, 77`)
- ⚠️ `ImageViewer` band selector presents CSS filters as "NDWI Water Mask" / "SAR Radar Fusion" / "NIR False Color" (`ImageViewer.jsx:147–175`)
- ⚠️ The 5 legacy screens display fabricated analysis as if real and are still reachable from the primary flow
- ⚠️ Health endpoints report failure with HTTP 200

## 19. Dummy / Mock / Hardcoded Data

| Location | Current | Required |
|---|---|---|
| `src/data/mockData.js` → `SATELLITE_SCENARIOS` (used via `App.jsx:13` → `currentScenario`) | Fabricated scenarios: land-cover %, NDVI/NDWI/NDBI, SAR dB, confidences, bounding boxes, change metrics, chat history, execution traces, model names | Real results from a future AI layer, or remove/hide the 5 legacy screens until then |
| `ChangeDetection.jsx`, `FusionViewer.jsx`, `AgentPipeline.jsx`, `AnalyticsDashboard.jsx`, `ReportScreen.jsx` | Render the above mock scenario | Backend data (`/results`, `/evidence`) once it exists |
| `public/assets/*.jpg` (optical, SAR, fusion, before/after) | Stock sample imagery used by legacy screens and as the TIFF preview fallback | The user's own imagery / generated previews |
| `ImageViewer.jsx:27, 54–58, 77, 147–175` | Fake coordinates, elevation, scale, pseudo-spectral filters | Real georeference metadata (from GeoTIFF parsing), or hide the HUD |
| `UserHistorySidebar.tsx:357–364` | Hardcoded "Shruti Daware / ISRO Remote Sensing Lab / SD" | Real authenticated user, or a neutral placeholder |
| `Workspace.jsx:593` (Mic, titled "Voice query simulation") | Inserts canned text "Calculate total lake surface area…" | Real speech-to-text, or remove |
| `Workspace.jsx:484` (Regenerate) | Submits a canned query the user didn't write, creating a real job | Re-submit the user's last query, or remove |
| `Workspace.jsx:305, 537` | "GeoTIFF" badge on every attachment regardless of type | Real file extension |
| `src/lib/apiClient.ts:4–9` | Stale comment describing a removed mock chat | Update the comment |
| **Legitimate UI copy (keep)** | `SUGGESTED_QUERIES` chips, Workspace `QUICK_SUGGESTIONS` pills, hero text, placeholders | These submit through the real API |

**Database:** no dummy/seed data. **Backend:** no fake responses.

## 20. Known Bugs

| Issue | Severity | Location | Cause | Recommended fix |
|---|---|---|---|---|
| Service-role key logged in plaintext | High | `backend/app/core/logging.py` | `hpack` DEBUG logger not silenced | Silence `hpack`/`h2`; rotate the key |
| RLS disabled | High | Supabase / `schema.sql:111–115` | Statements commented out | Enable RLS (no anon policies needed; the backend uses the service role) |
| TIFF preview shows stock image / broken after reload | High (misleading) | `LandingHero.jsx:43`, `Workspace.jsx:152`, `App.jsx` `buildWorkspaceScenario` | Browsers can't decode TIFF; the fallback is a sample asset | Neutral "Preview unavailable for TIFF" placeholder now; server-side PNG preview later |
| Fabricated coordinates/scale HUD on real images | Medium | `ImageViewer.jsx:27–77` | HUD is hardcoded to Bengaluru | Hide unless real georeference metadata exists |
| Pseudo-spectral band filters | Medium | `ImageViewer.jsx:132–176` | CSS filters labeled as analysis | Hide for real uploads, or relabel as "display filter" |
| Orphan Storage object if the DB insert fails after upload | Medium | `routes/imagery.py` upload handler | No compensating delete | `storage_service.delete_file` in the insert-failure path |
| Docker never verified | Medium | `backend/Dockerfile`, `docker-compose.yml` | Daemon not running | Start Docker Desktop; run build/up and health checks |
| Legacy mock screens reachable from real flow | Medium | Workspace header, sidebar nav | Out of scope so far | Hide, or label as "Demo" |
| Health endpoints return 200 on failure | Low | `routes/health.py` | Design choice | Return 503 when `success=false` |
| Signed URL expiry (1 h) mid-session | Low | `storage_service.SIGNED_URL_TTL_SECONDS` | TTL | Re-fetch the URL on image `onError` |
| No `analysis_jobs(created_at)` index | Low | `schema.sql` | Missing | `create index … on analysis_jobs(created_at desc)` |
| Canned query injection (Mic, Regenerate) | Low | `Workspace.jsx:484, 593` | Leftover demo behavior | See §19 |
| Refresh restore has no loading state | Low | `App.jsx` mount effect | — | Show a spinner while restoring |
| Dead code: 9 frontend files; unreachable `viewer` screen; `core/security.py::parse_uuid`; unused `SUPABASE_PUBLISHABLE_KEY` setting | Low | See §5 | Leftovers | Delete or document |
| Root `README.md` is Vite boilerplate | Low | `README.md` | Never updated | Point it to `backend/README.md` + this file |
| 63 oxlint warnings | Low | Mostly unused imports | Pre-existing | Clean up gradually |

## 21. Remaining Work

### 🔴 Critical
1. **Stop logging the service-role key.**
   - Missing: `hpack` log suppression.
   - Why: secret exposure in any log sink.
   - Files: `backend/app/core/logging.py`.
   - Approach: add `hpack`/`h2` to the silenced loggers; rotate the key.
2. **Enable RLS.**
   - Why: the publishable key can read every row (verified). Write access is very likely too (Supabase grants the `anon` role table privileges by default and RLS is what would restrict them), but this is **Unknown / Requires Verification**: writes weren't tested to avoid modifying data.
   - Files: Supabase SQL editor, `schema.sql`.
   - Approach: run the 5 commented `enable row level security` lines; no policies are needed for anon.

### 🟠 High priority
3. **Fix TIFF preview.**
   - Files: `LandingHero.jsx`, `Workspace.jsx`, `App.jsx`.
   - Approach: neutral placeholder now; a server-generated PNG thumbnail later.
4. **Verify Docker.** Start Docker Desktop → `docker compose build && docker compose up` → hit `/api/v1/health` and `/health/supabase`.
5. **Remove fabricated data from the primary flow.** Covers the ImageViewer HUD/band filters, the hardcoded user profile, and the canned Mic/Regenerate text (§19).
6. **Compensating Storage delete** when the DB insert fails after upload.
   - File: `routes/imagery.py` (or move the orchestration into `imagery_service`).
7. **Decide on the legacy mock screens.** Hide, label as demo, or rebuild once AI exists.

### 🟡 Medium priority
8. Confirm the Supabase project's real upload limit and set `MAX_UPLOAD_SIZE_MB` to match.
9. Health endpoints → 503 on failure; add a Docker `HEALTHCHECK`; run the container as non-root.
10. CI: GitHub Actions running `pytest`, `npm run build`, `npm run lint`.
11. Add a `tsc --noEmit` step or convert the build to type-check.
12. Index `analysis_jobs(created_at)`.
13. Refresh signed URLs on expiry.
14. Wire `audit_logs` or drop it.

### 🟢 Low priority
15. Delete dead code (§5, §20).
16. Update the root `README.md`.
17. Fix the stale `apiClient.ts` comment.
18. Reduce oxlint warnings.
19. Add a delete-image control in the UI (the API already exists).

## 22. Recommended Improvements

- **Architecture:** Move the upload orchestration (validate → store → insert → compensate) from `routes/imagery.py` into `imagery_service` so the route is as thin as the others. Introduce a job-processor module boundary (`services/job_processor.py`) now, as an empty interface, so the AI milestone plugs in without touching routes.
- **Performance:**
  - Stream uploads instead of `await file.read()` if the limit grows beyond ~50 MB.
  - Add the `created_at` index.
  - `list_history` already batches imagery lookups (the N+1 was fixed).
  - Generate thumbnails once at upload rather than serving full images to the sidebar/chat.
  - Cache signed URLs per image until near expiry.
- **Security:** Supabase Auth + `user_id` columns + RLS policies scoped to `auth.uid()`; rate limiting (e.g. `slowapi`) on upload/analysis; magic-byte validation; secrets from a secret manager in deployment.
- **Reliability:** Request-ID middleware and structured (JSON) logs; health endpoints with proper status codes; a worker with retries for `queued` jobs once AI exists; alerting on `SUPABASE_ERROR` rates.
- **Developer experience:** CI, type-checking, removal of dead code, a real root README, and a Supabase CLI migration workflow instead of pasting SQL.
- **Scalability:**
  - *10 users:* current design is fine once auth + RLS exist.
  - *100 users:* add auth scoping, the `created_at` index, pagination in the sidebar, and rate limits.
  - *1,000 users:* run multiple uvicorn workers/instances behind a load balancer (the app is stateless apart from the Supabase client); background job queue + worker for AI; thumbnails; move to a paid Supabase tier with higher Storage limits.
  - *10,000+ users:* GPU inference service decoupled via a queue; direct-to-Storage signed *upload* URLs (browser uploads straight to Supabase, API only records metadata) to take large files off the API; CDN for image delivery; observability stack.

## 23. Testing Status

| Area | Tests | Notes |
|---|---|---|
| Health | 6 (`test_health.py`) | Connected, DB down, bucket missing |
| Imagery CRUD | 7 (`test_imagery.py`) | Create, list/pagination, get, 404, invalid UUID, delete |
| Upload | 12 (`test_imagery_upload.py`) | Success, GeoTIFF, unsupported type, empty, both size-limit paths, Storage failure (no DB row), invalid metadata, signed URL, delete incl. FK-blocked + Storage-failure cases |
| Analysis/jobs | 8 (`test_analysis.py`) | Valid, invalid type, missing imagery, empty/whitespace query, response shape, job get/404 |
| History | 4 (`test_history.py`) | Empty, ordering, deleted imagery, limit |
| Results/evidence | 4 (`test_results.py`) | 404 + empty paths |
| **Total** | **41 passed / 0 failed** (run 2026-09-23) | All use the in-memory fake Supabase (`tests/fakes.py`) |

**Untested:**
- Real Supabase integration (only manual live checks)
- Frontend (no framework installed)
- End-to-end flow (manual only)
- CORS
- Docker
- The logging configuration (the secret leak would have been caught by a test asserting no `apikey` in captured logs)
- The "DB insert fails after Storage upload" path
- Auth (none exists)
- AI inference (none exists)

**Recommended test plan:**
- Add a logging test (capture logs during a fake request; assert no key material).
- Add an opt-in integration suite (`pytest -m integration`) hitting a dedicated Supabase test project/bucket with cleanup.
- Add Vitest + React Testing Library for `UserHistorySidebar` states and `apiClient` FormData handling.
- Add a Playwright E2E test for upload → query → reload → history.
- Add a CI job that builds the Docker image and curls `/health`.

## 24. Production Readiness

| Category | Rating | Reason |
|---|---|---|
| Security | Not Ready | Secret leak in dev logging; RLS off; no auth; no rate limiting |
| Performance | Partially Ready | Fine at prototype scale; in-memory uploads, no thumbnails, missing `created_at` index |
| Error handling | Ready (for scope) | Consistent envelope, specific codes, no stack traces; one missing compensation path |
| Logging | Not Ready | Leaks secrets at DEBUG; no request IDs or structured logs |
| Monitoring | Not Ready | None; health endpoints return 200 on failure |
| Database migrations | Partially Ready | SQL files exist; applied manually, no tracking |
| Backups | Unknown / Requires Verification | Depends on the Supabase plan; not configured in the repo |
| Environment configuration | Partially Ready | `.env.example` complete; `APP_ENV` defaults to development; unused `SUPABASE_PUBLISHABLE_KEY` |
| Docker | Not Ready | Never built/run; root user; no healthcheck |
| Deployment | Not Ready | No deploy config, no CI |
| Testing | Partially Ready | Good backend unit coverage; no integration/frontend/E2E automation |
| API documentation | Ready | OpenAPI `/docs` + `/redoc` + `backend/README.md` |
| Scalability | Partially Ready | Stateless API, but no queue/workers/auth scoping |
| File storage | Partially Ready | Works; TIFF preview broken; no thumbnails; size limit unconfirmed |
| AI model reliability | Not applicable | Intentionally pending |

## 25. Development Setup

```bash
# Frontend (repo root)
npm install
npm run dev            # http://localhost:5173
npm run build && npm run lint

# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase values
uvicorn app.main:app --reload --port 8000           # http://localhost:8000/docs
pytest -v

# Docker (unverified, see §15)
cd backend && docker compose up --build
```

Database: for a fresh Supabase project, run `backend/supabase/schema.sql` in the SQL editor. The live project already has `migrations/0002_imagery_upload_fields.sql` applied. The Storage bucket `Satquery` must already exist; the backend never creates buckets.

## 26. Environment Variables

**Backend (`backend/.env`, template `backend/.env.example`):**

| Variable | Required | Used by code | Notes |
|---|---|---|---|
| `SUPABASE_URL` | Yes | Yes | Project URL |
| `SUPABASE_SECRET_KEY` | Yes | Yes | Service-role key; backend only; bypasses RLS |
| `SUPABASE_PUBLISHABLE_KEY` | No | **No** | Loaded into settings but never used |
| `SUPABASE_STORAGE_BUCKET` | No (default `Satquery`) | Yes | Must match an existing bucket |
| `MAX_UPLOAD_SIZE_MB` | No (default 50) | Yes | Keep ≤ Supabase's configured limit |
| `CORS_ORIGINS` | No (default `http://localhost:3000,http://localhost:5173`) | Yes | Comma-separated |
| `APP_ENV` | No (default `development`) | Yes | `development` = DEBUG logging, which leaks the key (see §14) |
| `APP_NAME`, `APP_VERSION` | No | Yes | OpenAPI title/version |

**Frontend (root `.env`, template `.env.example`; no `.env` currently exists):** `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`). Never put Supabase keys in `VITE_*` variables.

## 27. Deployment Architecture

**Not implemented.** No hosting config, CI/CD, reverse proxy, or domain setup exists in the repo.

Intended shape:

```text
Static frontend host (vite build → dist/)
        │  HTTPS
        ▼
FastAPI container (backend/Dockerfile)
        │  HTTPS
        ▼
Supabase Cloud (Postgres + Storage)
```

Before deploying:
- `APP_ENV=production` with the logging fix
- RLS on
- `CORS_ORIGINS` = the real frontend origin
- `VITE_API_BASE_URL` = the real API URL at build time
- Health checks with proper status codes

## 28. Future Roadmap

1. **Hardening (now):** logging fix + key rotation, RLS, TIFF preview, remove fabricated viewer data, upload compensation, Docker verification, CI.
2. **Identity:** Supabase Auth, `user_id` scoping, per-user history, real profile in the sidebar.
3. **Imagery:** server-side GeoTIFF parsing (georeference → real coordinates HUD, CRS, bands) and thumbnail/preview generation.
4. **Processing:** job worker (`queued → processing → completed/failed`) with retries; `audit_logs` events.
5. **AI layer (intentionally pending):** model selection, VLM/SAR/change-detection/captioning/grounding, agent orchestration. Writes `analysis_results` + `evidence`; the UI reads `/results` and `/evidence`.
6. **Legacy screens:** rebuild Change/Fusion/Pipeline/Analytics/Report on real results.

---

## Implementation Checklist

### Frontend
- [x] Centralized API client (`src/lib/apiClient.ts`)
- [x] Real multipart upload from LandingHero and Workspace
- [x] Query submission to `/analysis` with a truthful "queued" acknowledgment
- [x] Backend-driven history with loading/empty/error states
- [x] Session restore after reload from backend data
- [x] No hardcoded chat history / fake AI responses in the primary flow
- [ ] Correct TIFF/GeoTIFF preview
- [ ] Remove fabricated coordinates HUD and pseudo-spectral filters for real uploads
- [ ] Remove hardcoded user profile, canned Mic/Regenerate queries, hardcoded "GeoTIFF" badges
- [ ] Hide or rebuild the 5 legacy mock screens
- [ ] Loading state for session restore
- [ ] Type-checking for `.tsx`
- [ ] Remove dead code (9 files)

### Backend
- [x] FastAPI app, `/api/v1` prefix, 13 routes, consistent envelope
- [x] Layered routes → services → single Supabase client
- [x] Upload validation (extension, empty, size) with specific error codes
- [x] Query validation (non-empty, enum, imagery exists)
- [x] History endpoint (batched join)
- [x] FK-safe delete
- [x] Global exception handling without stack traces
- [ ] Logging that never emits secrets
- [ ] Compensating Storage delete on DB insert failure
- [ ] Health endpoints return 503 on failure
- [ ] Request-ID / structured logging
- [ ] Rate limiting

### Database
- [x] 5 tables exist with the expected columns (imagery/jobs verified live)
- [x] `analysis_jobs.imagery_id` FK enforced (verified live)
- [x] Records created for real uploads and queries (verified live)
- [x] DB ↔ Storage consistent (0 broken, 0 orphans)
- [ ] RLS enabled
- [ ] `analysis_jobs(created_at)` index
- [ ] Migration tooling/tracking
- [ ] `audit_logs` written by anything

### AI/ML
- [ ] Model selection (intentionally pending)
- [ ] Inference service (intentionally pending)
- [ ] Job worker (intentionally pending)
- [ ] Results/evidence populated (intentionally pending)

### Authentication
- [ ] User authentication
- [ ] Authorization / per-user data scoping

### Storage
- [x] Private `Satquery` bucket, anon access denied (verified)
- [x] Unique `imagery/{uuid}/{filename}` paths
- [x] Signed URLs for retrieval
- [ ] Confirm real project upload limit (50 MB is assumed)
- [ ] Thumbnails/previews (incl. TIFF)
- [ ] Signed-URL refresh on expiry

### Infrastructure
- [x] Dockerfile + docker-compose present
- [ ] Docker build/run verified
- [ ] Non-root container + `HEALTHCHECK`
- [ ] CI pipeline
- [ ] Deployment configuration

### Testing
- [x] 41 backend unit/API tests passing
- [ ] Logging/secret-leak test
- [ ] Supabase integration tests
- [ ] Frontend tests
- [ ] Automated end-to-end test
- [ ] Docker smoke test in CI
