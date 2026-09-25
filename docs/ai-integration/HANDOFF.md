# SatQuery AI — AI layer + ML model integration handoff

> **For Claude Code on the college GPU PC. Read this whole file first.**
> GPU time is limited: don't re-explore what is documented here. Verify the
> "fill in" section, then work through §8 in order. After each task, run
> `pytest -q` in `backend/` and tell the user what changed.
>
> Written 2026-09-26 from a planning session with the user (Parth, team
> Chitravits, SIH 2026 PS SIH26167). Where this file and the code disagree, the
> **code wins**. The team edits the repo actively, so re-read any file before
> changing it.

---

## 0. Fill in on the college PC (ask the user if unknown)

| Item | Value |
|---|---|
| OS / GPU / VRAM | `__________` |
| Path to `sat_` repo | `__________` |
| Path to `sat_ml` repo (EarthMind/, MCD-Mamba/) | `__________` |
| **EarthMind fine-tuned weights**: full HF-format folder or LoRA adapter on `sy1998/EarthMind-4B`? Path? | `__________` |
| EarthMind multi-sensor (optical+SAR) weights: `sy1998/EarthMind4B_multi` or fine-tuned? Path? | `__________` |
| **MCD-Mamba checkpoint** `.pth` path | `__________` |
| MCD-Mamba training settings: config yaml / mode (`opt_only`, `sar_only`, multimodal) / `opt_bands` (13 or 4) / patch size | `__________` |
| Python env for EarthMind (e.g. `EarthMind/.venv`) and for MCD-Mamba (WSL2/Linux? conda?) | `__________` |
| Fixes already applied to MCD-Mamba imports during training? | `__________` |

Don't guess any of these. A wrong MCD config/mode/band count silently produces garbage masks.

---

## 1. Project in one paragraph

SatQuery AI: a user uploads satellite imagery (optical/multispectral, SAR,
bi-temporal pairs) and asks questions in natural language. An agent
(LangGraph) decides which specialist model to run, runs it, and returns an
evidence-grounded answer. Mandatory capabilities: VQA, captioning, region
grounding, change detection / change VQA, optical–SAR analysis, and agentic
orchestration.

## 2. Hard rules (from the user and CLAUDE.md)

- **No fake AI output.** Answers, confidences and evidence come only from a model's response. If a model is missing, the job fails with a clear code (`MODEL_NOT_AVAILABLE`), never with placeholder text.
- **Don't redesign the UI** or remove working components. Functional changes only.
- **Don't break existing APIs.** New request fields must be optional.
- Don't delete Supabase tables, buckets or user rows (real data exists). Clean up only your own test data.
- **Never log secrets.** Never commit `.env`, venvs, or weights (`*.pth *.pt *.safetensors *.bin *.ckpt`).
- **No LangChain APIs.** LangGraph only; langchain-core is just its transitive dependency.
- Schema changes: a new numbered file in `backend/supabase/migrations/`, applied **manually** in the Supabase SQL editor. RLS is ON for all tables (migration 0004), so a new table needs `enable row level security`.
- Incremental: small verified steps. Don't rewrite the backend.

## 3. Current system (as of 2026-09-26)

