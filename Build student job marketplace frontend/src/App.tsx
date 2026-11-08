import { useState, useEffect } from "react";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import CompanyDashboard from "./pages/company/CompanyDashboard";
import CreateJobPage from "./pages/company/CreateJobPage";
import SubmissionsPage from "./pages/company/SubmissionsPage";
import EvaluateTaskPage from "./pages/company/EvaluateTaskPage";
import CompanyProfilePage from "./pages/company/CompanyProfilePage";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import JobDetailPage from "./pages/worker/JobDetailPage";
import MyJobsPage from "./pages/worker/MyJobsPage";
import CVBuilderPage from "./pages/worker/CVBuilderPage";
import ProfilePage from "./pages/worker/ProfilePage";
import * as api from "./lib/api";

export type Page =
  | "landing"
  | "auth"
  | "admin-login"
  | "admin-dashboard"
  | "company-dashboard"
  | "company-create-job"
  | "company-submissions"
  | "company-evaluate"
  | "company-profile"
  | "worker-dashboard"
  | "worker-job-detail"
  | "worker-my-jobs"
  | "worker-cv"
  | "worker-profile";

export type Role = "company" | "worker" | "admin" | null;

export interface UserAccount {
  id?: string;
  role: "company" | "worker" | "admin";
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  industry?: string;
  website?: string;
  description?: string;
  skills?: string;
  university?: string;
  batch?: string;
  department?: string;
  points?: number;
}

export interface JobMaterial {
  type: string;
  label: string;
  url: string;
  source: "link" | "upload" | "drive" | "supabase";
  size?: string;
}

export interface Job {
  id: number;
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
  companyName: string;
  companyEmail: string;
  industry?: string;
  useAI: boolean;
  materials: JobMaterial[];
  submissionFormats: string[];
  isDemo?: boolean;
}

export interface Submission {
  id: number;
  jobId: number;
  jobTitle: string;
  companyName?: string;
  companyEmail: string;
  workerId?: string;
  workerEmail: string;
  workerName: string;
  worker?: api.ApiWorkerProfile;
  github: string;
  demo: string;
  attachments: api.ApiSubmission["attachments"];
  submittedAt: string;
  status: "pending" | "accepted" | "rejected";
  restoreSlot: boolean;
  aiNote: string;
  rating: number;
  isWinner: boolean;
  pointsAwarded: number;
  feedback: string;
  result?: string;
}

export interface WorkerStats {
  points: number;
  tasksDone: number;
  walletTk: number;
}

export interface AppState {
  page: Page;
  role: Role;
  user: UserAccount | null;
  authMode: "signin" | "signup";
  jobs: Job[];
  bookedJobIds: number[];
  selectedJobId: number | null;
  submissions: Submission[];
  pendingEmail: string | null;
  setPendingEmail: (email: string | null) => void;
  registerUser:     (account: UserAccount) => Promise<string | null>;
  loginUser:        (email: string, password: string, role: "company" | "worker") => Promise<string | null>;
  loginAdmin:       (email: string, password: string) => Promise<string | null>;
  verifyEmail:      (email: string, code: string) => Promise<string | null>;
  resendCode:       (email: string) => Promise<string | null>;
  logout:           () => void;
  navigate:         (page: Page) => void;
  setRole:          (role: Role) => void;
  goAuth:           (role: "company" | "worker", mode?: "signin" | "signup") => void;
  addJob:           (job: Omit<Job, "id" | "filled" | "submissions" | "status">) => Promise<string | null>;
  updateJob:        (id: number, patch: Partial<Job>) => void;
  bookJob:          (jobId: number) => Promise<string | null>;
  openJobDetail:    (jobId: number) => void;
  submitWork:       (jobId: number, github: string, demo: string, attachments?: api.ApiSubmission["attachments"]) => Promise<{ submission?: Submission; error?: string }>;
  updateSubmission: (submissionId: number, patch: Partial<Submission>) => void;
  reviewSubmission: (id: number, status: "accepted" | "rejected", feedback: string, rating: number, restoreSlot?: boolean) => Promise<string | null>;
  distributeRewards:(jobId: number, awards: api.DistributeAward[], winnerId: number) => Promise<string | null>;
  deleteJob:        (jobId: number) => Promise<string | null>;
  refreshSubmissions: () => Promise<void>;
  refreshBookings: () => Promise<void>;
  refreshMe:        () => Promise<void>;
  updateProfile:    (payload: Parameters<typeof api.updateProfile>[0]) => Promise<string | null>;
  awardWorker:      (workerEmail: string, pointsToAdd: number, tkToAdd: number) => void;
  getWorkerStats:   (workerEmail: string) => WorkerStats;
}

