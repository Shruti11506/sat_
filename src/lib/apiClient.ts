/**
 * Centralized client for the SatQuery FastAPI backend.
 *
 * Not yet wired into any screen: the existing UI's chat/analysis flow is
 * still fully mocked (see Workspace.jsx / mockData.js), and this backend
 * milestone intentionally has no AI layer to back it with real answers.
 * This client is the integration point a future AI milestone will use.
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
  return request<{ status: string }>("/health/supabase");
}

// ---- Imagery -----------------------------------------------------------

export interface ImageryPayload {
  name: string;
  source?: string;
  sensor?: string;
  acquisition_date?: string;
  file_path?: string;
  storage_url?: string;
  cloud_cover?: number;
  latitude?: number;
  longitude?: number;
  bbox?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function registerImagery(payload: ImageryPayload) {
  return request<{ id: string; name: string; status: string }>("/imagery", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listImagery(page = 1, pageSize = 20) {
  return request<{
    items: Array<ImageryPayload & { id: string; created_at: string }>;
    pagination: { page: number; page_size: number; total: number };
  }>(`/imagery?page=${page}&page_size=${pageSize}`);
}

export function getImagery(imageryId: string) {
  return request<ImageryPayload & { id: string; created_at: string }>(`/imagery/${imageryId}`);
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

export function createAnalysis(imageryId: string, analysisType: AnalysisType, query?: string) {
  return request<{ job_id: string; status: string }>("/analysis", {
    method: "POST",
    body: JSON.stringify({ imagery_id: imageryId, analysis_type: analysisType, query }),
  });
}

export function getJob(jobId: string) {
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