- **Frontend:** React/Vite at the repo root. `npm run dev` also starts the FastAPI backend on :8000 (vite plugin). `src/lib/apiClient.ts` is the only API client; it already has `getJob`, `getResult` and evidence helpers.
- **Backend (`backend/`):** FastAPI, all routes under `/api/v1`, envelope `{success, data, error}`. Routes are thin, logic lives in `app/services/`, and `app/db/supabase.py` is the single client (service-role key).
- **Data:** Supabase Postgres + Storage bucket `Satquery`. Uploads go to `imagery/{uuid}/{filename}`. For TIFFs, `raster_service.py` (rasterio) generates a thumbnail PNG plus lat/lon/bbox/cloud cover.
- **Flow today:** `POST /analysis` → `analysis_service.create_analysis` → `job_service.create_job` inserts `analysis_jobs` with status `queued`. **Nothing processes queued jobs yet.** The UI shows "Analysis request submitted." and never polls.
- **The frontend always sends `analysis_type: "general_analysis"` and ONE `imagery_id`.**
- **Tables:** `profiles` (singleton), `user_settings`, `conversations`, `imagery` (has `sensor`, `source`, `metadata`, `mime_type`, `storage_path`, `bucket`, `acquisition_date`), `analysis_jobs` (`status`, `model_name`, `result_id`, `error_message`, `started_at`, `completed_at`, single `imagery_id`), `analysis_results` (`job_id`, `answer`, `confidence`, `model_name`, `analysis_type`, `raw_output jsonb`), `evidence` (`result_id`, `evidence_type`, `description`, `source_reference`, `bbox`, `confidence`, `metadata`).
- Existing migrations: 0002, 0003, 0004 (profiles + RLS), 0005 (settings). **The next migration number is 0006.**
- `services/usage_classifier.py` has a keyword-based `classify_data_type` (SAR / Multispectral / ...). It can be reused to infer image modality.
- `backend/requirements.txt` already includes `langgraph>=1.0,<2` and `rasterio`.

## 4. AI layer already in the repo (built 2026-09-24)

```
backend/app/ml/contracts.py      TaskType, Modality, ImageRole, ImageRef (storage pointer, never pixels),
                                 ModelRequest, ModelResponse, EvidenceItem (mirrors evidence table),
                                 ModelService ABC, errors: ModelNotAvailableError / ModelInputError /
                                 ModelExecutionError (each has .code)
backend/app/ml/registry.py       ModelRegistry (task -> ModelService). EMPTY today.
backend/app/orchestrator/state.py    OrchestratorState TypedDict (errors/trace/intermediate_results append-only)
backend/app/orchestrator/routing.py  input configs + routing tables
backend/app/orchestrator/nodes.py    validate_inputs, route, execute_step, compose_response + edge fns
backend/app/orchestrator/graph.py    build_graph(registry, classifier), run_orchestration(...)
backend/tests/test_orchestrator.py   16 tests using test-double models
```

**Graph:** `START → validate_inputs → route → execute_step (loops over plan) → compose_response → END`. Any error short-circuits to `compose_response`, which returns `status="failed"` and `final_response=None`.

**`run_orchestration(job_id, query, images: list[ImageRef], requested_analysis_type="general_analysis", registry=None, classifier=None)`** returns the final state dict with `status`, `final_response`, `errors`, `trace`, `task_type`, `plan` and `intermediate_results`.

`final_response` = `{task_type, answer, confidence, model_name, models_used, outputs{task: outputs}, evidence[]}`.

**Input configs** (decided in `validate_inputs`):
- 1 image → `single`
- 2 images with roles or modalities {optical, sar} → `cross_modal`
- 2 images, same known modality → `bitemporal` (ordered by `acquisition_date`; if dates are missing, upload order is used and a warning goes in the trace)
- 2 images with unknown modality → `INPUT_AMBIGUOUS`, unless the explicit analysis type resolves it
- more than 2 images → `UNSUPPORTED_INPUT`

**Routing** (in `route`), in order:
1. An explicit `analysis_type` (anything but `general_analysis`), provided the inputs support it (else `INCOMPATIBLE_REQUEST`).
2. The optional `IntentClassifier.classify(query, candidates)`. None is plugged in; the user hasn't chosen one.
3. Input default: single → `vqa`, bitemporal → `change_detection`, cross_modal → `optical_sar_analysis`.

The `trace` records `decided_by`. If the registry lacks a model for any planned task, the result is `MODEL_NOT_AVAILABLE`.

Error codes in use: `INVALID_QUERY NO_IMAGES INVALID_INPUT UNSUPPORTED_INPUT IMAGE_NOT_STORED INPUT_AMBIGUOUS INCOMPATIBLE_REQUEST MODEL_NOT_AVAILABLE MODEL_INPUT_INVALID MODEL_EXECUTION_FAILED NO_RESULT`.