const BOOKINGS_KEY     = "skillo_bookings";
const WORKER_STATS_KEY = "skillo_worker_stats";

function apiSubToSub(s: api.ApiSubmission): Submission {
  return {
    id: s.id, jobId: s.jobId, jobTitle: s.jobTitle ?? "", companyName: s.companyName,
    companyEmail: s.companyEmail ?? "", workerId: s.workerId, workerEmail: s.workerEmail,
    workerName: s.workerName, worker: s.worker, github: s.github, demo: s.demo,
    attachments: s.attachments ?? [],
    submittedAt: s.createdAt, status: s.status, restoreSlot: s.restoreSlot ?? false, aiNote: s.aiNote ?? "",
    rating: s.rating, isWinner: s.isWinner, pointsAwarded: s.pointsAwarded, feedback: s.feedback,
  };
}

// Jobs now live in the database (shared across all companies/students).
function loadBookings(email: string): number[] {
  try {
    const all = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || "{}") as Record<string, number[]>;
    return all[email] ?? [];
  } catch { return []; }
}
function saveBookings(email: string, ids: number[]) {
  try {
    const all = JSON.parse(localStorage.getItem(BOOKINGS_KEY) || "{}") as Record<string, number[]>;
    all[email] = ids;
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
function loadSubmissions(): Submission[] { return []; }
function saveSubmissions(_subs: Submission[]) { /* submissions are now DB-backed */ }
function loadAllWorkerStats(): Record<string, WorkerStats> {
  try { return JSON.parse(localStorage.getItem(WORKER_STATS_KEY) || "{}"); } catch { return {}; }
}
function saveAllWorkerStats(all: Record<string, WorkerStats>) {
  localStorage.setItem(WORKER_STATS_KEY, JSON.stringify(all));
}

function apiUserToAccount(u: api.ApiUser): UserAccount {
  return {
    id: u.id, role: u.role as UserAccount["role"], email: u.email,
    firstName: u.firstName, lastName: u.lastName,
    companyName: u.companyName ?? undefined, industry: u.industry ?? undefined,
    website: u.website ?? undefined, description: u.description ?? undefined,
    university: u.university ?? undefined, batch: u.batch ?? undefined,
    department: u.department ?? undefined, skills: u.skills ?? undefined,
    points: u.points,
  };
}

export default function App() {
  const [page, setPage]           = useState<Page>("landing");
  const [role, setRole]           = useState<Role>(null);
  const [user, setUser]           = useState<UserAccount | null>(null);
  const [authMode, setAuthMode]   = useState<"signin" | "signup">("signup");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [adminPath] = useState(() => typeof window !== "undefined" && window.location.pathname.startsWith("/admin"));

  const [jobs, setJobsState]               = useState<Job[]>([]);
  const [bookedJobIds, setBookedJobIds]     = useState<number[]>([]);
  const [selectedJobId, setSelectedJobId]  = useState<number | null>(null);
  const [submissions, setSubmissionsState] = useState<Submission[]>([]);

  // Rehydrate session from JWT
  useEffect(() => {
    const token = api.getToken();

    // Dedicated /admin URL: show the admin login (or dashboard if already an admin)
    if (adminPath) {
      if (!token) { setPage("admin-login"); return; }
      api.getMe()
        .then((u) => {
          if (u.role === "admin") {
            const account = apiUserToAccount(u);
            setUser(account); setRole("admin");
            setPage("admin-dashboard");
          } else {
            setPage("admin-login");
          }
        })
        .catch(() => { api.clearToken(); setPage("admin-login"); });
      return;
    }

    if (!token) return;
    api.getMe()
      .then((u) => {
        const account = apiUserToAccount(u);
        setUser(account);
        setRole(account.role);
        if (account.role === "admin") {
          setPage("admin-dashboard");
        } else {
          setBookedJobIds(loadBookings(account.email));
          setPage(account.role === "company" ? "company-dashboard" : "worker-dashboard");
        }
        refreshJobs();
      })
      .catch(() => {
        // Token is expired or invalid — clear it and stay on landing page
        api.clearToken();
      });
  }, []);

  // Jobs are stored in the database so every company's tasks are visible to all students.
  const refreshJobs = async () => {
    try { setJobsState((await api.listJobs()).map((a: api.ApiJob): Job => ({ ...a }))); } catch { /* ignore */ }
  };
  const refreshBookings = async () => {
    if (role !== "worker") return;
    try {
      const ids = await api.listBookedJobs();
      setBookedJobIds(ids);
      if (user) saveBookings(user.email, ids);
    } catch { /* ignore */ }
  };
  useEffect(() => { if (api.getToken()) refreshJobs(); }, []);

  // Submissions are DB-backed; load appropriate list depending on role.
  const refreshSubmissions = async () => {
    try {
      const r = role;
      if (r === "company") {
        const subs = await api.listCompanySubmissions();
        setSubmissionsState(subs.map(apiSubToSub));
      } else if (r === "worker") {
        const subs = await api.listMySubmissions();
        setSubmissionsState(subs.map(apiSubToSub));
      }
    } catch { /* ignore */ }
  };

  // Keep open dashboards synchronized when another user books, submits, or reviews.
  useEffect(() => {
    if (!api.getToken() || !role) return;
    const sync = () => {
      void refreshJobs();
      if (role === "company" || role === "worker") void refreshSubmissions();
      if (role === "worker") void refreshBookings();
    };
    const timer = window.setInterval(sync, 10000);
    return () => window.clearInterval(timer);
  }, [role, user?.id]);

  // Refresh the current user from the DB (so points stay current after reward distribution)
  const refreshMe = async () => {
    try {
      const u = await api.getMe();
      setUser(apiUserToAccount(u));
    } catch { /* ignore */ }
  };

  const updateProfile = async (payload: Parameters<typeof api.updateProfile>[0]): Promise<string | null> => {
    try {
      const updated = await api.updateProfile(payload);
      setUser(apiUserToAccount(updated));
      return null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : "Failed to save profile";
    }
  };

  const setJobs = (updater: Job[] | ((prev: Job[]) => Job[])) => {
    setJobsState((prev) => (typeof updater === "function" ? (updater as (p: Job[]) => Job[])(prev) : updater));
  };

  const navigate = (p: Page) => setPage(p);
  const goAuth   = (r: "company" | "worker", mode: "signin" | "signup" = "signup") => { setRole(r); setAuthMode(mode); setPage("auth"); };

  const registerUser = async (account: UserAccount): Promise<string | null> => {
    try {
      await api.register({ email: account.email, password: account.password ?? "", role: account.role as "worker" | "company",
        firstName: account.firstName, lastName: account.lastName, companyName: account.companyName, industry: account.industry,
        university: account.university, batch: account.batch, department: account.department, skills: account.skills });
      setPendingEmail(account.email);
      return null;
    } catch (e: unknown) { return e instanceof Error ? e.message : "Registration failed"; }
  };

  const verifyEmail = async (email: string, code: string): Promise<string | null> => {
    try {
      const res = await api.verifyEmail(email, code);
      api.saveToken(res.token);
      const account = apiUserToAccount(res.user);
      setUser(account); setRole(account.role);
      setBookedJobIds(loadBookings(account.email));
      if (account.role === "worker") api.listBookedJobs().then((ids) => { setBookedJobIds(ids); saveBookings(account.email, ids); }).catch(() => {});
      setPendingEmail(null);
      refreshJobs();
      // Load submissions after login
      const r = account.role;
      if (r === "company") api.listCompanySubmissions().then((s) => setSubmissionsState(s.map(apiSubToSub))).catch(() => {});
      else if (r === "worker") api.listMySubmissions().then((s) => setSubmissionsState(s.map(apiSubToSub))).catch(() => {});
      setPage(account.role === "company" ? "company-dashboard" : "worker-dashboard");
      return null;
    } catch (e: unknown) { return e instanceof Error ? e.message : "Verification failed"; }
  };

  const resendCode = async (email: string): Promise<string | null> => {
    try { await api.resendCode(email); return null; }
    catch (e: unknown) { return e instanceof Error ? e.message : "Failed to resend code"; }
  };

  const loginUser = async (email: string, password: string, selectedRole: "company" | "worker"): Promise<string | null> => {
    try {
      const res = await api.login({ email, password, role: selectedRole });
      api.saveToken(res.token);
      const account = apiUserToAccount(res.user);
      setUser(account); setRole(account.role);
      setBookedJobIds(loadBookings(account.email));
      if (account.role === "worker") api.listBookedJobs().then((ids) => { setBookedJobIds(ids); saveBookings(account.email, ids); }).catch(() => {});
      setSubmissionsState([]);
      refreshJobs();
      // Load submissions after login
      if (account.role === "company") api.listCompanySubmissions().then((s) => setSubmissionsState(s.map(apiSubToSub))).catch(() => {});
      else if (account.role === "worker") api.listMySubmissions().then((s) => setSubmissionsState(s.map(apiSubToSub))).catch(() => {});
      setPage(account.role === "company" ? "company-dashboard" : "worker-dashboard");
      return null;
    } catch (e: unknown) { return e instanceof Error ? e.message : "Login failed"; }
  };

  const loginAdmin = async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await api.login({ email, password });
      if (res.user.role !== "admin") return "Not an admin account";
      api.saveToken(res.token);
      const account = apiUserToAccount(res.user);
      setUser(account); setRole("admin");
      setPage("admin-dashboard");
      return null;
    } catch (e: unknown) { return e instanceof Error ? e.message : "Admin login failed"; }
  };

  const logout = () => {
    api.clearToken();
    setUser(null); setRole(null); setPage("landing");
    setBookedJobIds([]); setSelectedJobId(null); setPendingEmail(null);
    setSubmissionsState([]);
  };

  const bookJob = async (jobId: number): Promise<string | null> => {
    if (!user || bookedJobIds.includes(jobId)) return null;
    try {
      const booked = await api.bookJob(jobId);
      const newBooked = [...bookedJobIds, jobId];
      setBookedJobIds(newBooked); saveBookings(user.email, newBooked);
      setJobs((prev) => prev.map((j) => j.id === jobId ? booked : j));
      return null;
    } catch (e: unknown) {
      refreshJobs();
      return e instanceof Error ? e.message : "Booking failed";
    }
  };
  const openJobDetail = (jobId: number) => { setSelectedJobId(jobId); setPage("worker-job-detail"); };

  const submitWork = async (jobId: number, github: string, demo: string, attachments: api.ApiSubmission["attachments"] = []): Promise<{ submission?: Submission; error?: string }> => {
    try {
      const created = await api.submitWork(jobId, github, demo, attachments);
      const submission = apiSubToSub(created);
      setSubmissionsState((prev) => [...prev, submission]);
      await Promise.all([refreshJobs(), refreshSubmissions()]);
      return { submission };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Submission failed" };
    }
  };

  const updateSubmission = (submissionId: number, patch: Partial<Submission>) => {
    setSubmissionsState((prev) => prev.map((s) => s.id === submissionId ? { ...s, ...patch } : s));
  };

  const reviewSubmission = async (id: number, status: "accepted" | "rejected", feedback: string, rating: number, restoreSlot = false): Promise<string | null> => {
    try {
      const updated = await api.reviewSubmission(id, status, feedback, rating, restoreSlot);
      setSubmissionsState((prev) => prev.map((s) => s.id === id ? apiSubToSub(updated) : s));
      await Promise.all([refreshJobs(), refreshSubmissions()]);
      return null;
    } catch (e: unknown) { return e instanceof Error ? e.message : "Review failed"; }
  };

  const distributeRewards = async (jobId: number, awards: api.DistributeAward[], winnerId: number): Promise<string | null> => {
    try {
      await api.distributeRewards(jobId, awards, winnerId);
      await Promise.all([refreshJobs(), refreshSubmissions(), refreshMe()]);
      return null;
    } catch (e: unknown) { return e instanceof Error ? e.message : "Reward distribution failed"; }
  };

  const deleteJob = async (jobId: number): Promise<string | null> => {
    try {
      await api.deleteJob(jobId);
      setJobsState((prev) => prev.filter((j) => j.id !== jobId));
      setSubmissionsState((prev) => prev.filter((s) => s.jobId !== jobId));
      return null;
    } catch (e: unknown) { return e instanceof Error ? e.message : "Failed to delete task"; }
  };
  const awardWorker = (workerEmail: string, pointsToAdd: number, tkToAdd: number) => {
    const all = loadAllWorkerStats();
    const cur = all[workerEmail] ?? { points: 0, tasksDone: 0, walletTk: 0 };
    all[workerEmail] = { points: cur.points + pointsToAdd, tasksDone: cur.tasksDone + (pointsToAdd > 0 ? 1 : 0), walletTk: cur.walletTk + tkToAdd };
    saveAllWorkerStats(all);
    if (user && user.email === workerEmail) setUser((prev) => prev ? { ...prev, points: all[workerEmail].points } : prev);
  };
  const getWorkerStats = (workerEmail: string): WorkerStats => {
    const all = loadAllWorkerStats();
    return all[workerEmail] ?? { points: 0, tasksDone: 0, walletTk: 0 };
  };
  const addJob = async (job: Omit<Job, "id" | "filled" | "submissions" | "status">): Promise<string | null> => {
    try {
      const created = await api.createJob({
      title: job.title, category: job.category, description: job.description, skills: job.skills,
      slots: job.slots, deadline: job.deadline, reward: job.reward, points: job.points,
      difficulty: job.difficulty, useAI: job.useAI, materials: job.materials,
      submissionFormats: job.submissionFormats,
      });
      setJobsState((prev) => [{ ...created }, ...prev]);
      await refreshJobs();
      return null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : "Failed to create task";
    }
  };
  const updateJob = (id: number, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...patch } : j));
    const body: api.JobPatchPayload = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.reward !== undefined) body.reward = patch.reward;
    if (patch.deadline !== undefined) body.deadline = patch.deadline;
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.materials !== undefined) body.materials = patch.materials;
    if (patch.submissionFormats !== undefined) body.submissionFormats = patch.submissionFormats;
    if (Object.keys(body).length > 0) {
      api.patchJob(id, body)
        .then((u) => { if (u) setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...u } : j))); })
        .catch(() => {});
    }
  };

  const state: AppState = {
    page, role, user, authMode, jobs, bookedJobIds, selectedJobId, submissions,
    pendingEmail, setPendingEmail, navigate, setRole, goAuth,
    registerUser, loginUser, loginAdmin, verifyEmail, resendCode, logout,
    addJob, updateJob, bookJob, openJobDetail, submitWork, updateSubmission,
    reviewSubmission, distributeRewards, deleteJob, refreshSubmissions, refreshBookings, refreshMe, updateProfile,
    awardWorker, getWorkerStats,
  };

  // Admin gets its own minimal layout
  if (page === "admin-dashboard") return <AdminDashboard onLogout={logout} />;
  if (page === "admin-login") return <AdminLoginPage state={state} onBack={() => setPage("landing")} />;

  if (page === "landing")             return <LandingPage state={state} />;
  if (page === "auth")                return <AuthPage state={state} />;
  if (page === "company-dashboard")   return <CompanyDashboard state={state} />;
  if (page === "company-create-job")  return <CreateJobPage state={state} />;
  if (page === "company-submissions") return <SubmissionsPage state={state} />;
  if (page === "company-evaluate")    return <EvaluateTaskPage state={state} />; // evaluate task
  if (page === "company-profile")     return <CompanyProfilePage state={state} />;
  if (page === "worker-dashboard")    return <WorkerDashboard state={state} />;
  if (page === "worker-job-detail")   return <JobDetailPage state={state} />;
  if (page === "worker-my-jobs")      return <MyJobsPage state={state} />;
  if (page === "worker-cv")           return <CVBuilderPage state={state} />;
  if (page === "worker-profile")      return <ProfilePage state={state} />;
  return null;
}
