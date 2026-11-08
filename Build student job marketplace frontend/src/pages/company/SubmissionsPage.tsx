import { useState, useEffect } from "react";
import {
  ArrowLeft, GitBranch, Globe, Star, X, Check,
  CheckCircle, Inbox, User, ThumbsDown, ThumbsUp, Award,
} from "lucide-react";
import CompanySidebar from "../../components/CompanySidebar";
import { AppState, Submission } from "../../App";
import { toast } from "../../components/Toast";
import * as api from "../../lib/api";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function WorkerCard({ worker }: { worker: api.ApiWorkerProfile }) {
  const skills = worker.skills ? worker.skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return (
    <div className="bg-[#f8f6f3] border border-[#e8ddd7] rounded-xl p-4 mb-3">
      <p className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <User size={11} /> Student Profile
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-2">
        <div><span className="text-[#7a6560] text-xs">Email</span><p className="text-[#1a1210] font-medium text-xs">{worker.email}</p></div>
        {worker.university && <div><span className="text-[#7a6560] text-xs">University</span><p className="text-[#1a1210] font-medium text-xs">{worker.university}</p></div>}
        {worker.department && <div><span className="text-[#7a6560] text-xs">Department</span><p className="text-[#1a1210] font-medium text-xs">{worker.department}</p></div>}
        <div><span className="text-[#7a6560] text-xs">Points on SkillO</span><p className="text-[#896558] font-bold text-xs">{worker.points}</p></div>
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {skills.map((s) => <span key={s} className="text-xs bg-white border border-[#e8ddd7] text-[#7a6560] px-2 py-0.5 rounded-lg">{s}</span>)}
        </div>
      )}
    </div>
  );
}