⚠ These tests had **not yet been run on the user's machine** as of the last check. Run `pytest -q` first.

## 5. The two models (`sat_ml`)

### EarthMind: VQA, captioning, region grounding, optical+SAR
- Loaded with `AutoModelForCausalLM.from_pretrained(path, torch_dtype=fp16, device_map="cuda:0", trust_remote_code=True)` and `AutoTokenizer.from_pretrained(path, trust_remote_code=True)`.
- **Single sensor:** `model.predict_forward(image=<PIL RGB>, text="<image>...", tokenizer=tok)` returns `{"prediction": str, "prediction_masks": [...] }`. Masks appear when the text contains `[SEG]` (asked to segment); `prediction_masks[i][0]` is an H×W mask.
- **Optical+SAR:** `model.predict_forward_multi(image=<SAR PIL>, rgb_image=<optical PIL>, text=..., tokenizer=tok)`, using the multi weights (`sy1998/EarthMind4B_multi` or the user's fine-tune).
- Reference scripts: `EarthMind/run_inference.py` and `demo.py`.
- Pinned deps: transformers 4.42.3, torch 2.3.1, mmcv 2.1.0, xtuner. **Must run in its own env, never the backend env.**
- About 9 GB VRAM per model in fp16. No calibrated confidence, so return `confidence: null`.
- It takes RGB. Adapt uploads:
  - 3-band 8-bit: pass through.
  - Sentinel-2 multiband: true colour B04/B03/B02 (0-based indices 3,2,1 for 12/13 bands; 2,1,0 for 4-band B02,B03,B04,B08) with a 2–98% stretch.
  - SAR VV/VH: pseudo-RGB [VV, VH, VV−VH] with a stretch.
  - State in docs that this is an interface adaptation.
- If the user's fine-tune is a **LoRA adapter**: load the base model, then `PeftModel.from_pretrained(base, adapter_path)` and optionally `merge_and_unload()`. Confirm that `predict_forward` still exists on the result (it comes from remote code on the base model).

### MCD-Mamba: bi-temporal change detection (binary mask, no text)
- The model class is `STMambaBCD_multimodal` in `MCD-Mamba/changedetection/models/MambaBCD_multimodal_diff.py`. Build it with the same kwargs as `changedetection/script/infer_ONERA.py`, from the yacs config (`configs/config.py::get_config(Namespace(cfg=..., opts=None))`), with `opt_only` / `sar_only` / `opt_bands`.
- Forward: `model(pre[B,C,224,224], post[B,C,224,224])` returns logits `[B,2,H,W]`; argmax gives class 1 = change.
- Load the checkpoint with `torch.load` → `load_state_dict`. **Treat missing keys as a hard error** (garbage otherwise).
- Preprocessing (from `datasets/make_data_loader.py` `ONERAChangeDetectionDataset`):
  - Optical: clip to 0–10000, then /10000 (`process_MS`).
  - SAR: clip to −25..0 dB, then rescale (`process_SAR`).
  - Then `imutils.normalize_img_custom`: per-channel 2–98 percentile clip, scaled to 0..1.
  - HWC → CHW, 224×224 patches. Pad (reflect), predict, stitch, crop.
  - In multimodal mode, channels are ordered S2 bands then S1 (VV, VH).
- Known repo problems (the user may have fixed them while training; check):
  - Code imports `MambaCD.*`, but the folder is `MCD-Mamba`. Fix with a `sys.modules['MambaCD']` package alias (`__path__ = [MCD-Mamba dir]`) or rename.
  - `models/MambaBCD.py` (`STMambaBCD`) does not exist.
  - `comparison_models.siamunet_conc` should be `SiamUnet_conc`.
- Needs Linux/WSL2 + CUDA and the compiled `kernels/selective_scan` (`pip install .`). `.cuda()` is hardcoded.
- Output a mask, plus computed counts: changed pixels, fraction, area in m² when the GeoTIFF has a projected CRS in metres. `answer` stays null (the model produces no text). Deterministic arithmetic on the mask is allowed; invented prose is not.

## 6. Target architecture

```
UI → FastAPI POST /analysis (job queued)
   → WORKER (python -m app.worker) claims job, loads imagery rows → ImageRef[]
   → run_orchestration()  [LangGraph]
        execute_step → registry.get(task).predict(req)
                     → RemoteModelService --HTTP--> model server (own env, GPU)
   → worker writes analysis_results + evidence (+ mask PNGs to Storage), job completed/failed
   → UI polls GET /jobs/{id} → GET /results/{id} (+ /evidence) → shows answer
```

- **Model servers** run separately, one per model env: EarthMind on `:8101`, MCD-Mamba on `:8102` (WSL2 localhost forwards to Windows). Each loads its weights once at startup, from local paths in env vars.
- The backend fetches image bytes from Supabase and sends them to the server, so servers never touch storage.
- `trust_remote_code=True`: pin to the local weights folder, and set `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`.

### Wire protocol (backend ↔ model server)

```
GET  /v1/health  -> {"ready": bool, "model_name": str, "model_version": str, "tasks": [..], "detail": str}

POST /v1/predict   multipart/form-data
  request = JSON {
    "task": "vqa|captioning|region_grounding|optical_sar_analysis|change_detection",
    "query": str, "context": {}, "params": {},          # params.prompt overrides the template
    "images": [{"field": "image_0", "imagery_id": str, "role": "single|t1|t2|optical|sar",
                "modality": "optical|sar|unknown", "mime_type": str|null,
                "acquisition_date": str|null, "metadata": {}}]
  }
  image_0, image_1 = raw file bytes
200 -> ModelResponse JSON {"model_name", "model_version", "answer"|null, "confidence"|null,
                           "outputs": {...}, "evidence": [{"evidence_type","description",
                           "source_reference","bbox","confidence","metadata"}]}
503 {"code":"MODEL_NOT_AVAILABLE","message"}   weights/checkpoint missing, or task not served
422 {"code":"MODEL_INPUT_INVALID","message"}   wrong band count, undecodable file, sizes differ
500 {"code":"MODEL_EXECUTION_FAILED","message"}
```

Masks travel as `outputs.mask_png_base64` (MCD) or `outputs.masks[i].mask_png_base64` (EarthMind). **The worker must upload them to Storage and strip the base64 before saving `raw_output`.**

EarthMind prompt templates (tunable):
- vqa / captioning / optical_sar: `"<image>{query}"`
- region_grounding: `"<image>Please segment {query}"`
- Strip `<|...|>` / `</s>` tokens from `prediction`. Keep the raw text in `outputs.raw_prediction`.

## 7. Reference code (drafted and tested with mocks, NOT wired in)

In `docs/ai-integration/reference/`. **Adapt; don't paste blindly.** `config.py` and `storage_service.py` changed after these drafts were written.

- `backend/app/ml/services/remote.py`: `RemoteModelService` (HTTP client implementing the protocol above; maps 503/422/500 and connection errors to model errors) and `supabase_image_loader`.
- `backend/app/ml/registry.py`: registers EarthMind for vqa/captioning/region_grounding/optical_sar_analysis and MCD-Mamba for change_detection, **only when their URL setting is non-empty**.
- `backend/tests/test_remote_model_service.py`: 10 tests with `httpx.MockTransport`, including a graph end-to-end test.
- `backend/storage_download_snippet.py` + `backend/config_snippet.py`: the additions for `storage_service.download_file(...)` and the settings `EARTHMIND_SERVICE_URL`, `MCD_MAMBA_SERVICE_URL`, `MODEL_SERVICE_TIMEOUT_S`.
- `sat_ml/serving/common.py`: FastAPI app factory for the protocol, GPU lock, raster reading (rasterio), mask summary/PNG helpers.
- `sat_ml/serving/earthmind_server.py` and `sat_ml/serving/mcd_mamba_server.py`: the servers. Env vars: `EARTHMIND_MODEL_PATH`, `EARTHMIND_MULTI_MODEL_PATH`, `MCD_CHECKPOINT`, `MCD_CONFIG`, `MCD_MODE`, `MCD_OPT_BANDS`, `MCD_ROOT`. They were written assuming full HF weights and the original MCD repo layout. **Adjust to §0.**

## 8. Tasks, in order (each with a done-check)

**T0 — Baseline (10 min).** Backend venv, `pip install -r requirements.txt`, `pytest -q`. Everything must pass before continuing. `npm run dev` should still upload and query as before.

**T1 — Backend model client.** Copy and adapt `remote.py` and the registry; add the settings and `download_file`; add `EARTHMIND_SERVICE_URL=` and `MCD_MAMBA_SERVICE_URL=` to `.env.example`; copy the tests.
✅ `pytest -q` passes.

**T2 — EarthMind server.** Copy `serving/` into `sat_ml`. In the EarthMind env: `pip install fastapi uvicorn python-multipart rasterio`, set the weight paths from §0, then run:
`uvicorn serving.earthmind_server:app --host 127.0.0.1 --port 8101` (from the `sat_ml` dir).
✅ `/v1/health` shows `ready:true`, and a curl predict with `EarthMind/demo_images/00004.jpg` returns real text.
If `run_inference.py` itself fails, fix that first.

**T3 — MCD-Mamba server.** In WSL2/Linux with the CUDA kernel built, set `MCD_CHECKPOINT`, `MCD_CONFIG`, `MCD_MODE` and `MCD_OPT_BANDS` **exactly as trained**, then run it on :8102.
✅ Health is ready, and predict with two OSCD test-city images returns a plausible mask (compare to the label).

**T4 — Worker** (new file `backend/app/worker.py`, run with `python -m app.worker`):
- Loop: poll every ~2 s for `analysis_jobs.status='queued'`, **only jobs with `created_at` >= worker start** (so the pre-existing queued rows stay untouched; allow `--include-backlog` to override).
- Claim: `update ... set status='processing', started_at=now() where id=? and status='queued'`. Skip if 0 rows.
- Build `ImageRef`s from the imagery rows:
  - modality from `sensor`/`source`/`metadata`/`mime` (reuse `usage_classifier.classify_data_type`; SAR → `sar`, optical/multispectral → `optical`, else `unknown`)
  - `bucket`, `storage_path`, `mime_type`, `acquisition_date` (isoformat)
- Call `run_orchestration(job_id, query, images, requested_analysis_type=job.analysis_type)`.
- **Completed:**
  - Upload each mask PNG to `evidence/{job_id}/mask_{i}.png` (use `storage_service.upload_file`); set evidence `source_reference` to that path.
  - Insert `analysis_results` (`answer`, `confidence`, `model_name`, `analysis_type` = task_type, `raw_output` = final_response without base64 + trace + plan), then the evidence rows.
  - Update the job: `status='completed'`, `model_name`, `result_id`, `completed_at`.
- **Failed:** `status='failed'`, `error_message` = `"CODE: message"` of the first error, `completed_at`.
- Any unexpected exception → mark failed with `INTERNAL_ERROR`. Never leave a job in `processing`.
- Tests with the fake Supabase (`tests/fakes.py` supports insert/update/eq) and a registry of test doubles.
✅ Ask a question in the UI and watch the job in Supabase go queued → processing → completed, with an `analysis_results` row holding EarthMind's text.

**T5 — Show results in the chat** (functional only; no visual redesign).
- In `Workspace.jsx` (and the ack created in `App.jsx`): after an ack with `jobId`, poll `getJob` every 3 s until `completed` or `failed` (stop on unmount, cap at ~10 min).
- **Completed:** `getResult(result_id)` and replace the ack text with `answer`. If `answer` is null (MCD-Mamba), show the computed outputs (changed %, area) and a mask link from the evidence. Use the existing confidence badge only when `confidence` is non-null.
- **Failed:** show `error_message`.
- On restore (`buildConversationScenario` / `buildLegacyScenario`), fetch the results of completed jobs instead of showing "Analysis request submitted."
✅ Answers show and survive a page refresh.

**T6 — Two-image questions** (after T4/T5 work):
- Migration `0006_analysis_inputs.sql`: `alter table analysis_jobs add column if not exists input_imagery_ids uuid[];` (additive).
- `AnalysisCreate.additional_imagery_ids: list[UUID] | None = None`. Validate that each exists; store `[imagery_id, *additional]` in `input_imagery_ids`. The worker uses `input_imagery_ids`, falling back to `[imagery_id]`.
- **UI trigger: user decision pending.** Proposal: the existing "Compare These Both" quick suggestion sends the conversation's last two images.
- **Modality marking: user decision pending.** Proposal: infer it from `sensor`/filename/band count via `usage_classifier`; the upload route already accepts a `sensor` form field.
✅ Two dates + "What changed?" returns the MCD mask and area. Optical + SAR + "Compare them" returns an EarthMind-multi answer.

**T7 — End-to-end matrix + rehearsal.**

| Test | Expected |
|---|---|
| 1 image, "What is in this image?" | EarthMind answer |
| 1 image, "Segment the buildings" | Mask evidence |
| 2 dates, "What changed?" | MCD mask + area |
| Optical + SAR, "Compare them" | EarthMind-multi answer |
| Model server stopped | Job failed `MODEL_NOT_AVAILABLE`, no crash |
| Page refresh | Answers persist |

## 9. Commands cheat sheet

```
# backend
cd sat_/backend && .venv\Scripts\activate && pytest -q
npm run dev                       # repo root: Vite + backend (:8000)
python -m app.worker              # separate terminal (backend dir)

# model servers (from sat_ml dir, each in its own env)
uvicorn serving.earthmind_server:app --host 127.0.0.1 --port 8101
uvicorn serving.mcd_mamba_server:app --host 127.0.0.1 --port 8102

# backend/.env
EARTHMIND_SERVICE_URL=http://127.0.0.1:8101
MCD_MAMBA_SERVICE_URL=http://127.0.0.1:8102
HF_HUB_OFFLINE=1 (in the EarthMind server env)
```

## 10. Troubleshooting

| Symptom | Cause |
|---|---|
| Job stays `queued` | Worker not running, or the job predates the worker start (backlog skipped by design) |
| `MODEL_NOT_AVAILABLE` | Server not running, URL not set, backend not restarted, or weights not loaded (check `/v1/health` detail) |
| `MODEL_INPUT_INVALID` | Band count ≠ trained `opt_bands`, T1/T2 sizes differ, or a TIFF needs rasterio |
| EarthMind OOM | Both models on a small GPU. Load only single, or use a bigger GPU |
| MCD import errors | `MambaCD` alias / missing `MambaBCD.py` / `siamunet_conc` case (see §5) |
| `SUPABASE_ERROR` PGRST205/42703 | Migration 0006 not applied in the SQL editor |
| Old backend code served | `npm run dev` backend has no `--reload`; restart it |

## 11. Deployment notes (not for this session)

- Weights stay on the GPU machine's disk, never in git, Docker images or the Supabase DB.
- For evaluators hitting the app at unknown times, the options discussed were: the college PC kept on with a secure tunnel, or Modal serverless GPU (Starter plan had $30/month free compute as of 2026-09-25; scale-to-zero, cold starts).
- Before public exposure: an access code/login, a shared secret header between backend and model servers, rate limits, CORS locked down, and rotating the Supabase service key (see CLAUDE.md known issues).
