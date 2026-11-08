import { useState, useEffect } from "react";
import { GitBranch, Globe, Clock, Sparkles, CheckCircle, AlertCircle, Star, Bookmark } from "lucide-react";
import WorkerSidebar from "../../components/WorkerSidebar";
import { AppState, Job } from "../../App";
import { toast } from "../../components/Toast";
import { uploadMaterialFile } from "../../lib/storage";

type TaskStatus = "in-progress" | "submitted" | "completed" | "locked";

interface TaskExtra {
  jobId: number;
  status: TaskStatus;
  github: string;
  demo: string;
  attachments: { name: string; url: string; type?: string }[];
}

const TASK_EXTRAS_KEY = "skillo_task_extras"; // { [email]: TaskExtra[] }

function loadExtras(email: string): Record<number, TaskExtra> {
  try {
    const all = JSON.parse(localStorage.getItem(TASK_EXTRAS_KEY) || "{}") as Record<string, Record<number, TaskExtra>>;
    return all[email] ?? {};
  } catch { return {}; }
}

function saveExtras(email: string, extras: Record<number, TaskExtra>) {
  try {
    const all = JSON.parse(localStorage.getItem(TASK_EXTRAS_KEY) || "{}") as Record<string, Record<number, TaskExtra>>;
    all[email] = extras;
    localStorage.setItem(TASK_EXTRAS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

// URL validators — GitHub must be a proper github.com/user/repo link.
// Demo URL must be a real public hostname (not localhost, not raw IP).
function isValidGitHubUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname === "github.com" && u.pathname.split("/").filter(Boolean).length >= 2;
  } catch { return false; }
}

function isValidDemoUrl(url: string): boolean {
  if (!url.trim()) return true; // demo is optional
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Must be a proper hostname with at least one dot (no localhost, no raw IPs)
    const host = u.hostname;
    return host.includes(".") && !host.startsWith("localhost") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  } catch { return false; }
}

