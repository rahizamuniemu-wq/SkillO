// ─── Base URL ────────────────────────────────────────────────────────────────
const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8080";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  role: "worker" | "company" | "admin";
  firstName: string;
  lastName: string;
  companyName?: string | null;
  industry?: string | null;
  university?: string | null;
  batch?: string | null;
  department?: string | null;
  skills?: string | null;
  points: number;
  website?: string | null;
  description?: string | null;
  isVerified?: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: "worker" | "company";
  firstName: string;
  lastName: string;
  university?: string;
  batch?: string;
  department?: string;
  skills?: string;
  companyName?: string;
  industry?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  role?: "worker" | "company" | "admin";
}

export interface AuthResponse {
  token: string;
  user: ApiUser;
}

export interface ApiError {
  error: string;
}

export interface PlatformStats {
  totalWorkers: number;
  totalCompanies: number;
  verifiedWorkers: number;
  verifiedCompanies: number;
  totalUsers: number;
  recentSignups7d: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  companyName?: string | null;
  university?: string | null;
  department?: string | null;
  isVerified: boolean;
  points: number;
  createdAt: string;
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "skillo_jwt";

export function saveToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  let body: unknown;
  try { body = await res.json(); } catch { body = { error: `Server returned status ${res.status}` }; }
  if (!res.ok) {
    const msg = (body as ApiError)?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export interface UploadResponse {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/uploads`, { method: "POST", headers, body: form });
  let body: unknown;
  try { body = await res.json(); } catch { body = { error: `Server returned status ${res.status}` }; }
  if (!res.ok) throw new Error((body as ApiError)?.error ?? `Upload failed (${res.status})`);
  const result = body as UploadResponse;
  return { ...result, url: new URL(result.url, `${BASE}/`).toString() };
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function register(payload: RegisterPayload): Promise<{ message: string; email: string }> {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  return request("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) });
}

export async function resendCode(email: string): Promise<{ message: string }> {
  return request("/api/auth/resend-code", { method: "POST", body: JSON.stringify({ email }) });
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export async function getMe(): Promise<ApiUser> {
  return request("/api/auth/me");
}

export async function updateProfile(payload: Partial<Pick<ApiUser, "firstName" | "lastName" | "university" | "batch" | "department" | "skills" | "companyName" | "industry" | "website" | "description">>): Promise<ApiUser> {
  return request("/api/auth/profile", { method: "PATCH", body: JSON.stringify(payload) });
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<PlatformStats> {
  return request("/api/admin/stats");
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  return request("/api/admin/users");
}

// ─── Jobs API ─────────────────────────────────────────────────────────────────

export interface ApiJobMaterial {
  type: string;
  label: string;
  url: string;
  source: "link" | "upload" | "drive" | "supabase";
  size?: string;
}

export interface ApiJob {
  id: number;
  companyId?: string;
  companyName: string;
  companyEmail: string;
  industry?: string;
  title: string;
  category: string;
  description: string;
  skills: string[];
  slots: number;
  filled: number;
  deadline: string;
  reward: number;
  points: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  status: "active" | "review" | "closed";
  submissions: number;
  useAI: boolean;
  materials: ApiJobMaterial[];
  submissionFormats: string[];
  isDemo?: boolean;
}

export interface CreateJobPayload {
  title: string;
  category: string;
  description: string;
  skills: string[];
  slots: number;
  deadline: string;
  reward: number;
  points: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  useAI: boolean;
  materials: ApiJobMaterial[];
  submissionFormats: string[];
}

export interface JobSuggestion {
  skills: string[];
  points: number;
  submissionFormats: string[];
  resources: ApiJobMaterial[];
  rationale: string;
}

export async function suggestJobSettings(payload: {
  title: string;
  category: string;
  description: string;
  materials: ApiJobMaterial[];
}): Promise<JobSuggestion> {
  return request<JobSuggestion>("/api/jobs/suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface JobPatchPayload {
  title?: string;
  reward?: number;
  deadline?: string;
  status?: string;
  filledDelta?: number;
  submissionsDelta?: number;
  materials?: ApiJobMaterial[];
  submissionFormats?: string[];
}

export async function listJobs(): Promise<ApiJob[]> {
  return request<ApiJob[]>("/api/jobs");
}

export async function createJob(payload: CreateJobPayload): Promise<ApiJob> {
  return request<ApiJob>("/api/jobs", { method: "POST", body: JSON.stringify(payload) });
}

export async function patchJob(id: number, patch: JobPatchPayload): Promise<ApiJob> {
  return request<ApiJob>(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function bookJob(id: number): Promise<ApiJob> {
  return request<ApiJob>(`/api/jobs/${id}/book`, { method: "POST" });
}

export async function listBookedJobs(): Promise<number[]> {
  return request<number[]>("/api/jobs/booked");
}

// ─── Submissions API ──────────────────────────────────────────────────────────

export interface ApiWorkerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  university?: string;
  department?: string;
  skills?: string;
  points: number;
}

export interface ApiSubmission {
  id: number;
  jobId: number;
  jobTitle?: string;
  companyName?: string;
  companyEmail?: string;
  workerId?: string;
  workerEmail: string;
  workerName: string;
  worker?: ApiWorkerProfile;
  github: string;
  demo: string;
  attachments: { name: string; url: string; type?: string }[];
  status: "pending" | "accepted" | "rejected";
  restoreSlot: boolean;
  aiNote: string;
  isWinner: boolean;
  pointsAwarded: number;
  feedback: string;
  rating: number;
  createdAt: string;
}

export interface DistributeAward {
  submissionId: number;
  points: number;
  rating: number;
  feedback: string;
}

export async function submitWork(jobId: number, github: string, demo: string, attachments: ApiSubmission["attachments"] = []): Promise<ApiSubmission> {
  return request("/api/submissions", { method: "POST", body: JSON.stringify({ jobId, github, demo, attachments }) });
}

export async function listCompanySubmissions(jobId?: number): Promise<ApiSubmission[]> {
  const qs = jobId ? `?jobId=${jobId}` : "";
  return request(`/api/submissions${qs}`);
}

export async function listMySubmissions(): Promise<ApiSubmission[]> {
  return request("/api/submissions/mine");
}

export async function reviewSubmission(
  id: number,
  status: "accepted" | "rejected",
  feedback: string,
  rating: number,
  restoreSlot = false
): Promise<ApiSubmission> {
  return request(`/api/submissions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, feedback, rating, restore_slot: restoreSlot }),
  });
}

export async function distributeRewards(
  jobId: number,
  awards: DistributeAward[],
  winnerId: number
): Promise<{ ok: boolean; message: string }> {
  return request(`/api/jobs/${jobId}/distribute`, {
    method: "POST",
    body: JSON.stringify({ awards, winnerId }),
  });
}

// ─── Delete job ───────────────────────────────────────────────────────────────
export async function deleteJob(id: number): Promise<{ ok: boolean }> {
  return request(`/api/jobs/${id}`, { method: "DELETE" });
}

// ─── Password Reset API ───────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<{ message: string; email?: string }> {
  return request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export async function verifyResetCode(email: string, code: string): Promise<{ message: string; resetToken: string }> {
  return request("/api/auth/verify-reset-code", { method: "POST", body: JSON.stringify({ email, code }) });
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
  return request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ resetToken, newPassword }) });
}
