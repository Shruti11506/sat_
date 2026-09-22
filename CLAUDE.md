# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server (default port 5173)
npm run build     # production build (outputs to dist/)
npm run preview   # preview the production build locally
npm run lint      # run oxlint (rules in .oxlintrc.json)
```

There is no test suite or CI configuration for the frontend.

```bash
cd backend && pytest -v                                   # backend test suite (uses a fake Supabase client, no network needed)
cd backend && uvicorn app.main:app --reload --port 8000    # run the backend locally
cd backend && docker compose up                            # run the backend in Docker
```

## Architecture

SatQuery AI is a React + Vite frontend backed by a separate FastAPI service ([backend/](backend/), `Existing UI → FastAPI → Supabase`). The upload → query → history flow is **fully backend-driven and real** — no hardcoded chat history, no fabricated AI analysis text, nothing invented client-side. There is still **no AI/model layer anywhere** (explicitly out of scope): a submitted query creates an `analysis_jobs` row that stays `status: "queued"` forever until a future milestone adds real processing: no VLM, no NDVI/NDWI computation, no confidence scores, no model name.

### Screen routing (no router library)

[App.jsx](src/App.jsx) is the single source of navigation truth. It holds `activeScreen` state (a string id) and a `historyStack` array used for step-by-step "Back" navigation, and conditionally renders one of the screen components based on `activeScreen`:

- `landing` → [LandingHero.jsx](src/components/LandingHero.jsx) — real upload entry point (drag-drop or browse)
- `workspace` → [Workspace.jsx](src/components/Workspace.jsx) — main chat + image viewer, backend-driven
- `viewer` → [ImageViewer.jsx](src/components/ImageViewer.jsx)
- `change` / `fusion` / `pipeline` / `analytics` / `report` → [ChangeDetection.jsx](src/components/ChangeDetection.jsx) / [FusionViewer.jsx](src/components/FusionViewer.jsx) / [AgentPipeline.jsx](src/components/AgentPipeline.jsx) / [AnalyticsDashboard.jsx](src/components/AnalyticsDashboard.jsx) / [ReportScreen.jsx](src/components/ReportScreen.jsx) — **pre-existing demo screens, out of scope for the backend-persistence milestone**, still rendering entirely from `SATELLITE_SCENARIOS` mock data (see below). Reachable via the "Compare"/"Full Report" buttons in Workspace's header and a couple of sidebar shortcuts.

Screens navigate via callback props (`onNavigateScreen`, `onGoBack`) passed down from `App`, not via URL changes — there's no `react-router`. There is no natural-language redirection anymore (typing "report" or "compare" used to jump into the mock Report/Change screens with fabricated data; that branch was removed — those queries now go through the same real `/api/v1/analysis` flow as everything else).

### Real upload → query → history flow

- [src/lib/apiClient.ts](src/lib/apiClient.ts) — typed client for every backend endpoint, including `uploadImagery()`, `submitAnalysis()`, `getAnalysisHistory()`.
- [LandingHero.jsx](src/components/LandingHero.jsx)'s `processFile()` uploads the selected file via `POST /api/v1/imagery/upload` (real bytes → Supabase Storage bucket `Satquery` → an `imagery` row) during its existing "Parsing GeoTIFF Metadata..." loading state. No "Sample Demo" button exists anymore — it used to seed a fully fabricated scenario with no backend record.
- `App.handleStartAnalysis` awaits `submitAnalysis()` before navigating into Workspace, so the chat opens already showing the real **"Analysis request submitted." / status: queued** acknowledgment (or an honest error) — never fabricated analysis text.
- [Workspace.jsx](src/components/Workspace.jsx)'s `handleSendMessage` does the same for a mid-chat query against `backendImageryId` (set on upload, cleared per-message). Its old `generateAgentResponse()` keyword-matcher (fake NDWI/NDVI/SAR paragraphs with invented confidence scores) was deleted entirely, along with the report/compare fake-redirect branches.
- [UserHistorySidebar.tsx](src/components/UserHistorySidebar.tsx) fetches `GET /api/v1/analysis/history` on mount and on every new submission (via a `refreshToken` prop bumped from `App`/`Workspace`). No hardcoded `INITIAL_HISTORY` — empty data renders "No analysis history yet.", a failed fetch renders "Unable to load analysis history." with Retry, neither ever falls back to sample data. Clicking an item re-fetches that imagery + its jobs fresh and reconstructs the chat (`App.handleSelectHistoryItem`).
- Refresh persistence: `localStorage['satquery-last-imagery-id']` holds only a pointer, never data — on mount `App.jsx` re-fetches that imagery + history fresh from the backend (`buildWorkspaceScenario()`); a stale/deleted pointer is cleared, never displayed.
- `SATELLITE_SCENARIOS` mock data lives on in [src/data/mockData.js](src/data/mockData.js) but is now used **only** by the 5 out-of-scope legacy screens listed above — the primary flow never reads from it. `SUGGESTED_QUERIES` (the landing-page chip suggestions) and `QUICK_SUGGESTIONS` (Workspace's chat pills) are still static UI copy, which is fine — clicking them submits through the real flow like any typed query.

### Theming

Dual dark/light theme toggled via a `data-theme` attribute on `<html>`, persisted to `localStorage` under `satquery-theme` (state lives in `App.jsx`). Two systems coexist in [src/index.css](src/index.css):
- shadcn/Tailwind CSS variables (`--background`, `--primary`, `--sidebar-*`, etc.) scoped under `:root` / `.dark, [data-theme="dark"]`, used by the `ui/` (shadcn) components.
- A separate hand-rolled design-token system (`--space-*`, `--radius-*`, `--font-*`, `--accent`, etc.) used by the custom screen components' inline styles and [App.css](src/App.css).

`GradientBackground` ([oceanic-shimmer.tsx](src/components/ui/oceanic-shimmer.tsx)) renders both a `dark-blue` and `light-white` animated background simultaneously, cross-fading opacity based on `theme` — not conditionally mounted/unmounted.

### Component conventions

- `.jsx` files are the hand-written screen components (top-level pages); `.tsx` files under `src/components/ui/` are shadcn/ui primitives (button, dialog, sidebar, tooltip, etc.) plus a few bespoke `.tsx` components (`UserHistorySidebar`, `ChitravitsLogo`, `oceanic-shimmer`). Both coexist — this is not a strict TS migration, just how shadcn scaffolds components.
- Path alias `@/*` → `src/*` (configured in both [vite.config.js](vite.config.js) and [tsconfig.json](tsconfig.json)) — use it for new imports.
- The sidebar system ([components/ui/sidebar.tsx](src/components/ui/sidebar.tsx)) is shadcn's composable `Sidebar`/`SidebarProvider`/`SidebarTrigger`/`SidebarInset` primitives; [UserHistorySidebar.tsx](src/components/UserHistorySidebar.tsx) is the app-specific instance built on top of them, grouped by `today`/`sevenDays`/`thirtyDays` computed client-side from each item's real `created_at`.
- `cn()` in [src/lib/utils.ts](src/lib/utils.ts) (`clsx` + `tailwind-merge`) is the standard class-merging helper used throughout `ui/` components.

### Backend

[backend/](backend/) is a separate FastAPI service — see [backend/README.md](backend/README.md) for full setup (endpoints, Supabase schema, Docker, testing). Routes stay thin; logic lives in `backend/app/services/`, which is the only layer that talks to `backend/app/db/supabase.py`. Uses the existing, private Supabase Storage bucket **`Satquery`** (never `satquery-data` — that name doesn't exist; the backend never creates a bucket).