const statusCfg = {
  "in-progress": { label: "In Progress",  icon: Clock,        cls: "text-amber-700 bg-amber-50 border-amber-200" },
  submitted:     { label: "Under Review",  icon: AlertCircle,  cls: "text-blue-700 bg-blue-50 border-blue-200" },
  completed:     { label: "Completed",     icon: CheckCircle,  cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  locked:        { label: "Permanently Rejected", icon: AlertCircle, cls: "text-red-700 bg-red-50 border-red-200" },
};

export default function MyJobsPage({ state }: { state: AppState }) {
  const email = state.user?.email ?? "";

  // Per-job local state (status, urls) – persisted per user email
  const [extras, setExtrasState] = useState<Record<number, TaskExtra>>(() => loadExtras(email));
  const [openSubmit, setOpenSubmit] = useState<number | null>(null);

  // Re-load when the logged-in user changes
  useEffect(() => {
    if (email) setExtrasState(loadExtras(email));
  }, [email]);

  // Refresh DB submissions when the page mounts
  useEffect(() => { state.refreshSubmissions?.(); state.refreshBookings?.(); }, []);

  const setExtras = (updater: Record<number, TaskExtra> | ((prev: Record<number, TaskExtra>) => Record<number, TaskExtra>)) => {
    setExtrasState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveExtras(email, next);
      return next;
    });
  };

  const getExtra = (jobId: number): TaskExtra =>
    extras[jobId] ?? { jobId, status: "in-progress", github: "", demo: "", attachments: [] };

  const patchExtra = (jobId: number, patch: Partial<TaskExtra>) =>
    setExtras((prev) => ({ ...prev, [jobId]: { ...getExtra(jobId), ...patch } }));

  // Derive booked jobs from shared state
  const bookedJobs: Job[] = state.bookedJobIds
    .map((id) => state.jobs.find((j) => j.id === id))
    .filter((j): j is Job => j !== undefined);

  // Merge in feedback/result from the DB submissions store
  const getSubmission = (jobId: number) =>
    state.submissions.slice().reverse().find((s) => s.jobId === jobId && s.workerEmail === email);

  const handleSubmit = async (jobId: number) => {
    const ex = getExtra(jobId);
    const github = ex.github.trim();
    const demo   = ex.demo.trim();

    // Validate GitHub link
    if (!github) {
      toast("Please enter your GitHub repository link.", "error");
      return;
    }
    if (!isValidGitHubUrl(github)) {
      toast("Please enter a valid GitHub link (e.g. https://github.com/username/repo).", "error");
      return;
    }
    // Validate demo link if provided
    if (demo && !isValidDemoUrl(demo)) {
      toast("Please enter a valid live demo URL (e.g. https://your-project.vercel.app).", "error");
      return;
    }

    setOpenSubmit(null);
    const result = await state.submitWork(jobId, github, demo, ex.attachments);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    const submission = result.submission;
    if (submission?.status === "rejected") {
      patchExtra(jobId, { status: "in-progress" });
      toast(submission.aiNote || "AI rejected this submission. Fix the issue and resubmit; your slot remains reserved.", "error");
    } else {
      patchExtra(jobId, { status: "submitted" });
      toast("Submitted! The company can now review your work.", "success");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <WorkerSidebar state={state} active="worker-my-jobs" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-3xl text-[#1a1210] mb-1">My Tasks</h1>
          <p className="text-[#7a6560] text-sm mb-7">Track active tasks, submit work, and view company feedback.</p>

          {bookedJobs.length === 0 ? (
            <div className="bg-white rounded-2xl p-14 border border-[#e8ddd7] text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#ede0d0] flex items-center justify-center mx-auto mb-4">
                <Bookmark size={26} className="text-[#896558]" />
              </div>
              <p className="font-display text-xl text-[#1a1210] mb-2">No tasks yet</p>
              <p className="text-sm text-[#7a6560] mb-6 max-w-xs mx-auto leading-relaxed">
                Browse available tasks, book a slot, and your active tasks will appear here.
              </p>
              <button
                onClick={() => state.navigate("worker-dashboard")}
                className="px-6 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors"
              >
                Browse Tasks →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookedJobs.map((job) => {
                const ex         = getExtra(job.id);
                const submission = getSubmission(job.id);

                // Derive displayed status from DB submission
                let displayStatus: TaskStatus = ex.status;
                if (submission) {
                  if (submission.status === "accepted") displayStatus = "completed";
                  else if (submission.status === "rejected" && !submission.restoreSlot) displayStatus = "in-progress";
                  else if (submission.status === "rejected") displayStatus = "locked";
                  else displayStatus = "submitted"; // accepted by AI, awaiting evaluation
                }

                const cfg  = statusCfg[displayStatus] ?? statusCfg["in-progress"];
                const Icon = cfg.icon;

                return (
                  <div key={job.id} className="bg-white rounded-2xl border border-[#e8ddd7] shadow-sm overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                            <h3 className="font-semibold text-[#1a1210]">{job.title}</h3>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                              <Icon size={10} />
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-sm text-[#7a6560] flex items-center gap-3">
                            <span>{job.companyName}</span>
                            <span className="flex items-center gap-1"><Clock size={12} /> {job.deadline}</span>
                          </p>
                          {job.skills.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap mt-2">
                              {job.skills.map((s) => (
                                <span key={s} className="text-xs bg-[#f8f6f3] border border-[#e8ddd7] text-[#7a6560] px-2 py-0.5 rounded-lg">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-display text-2xl text-[#896558]">Tk {job.reward.toLocaleString()}</p>
                          <p className="text-xs text-[#7a6560]">reward</p>
                          <p className="text-xs text-[#896558] font-semibold mt-0.5">+{job.points} pts</p>
                        </div>
                      </div>

                      {/* Company feedback once completed */}
                      {displayStatus === "completed" && submission?.feedback && (
                        <div className="mt-4 space-y-3">
                          {submission.isWinner && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2">
                              <span className="text-xl">🏆</span>
                              <div>
                                <p className="font-semibold text-amber-700 text-sm">You won!</p>
                                <p className="text-xs text-amber-600">You've been selected as the winner — cash prize incoming.</p>
                              </div>
                            </div>
                          )}
                          {(submission.pointsAwarded ?? 0) > 0 && (
                            <div className="bg-[#ede0d0] border border-[#c4a882] rounded-xl p-3.5 flex items-center gap-2">
                              <span className="text-xl">⭐</span>
                              <div>
                                <p className="font-semibold text-[#5c4039] text-sm">+{submission.pointsAwarded} Skill Points Awarded</p>
                                <p className="text-xs text-[#7a6560]">Added to your profile total.</p>
                              </div>
                            </div>
                          )}
                          <div className="bg-[#f8f6f3] border border-[#e8ddd7] rounded-xl p-3.5">
                            <p className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider mb-2">Company Feedback</p>
                            <p className="text-sm text-[#1a1210] leading-relaxed">{submission.feedback}</p>
                            {submission.rating > 0 && (
                              <div className="flex gap-0.5 mt-3">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} size={15} className={s <= submission.rating ? "text-[#896558] fill-[#896558]" : "text-[#e8ddd7]"} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Under review / AI accepted notice */}
                      {displayStatus === "submitted" && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3.5 py-3 border border-emerald-200">
                            ✅ Your submission passed AI skill review and is awaiting company evaluation.
                          </div>
                          {submission?.aiNote && (
                            <div className="flex items-start gap-2 bg-[#f8f6f3] rounded-xl px-3.5 py-3 border border-[#e8ddd7]">
                              <span className="text-xs">🤖</span>
                              <p className="text-xs text-[#7a6560] leading-relaxed">{submission.aiNote}</p>
                            </div>
                          )}
                          {submission && (
                            <div className="flex items-center gap-4 text-xs text-[#7a6560] px-1">
                              <a href={submission.github} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#896558] hover:underline font-medium">
                                <GitBranch size={11} /> {submission.github}
                              </a>
                              {submission.demo && (
                                <a href={submission.demo} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                                  <Globe size={11} /> {submission.demo}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rejected by AI or company — show reason, allow resubmit */}
                      {displayStatus === "in-progress" && submission?.status === "rejected" && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3.5 py-3 border border-red-200">
                            <span className="text-xs mt-0.5">🤖</span>
                            <div>
                              <p className="text-xs font-semibold text-red-700 mb-0.5">
                                {submission.feedback ? "Submission rejected by company — resubmission allowed" : "Submission rejected by AI — slot remains reserved"}
                              </p>
                              {submission.aiNote && <p className="text-xs text-red-600 leading-relaxed">{submission.aiNote}</p>}
                              {submission.feedback && <p className="text-xs text-red-600 leading-relaxed">{submission.feedback}</p>}
                            </div>
                          </div>
                        </div>
                      )}
                      {displayStatus === "locked" && submission && (
                        <div className="mt-4 flex items-start gap-2 bg-red-50 rounded-xl px-3.5 py-3 border border-red-200">
                          <span className="text-xs mt-0.5">🔒</span>
                          <div>
                            <p className="text-xs font-semibold text-red-700 mb-0.5">Task access closed — slot restored</p>
                            <p className="text-xs text-red-600 leading-relaxed">{submission.feedback || "You are barred from booking or resubmitting for this task."}</p>
                          </div>
                        </div>
                      )}
                      {openSubmit === job.id && (
                        <div className="mt-4 bg-[#f8f6f3] border border-[#e8ddd7] rounded-2xl p-5 space-y-3">
                          <h4 className="font-semibold text-[#1a1210] text-sm">Submit Your Work</h4>
                          <div>
                            <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">
                              GitHub Repository *
                            </label>
                            <div className="relative">
                              <GitBranch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6560]" />
                              <input
                                type="url"
                                value={ex.github}
                                onChange={(e) => patchExtra(job.id, { github: e.target.value })}
                                placeholder="https://github.com/username/repo"
                                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors bg-white ${
                                  ex.github.trim() && !isValidGitHubUrl(ex.github)
                                    ? "border-red-300 focus:border-red-400"
                                    : ex.github.trim() && isValidGitHubUrl(ex.github)
                                    ? "border-emerald-300 focus:border-emerald-400"
                                    : "border-[#e8ddd7] focus:border-[#896558]"
                                }`}
                              />
                            </div>
                            {ex.github.trim() && !isValidGitHubUrl(ex.github) && (
                              <p className="text-xs text-red-500 mt-1">
                                Must be a valid GitHub URL like https://github.com/username/repo
                              </p>
                            )}
                            {ex.github.trim() && isValidGitHubUrl(ex.github) && (
                              <p className="text-xs text-emerald-600 mt-1">✓ Valid GitHub link</p>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">
                              Live Demo URL <span className="text-white/40 font-normal">(optional)</span>
                            </label>
                            <div className="relative">
                              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6560]" />
                              <input
                                type="url"
                                value={ex.demo}
                                onChange={(e) => patchExtra(job.id, { demo: e.target.value })}
                                placeholder="https://your-project.vercel.app"
                                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors bg-white ${
                                  ex.demo.trim() && !isValidDemoUrl(ex.demo)
                                    ? "border-red-300 focus:border-red-400"
                                    : ex.demo.trim() && isValidDemoUrl(ex.demo)
                                    ? "border-emerald-300 focus:border-emerald-400"
                                    : "border-[#e8ddd7] focus:border-[#896558]"
                                }`}
                              />
                            </div>
                            {ex.demo.trim() && !isValidDemoUrl(ex.demo) && (
                              <p className="text-xs text-red-500 mt-1">
                                Must be a valid live URL (e.g. vercel.app, netlify.app, railway.app)
                              </p>
                            )}
                            {ex.demo.trim() && isValidDemoUrl(ex.demo) && (
                              <p className="text-xs text-emerald-600 mt-1">✓ Valid demo link</p>
                            )}
                          </div>
                          {job.useAI && (
                            <div className="flex items-start gap-2 bg-[#ede0d0] rounded-xl p-3">
                              <Sparkles size={13} className="text-[#5c4039] mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-[#5c4039] leading-relaxed">
                                AI will check your profile skills against the task requirements before the company sees it.
                              </p>
                            </div>
                          )}
                          <div>
                            <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">
                              Attachments {job.submissionFormats.length > 0 ? `(${job.submissionFormats.join(", ")})` : "(optional)"}
                            </label>
                            <input
                              type="file"
                              multiple
                              accept={job.submissionFormats.map((format) => `.${format}`).join(",")}
                              onChange={async (e) => {
                                const files = Array.from(e.target.files ?? []);
                                try {
                                  const uploaded = await Promise.all(files.map(uploadMaterialFile));
                                  patchExtra(job.id, {
                                    attachments: uploaded.map((file) => ({ name: file.label, url: file.url, type: file.type })),
                                  });
                                } catch (err) {
                                  toast(err instanceof Error ? err.message : "Attachment upload failed.", "error");
                                }
                                e.target.value = "";
                              }}
                              className="w-full text-sm text-[#7a6560]"
                            />
                            {ex.attachments.length > 0 && (
                              <p className="text-xs text-[#7a6560] mt-1">
                                {ex.attachments.length} file{ex.attachments.length === 1 ? "" : "s"} attached
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setOpenSubmit(null)}
                              className="flex-1 py-2.5 border border-[#e8ddd7] text-[#7a6560] text-sm font-semibold rounded-xl hover:bg-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSubmit(job.id)}
                              disabled={
                                !ex.github.trim() ||
                                !isValidGitHubUrl(ex.github) ||
                                (ex.demo.trim() !== "" && !isValidDemoUrl(ex.demo))
                              }
                              className="flex-1 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Submit Work →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Actions row */}
                      {displayStatus === "in-progress" && openSubmit !== job.id && (
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => state.openJobDetail(job.id)}
                            className="px-4 py-2 border border-[#e8ddd7] text-[#7a6560] text-xs font-medium rounded-lg hover:bg-[#f8f6f3] transition-colors"
                          >
                            View Materials
                          </button>
                          <button
                            onClick={() => setOpenSubmit(job.id)}
                            className="px-4 py-2 bg-[#896558] text-white text-xs font-semibold rounded-lg hover:bg-[#5c4039] transition-colors"
                          >
                            Submit Work →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
