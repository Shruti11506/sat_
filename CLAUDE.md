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

SatQuery AI is a **fully client-side, single-page React app** — a demo/prototype of a conversational satellite remote-sensing analysis tool (ChatGPT/Gemini-style UX applied to geospatial imagery). There is no backend: every "AI analysis" is a canned response, keyword-matched against the user's query and pulled from static mock data. Nothing here calls a real model or API.

### Screen routing (no router library)

[App.jsx](src/App.jsx) is the single source of navigation truth. It holds `activeScreen` state (a string id) and a `historyStack` array used for step-by-step "Back" navigation, and conditionally renders one of the screen components based on `activeScreen`:

- `landing` → [LandingHero.jsx](src/components/LandingHero.jsx) — upload/demo entry point
- `workspace` → [Workspace.jsx](src/components/Workspace.jsx) — main chat + image viewer
- `viewer` → [ImageViewer.jsx](src/components/ImageViewer.jsx)
- `change` → [ChangeDetection.jsx](src/components/ChangeDetection.jsx) — bi-temporal before/after slider
- `fusion` → [FusionViewer.jsx](src/components/FusionViewer.jsx)
- `pipeline` → [AgentPipeline.jsx](src/components/AgentPipeline.jsx)
- `analytics` → [AnalyticsDashboard.jsx](src/components/AnalyticsDashboard.jsx)
- `report` → [ReportScreen.jsx](src/components/ReportScreen.jsx)

Screens navigate via callback props (`onNavigateScreen`, `onGoBack`) passed down from `App`, not via URL changes — there's no `react-router`. Natural-language redirection also happens: typing "report" or "compare" into a chat prompt routes to the `report`/`change` screens instead of producing a chat reply (see the keyword checks in `App.handleStartAnalysis` and `Workspace.handleSendMessage`).

### Mock "AI" response engine

All analysis text, confidence scores, execution traces, and evidence images are fabricated:

- [src/data/mockData.js](src/data/mockData.js) — `SATELLITE_SCENARIOS` array: pre-built scenario objects (Bengaluru, Chilika wetland, etc.) each with land-cover stats, spectral indices, bounding boxes, and a seeded `chatHistory`. Selecting a scenario (landing page demo button, or the history sidebar) just swaps `currentScenario` in `App`.
- `Workspace.generateAgentResponse(query, attachment)` — keyword-matches the user's typed query (water/lake/reservoir → NDWI response, vegetation/ndvi/canopy → NDVI response, building/sar/urban → structure-detection response, change/temporal → change-detection response, sensor/crs/band → metadata response, else a generic fallback) and returns fabricated `taskType`, `confidence`, markdown `text`, and `executionSteps`.

When extending "AI" behavior, follow this same pattern (add a keyword branch + response shape) unless the task is to wire up a real backend — in which case `generateAgentResponse` and the report/compare redirection logic in `handleSendMessage` are the integration points to replace.

### Theming

Dual dark/light theme toggled via a `data-theme` attribute on `<html>`, persisted to `localStorage` under `satquery-theme` (state lives in `App.jsx`). Two systems coexist in [src/index.css](src/index.css):
- shadcn/Tailwind CSS variables (`--background`, `--primary`, `--sidebar-*`, etc.) scoped under `:root` / `.dark, [data-theme="dark"]`, used by the `ui/` (shadcn) components.
- A separate hand-rolled design-token system (`--space-*`, `--radius-*`, `--font-*`, `--accent`, etc.) used by the custom screen components' inline styles and [App.css](src/App.css).

`GradientBackground` ([oceanic-shimmer.tsx](src/components/ui/oceanic-shimmer.tsx)) renders both a `dark-blue` and `light-white` animated background simultaneously, cross-fading opacity based on `theme` — not conditionally mounted/unmounted.

### Component conventions

- `.jsx` files are the hand-written screen components (top-level pages); `.tsx` files under `src/components/ui/` are shadcn/ui primitives (button, dialog, sidebar, tooltip, etc.) plus a few bespoke `.tsx` components (`UserHistorySidebar`, `ChitravitsLogo`, `oceanic-shimmer`). Both coexist — this is not a strict TS migration, just how shadcn scaffolds components.
- Path alias `@/*` → `src/*` (configured in both [vite.config.js](vite.config.js) and [tsconfig.json](tsconfig.json)) — use it for new imports.
- The sidebar system ([components/ui/sidebar.tsx](src/components/ui/sidebar.tsx)) is shadcn's composable `Sidebar`/`SidebarProvider`/`SidebarTrigger`/`SidebarInset` primitives; [UserHistorySidebar.tsx](src/components/UserHistorySidebar.tsx) is the app-specific instance built on top of them, with a hardcoded `INITIAL_HISTORY` list grouped by `today`/`sevenDays`/`thirtyDays`.
- `cn()` in [src/lib/utils.ts](src/lib/utils.ts) (`clsx` + `tailwind-merge`) is the standard class-merging helper used throughout `ui/` components.

### Backend

[backend/](backend/) is a separate FastAPI service (`Existing UI → FastAPI → Supabase`) — see [backend/README.md](backend/README.md) for full setup. It has **no AI/model layer**: `/api/v1/analysis` only records a request row (`analysis_jobs`, status stays `queued`); `/api/v1/results` and `/api/v1/results/{id}/evidence` are retrieval-only and 404 until something writes real data. [src/lib/apiClient.ts](src/lib/apiClient.ts) is a typed client for it but is **not wired into any screen** — the frontend's chat still runs entirely on the keyword-matched mock data described above. Routes stay thin; logic lives in `backend/app/services/`, which is the only layer that talks to `backend/app/db/supabase.py`.