export default function SubmissionsPage({ state }: { state: AppState }) {
  const myEmail = state.user?.email ?? "";

  const myJobs = state.jobs.filter((j) => j.companyEmail === myEmail && j.submissions > 0);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(myJobs.length > 0 ? myJobs[0].id : null);

  useEffect(() => { state.refreshSubmissions(); }, []);

  const allSubs = state.submissions.filter((s) => s.companyEmail === myEmail);
  const visibleSubs = allSubs.filter((s) => s.jobId === selectedJobId);
  const selectedJob = state.jobs.find((j) => j.id === selectedJobId) ?? null;

  const [reviewTarget, setReviewTarget] = useState<{ sub: Submission; verdict: "accepted" | "rejected" } | null>(null);
  const [restoreSlot, setRestoreSlot] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);

  const acceptedCount = visibleSubs.filter((s) => s.status === "accepted").length;
  const pendingCount  = visibleSubs.filter((s) => s.status === "pending").length;
  const rejectedCount = visibleSubs.filter((s) => s.status === "rejected").length;
  const allSlotsAccepted = selectedJob ? acceptedCount >= selectedJob.slots : false;

  const submitReview = async () => {
    if (!reviewTarget) return;
    setReviewLoading(true);
    const err = await state.reviewSubmission(
      reviewTarget.sub.id, reviewTarget.verdict, reviewFeedback, reviewRating
      , reviewTarget.verdict === "rejected" && restoreSlot
    );
    setReviewLoading(false);
    if (err) { toast(err, "error"); return; }
    toast(
      reviewTarget.verdict === "accepted"
        ? "Submission accepted!"
        : restoreSlot ? "Submission rejected — slot restored and worker barred." : "Submission rejected — worker may resubmit.",
      reviewTarget.verdict === "accepted" ? "success" : "info"
    );
    setReviewTarget(null); setReviewFeedback(""); setReviewRating(0); setRestoreSlot(false);
  };

  // ── No submissions ──────────────────────────────────────────────────────────
  if (allSubs.length === 0) {
    return (
      <div className="flex min-h-screen bg-[#f8f6f3]">
        <CompanySidebar state={state} active="company-submissions" />
        <main className="flex-1 pt-14 lg:pt-0 flex items-center justify-center p-4 sm:p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#ede0d0] flex items-center justify-center mx-auto mb-5">
              <Inbox size={28} className="text-[#896558]" />
            </div>
            <p className="font-display text-2xl text-[#1a1210] mb-2">No submissions yet</p>
            <p className="text-sm text-[#7a6560] mb-6 leading-relaxed">
              Once students submit their work for your tasks, their submissions will appear here for review.
            </p>
            <button onClick={() => state.navigate("company-dashboard")}
              className="px-5 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors">
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Main review page ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <CompanySidebar state={state} active="company-submissions" />

      <main className="flex-1 pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => state.navigate("company-dashboard")}
            className="flex items-center gap-1.5 text-sm text-[#7a6560] hover:text-[#896558] mb-6 transition-colors">
            <ArrowLeft size={15} /> Back to Dashboard
          </button>

          {/* Job tabs */}
          {myJobs.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {myJobs.map((j) => (
                <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedJobId === j.id
                      ? "bg-[#896558] text-white border-[#896558]"
                      : "bg-white text-[#7a6560] border-[#e8ddd7] hover:border-[#c4a882]"
                  }`}>
                  {j.title} ({j.submissions})
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl text-[#1a1210]">Submissions Review</h1>
              <p className="text-[#7a6560] text-sm mt-1">
                {selectedJob?.title ?? "—"} · {visibleSubs.length} submission{visibleSubs.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="text-right text-xs text-[#7a6560]">
              <span className="text-emerald-600 font-semibold">{acceptedCount} accepted</span>
              {" · "}{pendingCount} pending{" · "}{rejectedCount} rejected
            </div>
          </div>

          {/* Banner: all slots accepted → go to Evaluate Task */}
          {allSlotsAccepted && selectedJob?.status !== "closed" && (
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#1a1210] rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">All {selectedJob?.slots} slots accepted!</p>
                  <p className="text-white/50 text-xs">Head to Evaluate Task to distribute points and select the winner.</p>
                </div>
              </div>
              <button
                onClick={() => state.navigate("company-evaluate")}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#896558] text-white text-xs font-semibold rounded-xl hover:bg-[#b08070] transition-colors flex-shrink-0"
              >
                <Award size={14} /> Evaluate Task →
              </button>
            </div>
          )}

          {/* Closed job notice */}
          {selectedJob?.status === "closed" && (
            <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle size={15} className="text-emerald-600 flex-shrink-0" />
              <p className="text-emerald-700 text-sm font-medium">
                This task has been evaluated and rewards have been distributed.
              </p>
            </div>
          )}

          {/* Submissions list */}
          <div className="space-y-4">
            {visibleSubs.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-[#e8ddd7] text-center">
                <p className="text-[#7a6560] text-sm">No submissions for this task yet.</p>
              </div>
            ) : visibleSubs.map((sub) => (
              <div key={sub.id} className={`bg-white rounded-2xl p-5 border-2 transition-all ${
                sub.status === "accepted" ? "border-emerald-200"
                : sub.status === "rejected" ? "border-red-100"
                : "border-[#e8ddd7]"
              }`}>
                {/* Status badge */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {sub.status === "accepted" && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <Check size={10} /> Accepted
                    </span>
                  )}
                  {sub.status === "rejected" && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                      <X size={10} /> Rejected — slot reopened
                    </span>
                  )}
                  {sub.status === "pending" && (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                      Pending Review
                    </span>
                  )}
                  <span className="text-xs text-[#7a6560] ml-auto">
                    {new Date(sub.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#ede0d0] flex items-center justify-center font-semibold text-[#896558] text-sm flex-shrink-0">
                    {initials(sub.workerName)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#1a1210] mb-0.5">{sub.workerName}</h3>

                    {sub.worker && <WorkerCard worker={sub.worker} />}

                    <div className="flex items-center gap-4 mb-3 text-xs flex-wrap">
                      <a href={sub.github.startsWith("http") ? sub.github : `https://${sub.github}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-[#896558] hover:underline font-medium">
                        <GitBranch size={12} /> {sub.github}
                      </a>
                      {sub.demo && (
                        <a href={sub.demo.startsWith("http") ? sub.demo : `https://${sub.demo}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-[#7a6560] hover:underline">
                          <Globe size={12} /> {sub.demo}
                        </a>
                      )}
                    </div>

                    {sub.feedback && (
                      <div className={`rounded-xl p-3 mb-3 ${sub.status === "accepted" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                        <p className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider mb-1">Your Feedback</p>
                        <p className="text-sm text-[#1a1210] leading-relaxed">{sub.feedback}</p>
                        {sub.rating > 0 && (
                          <div className="flex gap-0.5 mt-2">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} size={13} className={s <= sub.rating ? "text-[#896558] fill-[#896558]" : "text-[#e8ddd7]"} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Accept / Reject — only for pending submissions on non-closed jobs */}
                    {sub.status === "pending" && selectedJob?.status !== "closed" && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => { setReviewTarget({ sub, verdict: "accepted" }); setReviewFeedback(""); setReviewRating(0); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <ThumbsUp size={12} /> Accept
                        </button>
                        <button
                          onClick={() => { setReviewTarget({ sub, verdict: "rejected" }); setReviewFeedback(""); setReviewRating(0); setRestoreSlot(false); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <ThumbsDown size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Review Modal ──────────────────────────────────────────────────────── */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !reviewLoading && setReviewTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-[#e8ddd7] z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f0ec]">
              <h2 className="font-semibold text-[#1a1210]">
                {reviewTarget.verdict === "accepted" ? "Accept Submission" : "Reject Submission"}
              </h2>
              <button onClick={() => setReviewTarget(null)} disabled={reviewLoading}
                className="w-8 h-8 rounded-lg hover:bg-[#f5f0ec] flex items-center justify-center text-[#7a6560]">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#7a6560]">
                {reviewTarget.verdict === "accepted"
                  ? <>Accepting <span className="font-semibold text-[#1a1210]">{reviewTarget.sub.workerName}</span>'s submission.</>
                  : <>Rejecting <span className="font-semibold text-[#1a1210]">{reviewTarget.sub.workerName}</span>'s submission. Choose whether to restore the slot and permanently bar re-booking.</>
                }
              </p>
              {reviewTarget.verdict === "accepted" && (
                <div>
                  <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Rating</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((s) => (
                      <button key={s} onClick={() => setReviewRating(s)} className="transition-transform hover:scale-110">
                        <Star size={26} className={s <= reviewRating ? "text-[#896558] fill-[#896558]" : "text-[#e8ddd7]"} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">
                  Feedback {reviewTarget.verdict === "accepted" ? "(optional)" : "(required)"}
                </label>
                {reviewTarget.verdict === "rejected" && (
                  <label className="flex items-start gap-2 text-sm text-[#7a6560]">
                    <input type="checkbox" checked={restoreSlot} onChange={(e) => setRestoreSlot(e.target.checked)} className="mt-0.5 accent-[#896558]" />
                    <span><strong className="text-[#1a1210]">Restore slot and bar worker from re-booking</strong><br /><span className="text-xs">The worker will not be able to book or resubmit for this task.</span></span>
                  </label>
                )}
                <textarea rows={3} value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder={reviewTarget.verdict === "accepted" ? "Great work on the architecture..." : "The submission was incomplete because..."}
                  className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setReviewTarget(null)} disabled={reviewLoading}
                  className="flex-1 py-2.5 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl text-sm hover:bg-[#faf8f6] transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={submitReview}
                  disabled={reviewLoading || (reviewTarget.verdict === "rejected" && !reviewFeedback.trim())}
                  className={`flex-1 py-2.5 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                    reviewTarget.verdict === "accepted"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }`}>
                  {reviewLoading ? "Saving..."
                    : reviewTarget.verdict === "accepted"
                    ? <><Check size={14} /> Confirm Accept</>
                    : <><X size={14} /> Confirm Reject</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
