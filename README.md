# SatQuery AI

React + Vite frontend and a FastAPI backend that stores conversations, uploads
and queries in **Supabase** (PostgreSQL + Storage).

```
Browser → frontend (Vite, :5173) → FastAPI backend (:8000) → Supabase project (shared)
```

Every developer runs the frontend **and** the backend on their own computer,
and every backend connects to the **same Supabase project** — that's what makes
everyone see the same conversations and history. The frontend never talks to
Supabase directly and holds no Supabase keys.

> `localhost` always means the computer the browser runs on. On a teammate's
> machine the frontend talks to *their* local backend, never to yours — so each
> machine needs its own backend running (steps below).

## First-time setup (fresh clone)

Requirements: **Node.js 20+**, **Python 3.10+** (developed on 3.12), Git.

```bash
git clone https://github.com/Shruti11506/sat_.git
cd sat_
npm install
npm run setup
```

`npm run setup` creates `backend/.venv`, installs `backend/requirements.txt`,
and creates `backend/.env` from `backend/.env.example` (an existing `.env` is
never overwritten).

Then open **`backend/.env`** and fill in the values for the shared Supabase
project — from the Supabase dashboard (*Project Settings → API*) or from the
project owner, shared privately (never through GitHub):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | the project URL, `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | the **secret** key (`sb_secret_…`) or legacy **service_role** key — *not* the publishable/anon key |

Everything else in `backend/.env` can keep its default. `backend/.env` is
gitignored; never commit it. No frontend `.env` is needed (see `.env.example`
only if the backend runs somewhere other than `http://localhost:8000`).

## Run

```bash
npm run dev
```

This starts the Vite frontend **and** the FastAPI backend on
`http://127.0.0.1:8000`. Open the URL Vite prints (normally
http://localhost:5173). Stopping `npm run dev` stops both. After changing
backend code, restart `npm run dev`.

## Check it works

1. http://localhost:8000/api/v1/health → `"status": "healthy"` (backend is up).
2. http://localhost:8000/api/v1/health/supabase → `"supabase": "connected"`.
   `"not_configured"` means `backend/.env` is missing, still has the
   placeholder values, or has the publishable key instead of the secret key —
   the `message` says which.
3. The app's sidebar lists the shared conversations. If it shows
   *"Unable to load conversation history."*, the line under it says why
   (backend not running, Supabase not configured, …).

API docs: http://localhost:8000/docs.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Sidebar: *Cannot reach the SatQuery backend at http://localhost:8000/api/v1* | Backend not running on this machine | `npm run setup` (first time), then restart `npm run dev`; the terminal shows `[satquery] Backend NOT started` if the venv is missing |
| Sidebar: *Supabase is not configured …* | `backend/.env` missing or still has placeholders | Fill in `SUPABASE_URL` / `SUPABASE_SECRET_KEY`, restart `npm run dev` |
| Sidebar: *SUPABASE_SECRET_KEY … is the publishable/anon key* | Wrong key pasted | Use the secret / service_role key |
| *Image pairs / TIFF previews are not set up yet …* (503) | The shared database is missing a migration | Run the named file from `backend/supabase/migrations/` once in the Supabase SQL editor (already done for the shared project) |

## Backend without npm (optional)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Or with Docker (reads `backend/.env` at run time; it is not baked into the image):

```bash
cd backend
docker compose up --build
```

Then run the frontend alone with `SATQUERY_SKIP_BACKEND=1 npm run dev`.

## Tests

```bash
cd backend && .venv\Scripts\python -m pytest -q      # macOS/Linux: .venv/bin/python -m pytest -q
npm run build
```

More detail: [backend/README.md](backend/README.md) (endpoints, storage,
migrations) and [CLAUDE.md](CLAUDE.md) (architecture and project rules).
