/**
 * Centralized client for the SatQuery FastAPI backend.
 *
 * uploadImagery() and submitAnalysis() are wired into Workspace.jsx: selecting
 * a file uploads it to Supabase Storage for real, and submitting a chat query
 * creates a real (queued) analysis_jobs row. The existing mock chat response
 * text is unchanged -- there is still no AI layer to answer with -- these
 * calls run alongside it so the upload/persistence pipeline is real underneath
 * the existing demo UI.
 */

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api/v1";

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      // Never set Content-Type for FormData -- the browser must generate the
      // multipart boundary itself, and a manual header here breaks parsing.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  const body: ApiResponse<T> = await response.json();

  if (!response.ok || !body.success) {
    throw new ApiRequestError(
      response.status,
      body.error || { code: "UNKNOWN_ERROR", message: "Request failed." }
    );
  }

  return body.data as T;
}

// ---- Health ----------------------------------------------------------

export function getHealth() {
  return request<{ status: string; service: string; version: string }>("/health");
}

export function getSupabaseHealth() {
  return request<{ supabase: string; database: string; storage: string; bucket: string }>(
    "/health/supabase"
  );
}

// ---- Imagery -----------------------------------------------------------

export interface ImageryPayload {
  name: string;
  source?: string;
  sensor?: string;
  acquisition_date?: string;
  storage_path?: string;
  bucket?: string;
  storage_url?: string;
  cloud_cover?: number;
  latitude?: number;
  longitude?: number;
  bbox?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ImageryUploadResult {
  id: string;
  name: string;
  original_filename: string;
  bucket: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  status: string;
}

export interface ImageryRecord extends ImageryPayload {
  id: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  /** Freshly-resolved signed (private bucket) or public URL. Re-fetch via getImagery() rather than caching. */
  url: string | null;
  created_at: string;
}

/** Uploads a file to Supabase Storage (bucket: Satquery) via FastAPI and registers its metadata. */
export function uploadImagery(
  file: File,
  meta?: {
    name?: string;
    source?: string;
    sensor?: string;
    acquisition_date?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const form = new FormData();
  form.append("file", file);
  if (meta?.name) form.append("name", meta.name);
  if (meta?.source) form.append("source", meta.source);
  if (meta?.sensor) form.append("sensor", meta.sensor);
  if (meta?.acquisition_date) form.append("acquisition_date", meta.acquisition_date);
  if (meta?.metadata) form.append("metadata", JSON.stringify(meta.metadata));

  return request<ImageryUploadResult>("/imagery/upload", {
    method: "POST",
    body: form,
  });
}

export function registerImagery(payload: ImageryPayload) {
  return request<{ id: string; name: string; status: string }>("/imagery", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listImagery(page = 1, pageSize = 20) {
  return request<{
    items: ImageryRecord[];
    pagination: { page: number; page_size: number; total: number };
  }>(`/imagery?page=${page}&page_size=${pageSize}`);
}

export function getImagery(imageryId: string) {
  return request<ImageryRecord>(`/imagery/${imageryId}`);
}

export function deleteImagery(imageryId: string) {
  return request<{ id: string; status: string }>(`/imagery/${imageryId}`, {
    method: "DELETE",
  });
}

// ---- Analysis / Jobs / Results / Evidence -------------------------------

export type AnalysisType =
  | "vqa"
  | "captioning"
  | "scene_description"
  | "change_detection"
  | "change_vqa"
  | "optical_sar_analysis"
  | "region_grounding"
  | "general_analysis";

export interface AnalysisCreateResult {
  job_id: string;
  imagery_id: string;
  analysis_type: AnalysisType;
  query: string;
  status: string;
}

/** Records an analysis request (analysis_jobs, status "queued"). Performs NO AI inference. */
export function submitAnalysis(imageryId: string, analysisType: AnalysisType, query: string) {
  return request<AnalysisCreateResult>("/analysis", {
    method: "POST",
    body: JSON.stringify({ imagery_id: imageryId, analysis_type: analysisType, query }),
  });
}

/** @deprecated use submitAnalysis */
export const createAnalysis = submitAnalysis;

export interface HistoryItem {
  job_id: string;
  imagery_id: string;
  imagery_name: string | null;
  query: string;
  analysis_type: AnalysisType;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  created_at: string;
}

/** analysis_jobs joined with imagery, most recent first. Retrieval only -- the sidebar's sole data source. */
export function getAnalysisHistory(limit = 50) {
  return request<HistoryItem[]>(`/analysis/history?limit=${limit}`);
}

export function getAnalysisJob(jobId: string) {
  return request<{
    id: string;
    imagery_id: string;
    analysis_type: AnalysisType;
    query: string | null;
    status: "queued" | "processing" | "completed" | "failed" | "cancelled";
    model_name: string | null;
    result_id: string | null;
    error_message: string | null;
    created_at: string;
  }>(`/jobs/${jobId}`);
}

/** @deprecated use getAnalysisJob */
export const getJob = getAnalysisJob;

export function getResult(resultId: string) {
  return request<{
    id: string;
    job_id: string;
    answer: string | null;
    confidence: number | null;
    model_name: string | null;
    analysis_type: AnalysisType;
    raw_output: Record<string, unknown> | null;
  }>(`/results/${resultId}`);
}

export function getEvidence(resultId: string) {
  return request<
    Array<{
      id: string;
      result_id: string;
      evidence_type: string;
      description: string | null;
      source_reference: string | null;
      bbox: Record<string, unknown> | null;
      confidence: number | null;
    }>
  >(`/results/${resultId}/evidence`);
}
