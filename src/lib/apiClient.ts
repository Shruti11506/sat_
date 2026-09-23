/**
 * Centralized client for the SatQuery FastAPI backend -- the only place the
 * frontend talks to it. Uploads go to Supabase Storage, queries create real
 * (queued) analysis_jobs rows, and both are grouped under a conversation,
 * which is what the sidebar lists. There is no AI layer yet: nothing here
 * returns or fabricates an analysis answer.
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
  conversation_id?: string | null;
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
    /** Groups the upload under a conversation. Never changes its title. */
    conversationId?: string;
  }
) {
  const form = new FormData();
  form.append("file", file);
  if (meta?.name) form.append("name", meta.name);
  if (meta?.source) form.append("source", meta.source);
  if (meta?.sensor) form.append("sensor", meta.sensor);
  if (meta?.acquisition_date) form.append("acquisition_date", meta.acquisition_date);
  if (meta?.metadata) form.append("metadata", JSON.stringify(meta.metadata));
  if (meta?.conversationId) form.append("conversation_id", meta.conversationId);

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
  conversation_id: string | null;
  status: string;
}

/** Records an analysis request (analysis_jobs, status "queued"). Performs NO AI inference. */
export function submitAnalysis(
  imageryId: string,
  analysisType: AnalysisType,
  query: string,
  conversationId?: string | null
) {
  return request<AnalysisCreateResult>("/analysis", {
    method: "POST",
    body: JSON.stringify({
      imagery_id: imageryId,
      analysis_type: analysisType,
      query,
      conversation_id: conversationId || null,
    }),
  });
}

/** @deprecated use submitAnalysis */
export const createAnalysis = submitAnalysis;

export interface HistoryItem {
  job_id: string;
  imagery_id: string;
  /** null for requests made before conversations existed (legacy history). */
  conversation_id: string | null;
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

// ---- Conversations -----------------------------------------------------------

export type TitleSource = "default" | "auto" | "user";

export interface Conversation {
  id: string;
  /** "New Chat" until the first meaningful query; never an uploaded filename. */
  title: string;
  /** "default" = still "New Chat", "auto" = set once from the first query, "user" = renamed. */
  title_source: TitleSource;
  created_at: string;
  updated_at: string;
}

export interface ConversationJob {
  id: string;
  imagery_id: string | null;
  conversation_id: string | null;
  analysis_type: AnalysisType;
  query: string | null;
  status: HistoryItem["status"];
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  imagery: ImageryRecord[];
  jobs: ConversationJob[];
}

export function createConversation() {
  return request<Conversation>("/conversations", { method: "POST" });
}

/** Most recently active first -- the sidebar's data source. */
export function listConversations(limit = 100) {
  return request<Conversation[]>(`/conversations?limit=${limit}`);
}

/** The conversation plus its uploads (fresh URLs) and queries, oldest first. */
export function getConversation(conversationId: string) {
  return request<ConversationDetail>(`/conversations/${conversationId}`);
}

/** Manual rename -- the backend marks it user-defined so it is never auto-overwritten. */
export function renameConversation(conversationId: string, title: string) {
  return request<Conversation>(`/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

/**
 * generateConversationTitle: asks the backend to title the conversation from
 * its first meaningful stored query. Runs at most once per conversation
 * (no-op once titled or renamed), so it is safe to call after any query.
 */
export function generateConversationTitle(conversationId: string) {
  return request<Conversation>(`/conversations/${conversationId}/title`, { method: "POST" });
}

/** Deletes the conversation with its queries and uploaded files. */
export function deleteConversation(conversationId: string) {
  return request<{ id: string; status: string }>(`/conversations/${conversationId}`, {
    method: "DELETE",
  });
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
