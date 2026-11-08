import { useState, useEffect } from "react";
import {
  ArrowLeft, Trophy, Award, CheckCircle, GitBranch, Globe,
  Star, User, ClipboardCheck, Inbox, X, Sparkles, ThumbsDown,
} from "lucide-react";
import CompanySidebar from "../../components/CompanySidebar";
import { AppState, Submission, Job } from "../../App";
import { toast } from "../../components/Toast";
import * as api from "../../lib/api";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function WorkerCard({ worker }: { worker: api.ApiWorkerProfile }) {
  const skills = worker.skills ? worker.skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return (
    <div className="bg-[#f8f6f3] border border-[#e8ddd7] rounded-xl p-3 mb-3">
      <p className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <User size={11} /> Student Profile
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mb-2">
        <div><p className="text-[#7a6560] text-xs">Email</p><p className="text-[#1a1210] font-medium text-xs truncate">{worker.email}</p></div>
        {worker.university && <div><p className="text-[#7a6560] text-xs">University</p><p className="text-[#1a1210] font-medium text-xs">{worker.university}</p></div>}
        {worker.department && <div><p className="text-[#7a6560] text-xs">Department</p><p className="text-[#1a1210] font-medium text-xs">{worker.department}</p></div>}
        <div><p className="text-[#7a6560] text-xs">SkillO Points</p><p className="text-[#896558] font-bold text-xs">{worker.points}</p></div>
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.map((s) => (
            <span key={s} className="text-xs bg-white border border-[#e8ddd7] text-[#7a6560] px-2 py-0.5 rounded-lg">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EvaluateTaskPage({ state }: { state: AppState }) {
  const myEmail = state.user?.email ?? "";

  // Jobs with company-approved submissions ready for reward distribution.
  const readyJobs: Job[] = state.jobs.filter((j) => {
    if (j.companyEmail !== myEmail || j.status === "closed") return false;
    const accepted = state.submissions.filter((s) => s.jobId === j.id && s.status === "accepted").length;
    return accepted > 0;
  });

  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    readyJobs.length > 0 ? readyJobs[0].id : null
  );

  // Reload submissions when the page mounts so data is fresh
  useEffect(() => { state.refreshSubmissions(); }, []);

  const selectedJob = state.jobs.find((j) => j.id === selectedJobId) ?? null;
  const acceptedSubs: Submission[] = state.submissions.filter(
    (s) => s.jobId === selectedJobId && s.status === "accepted"
  );

  // Per-submission form state
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [pointsMap, setPointsMap] = useState<Record<number, number>>({});
  const [feedbackMap, setFeedbackMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ratingMap, setRatingMap] = useState<Record<number, number>>({});

  // Company reject from evaluate
  const [rejectTarget, setRejectTarget] = useState<Submission | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [restoreSlot, setRestoreSlot] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  // Reset form when job changes
  useEffect(() => {
    setWinnerId(null);
    setPointsMap({});
    setFeedbackMap({});
    setRatingMap({});
    setDone(false);
  }, [selectedJobId]);

  const getPoints = (id: number) =>
    pointsMap[id] !== undefined ? pointsMap[id] : (selectedJob?.points ?? 50);

  const handleDistribute = async () => {
    if (!selectedJob) return;
    if (!winnerId) { toast("Please select a winner.", "error"); return; }
    if (acceptedSubs.length === 0) { toast("No accepted submissions to distribute.", "error"); return; }

    const awards: api.DistributeAward[] = acceptedSubs.map((s) => ({
      submissionId: s.id,
      points: getPoints(s.id),
      rating: ratingMap[s.id] ?? 0,
      feedback: feedbackMap[s.id] ?? "",
    }));

    setLoading(true);
    const err = await state.distributeRewards(selectedJob.id, awards, winnerId);
    setLoading(false);

    if (err) { toast(err, "error"); return; }
    toast("Rewards distributed! Students have been awarded their points.", "success");
    setDone(true);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectFeedback.trim()) { toast("Please provide a reason for rejection.", "error"); return; }
    setRejectLoading(true);
    const err = await state.reviewSubmission(rejectTarget.id, "rejected", rejectFeedback, 0, restoreSlot);
    setRejectLoading(false);
    if (err) { toast(err, "error"); return; }
    toast(restoreSlot ? "Submission permanently rejected — slot restored." : "Submission rejected — worker may resubmit.", "info");
    setRejectTarget(null); setRejectFeedback(""); setRestoreSlot(false);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    const winner = acceptedSubs.find((s) => s.id === winnerId);
    return (
      <div className="flex min-h-screen bg-[#f8f6f3]">
        <CompanySidebar state={state} active="company-evaluate" />
        <main className="flex-1 pt-14 lg:pt-0 flex items-center justify-center p-4 sm:p-8">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 rounded-full bg-[#ede0d0] flex items-center justify-center mx-auto mb-6">
              <Trophy size={36} className="text-[#896558]" />
            </div>
            <h2 className="font-display text-3xl text-[#1a1210] mb-3">Rewards Distributed!</h2>
            <p className="text-[#7a6560] text-sm mb-2 leading-relaxed">
              Cash reward (Tk {selectedJob?.reward.toLocaleString()}) assigned to{" "}
              <span className="font-semibold text-[#896558]">{winner?.workerName}</span>.
            </p>
            <p className="text-[#7a6560] text-sm mb-8">
              Skill points have been added to all accepted students' profiles.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setDone(false); setSelectedJobId(readyJobs.find((j) => j.id !== selectedJobId)?.id ?? null); state.navigate("company-dashboard"); }}
                className="flex-1 py-3 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#5c4039] transition-colors text-sm"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => state.navigate("company-create-job")}
                className="flex-1 py-3 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl hover:bg-white transition-colors text-sm"
              >
                Post New Task
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── No tasks ready to evaluate ──────────────────────────────────────────────
  if (readyJobs.length === 0) {
    return (
      <div className="flex min-h-screen bg-[#f8f6f3]">
        <CompanySidebar state={state} active="company-evaluate" />
        <main className="flex-1 pt-14 lg:pt-0 flex items-center justify-center p-4 sm:p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#ede0d0] flex items-center justify-center mx-auto mb-5">
              <Inbox size={28} className="text-[#896558]" />
            </div>
            <p className="font-display text-2xl text-[#1a1210] mb-2">No tasks ready to evaluate</p>
            <p className="text-sm text-[#7a6560] mb-6 leading-relaxed">
              Tasks appear here once all their slots have been accepted in the Submissions section.
            </p>
            <button
              onClick={() => state.navigate("company-submissions")}
              className="px-5 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors"
            >
              Go to Submissions
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Main evaluate page ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <CompanySidebar state={state} active="company-evaluate" />

      <main className="flex-1 pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => state.navigate("company-dashboard")}
            className="flex items-center gap-1.5 text-sm text-[#7a6560] hover:text-[#896558] mb-6 transition-colors"
          >
            <ArrowLeft size={15} /> Back to Dashboard
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#896558] flex items-center justify-center flex-shrink-0">
              <Award size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-[#1a1210]">Evaluate Task</h1>
              <p className="text-sm text-[#7a6560]">All slots are filled — distribute points and select the winner</p>
            </div>
          </div>

          {/* Job selector */}
          {readyJobs.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {readyJobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJobId(j.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedJobId === j.id
                      ? "bg-[#896558] text-white border-[#896558]"
                      : "bg-white text-[#7a6560] border-[#e8ddd7] hover:border-[#c4a882]"
                  }`}
                >
                  {j.title}
                </button>
              ))}
            </div>
          )}

          {/* Info banner */}
          {selectedJob && (
            <div className="bg-[#1a1210] rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <Sparkles size={20} className="text-[#c4a882] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{selectedJob.title}</p>
                <p className="text-white/50 text-xs">
                  {acceptedSubs.length} AI-approved submission{acceptedSubs.length !== 1 ? "s" : ""} ·
                  AI auto-checked skill match · Cash prize: Tk {selectedJob.reward.toLocaleString()} · Default points: {selectedJob.points}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex-shrink-0">
                <CheckCircle size={12} /> AI reviewed
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
            <p className="font-semibold mb-1 flex items-center gap-2"><Trophy size={14} /> How to evaluate</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>These submissions passed AI skill-match review automatically.</li>
              <li>Review each student's work (GitHub / demo links below).</li>
              <li>You can still <strong>reject</strong> any submission — the slot reopens for others.</li>
              <li>Set skill points and optional feedback for each student you keep.</li>
              <li>Select ONE winner who receives the cash prize (Tk {selectedJob?.reward.toLocaleString()}).</li>
              <li>Click <strong>Confirm & Distribute</strong> — points are added to students' profiles immediately.</li>
            </ol>
          </div>

          {/* Submissions */}
          <div className="space-y-4 mb-6">
            {acceptedSubs.map((sub) => (
              <div
                key={sub.id}
                className={`bg-white rounded-2xl p-5 border-2 transition-all ${
                  winnerId === sub.id ? "border-amber-400 shadow-md" : "border-[#e8ddd7]"
                }`}
              >
                {/* Winner badge */}
                {winnerId === sub.id && (
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit mb-3">
                    <Trophy size={12} /> Winner — will receive Tk {selectedJob?.reward.toLocaleString()}
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#ede0d0] flex items-center justify-center font-semibold text-[#896558] text-sm flex-shrink-0">
                    {initials(sub.workerName)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#1a1210] mb-0.5">{sub.workerName}</h3>

                    {/* Student profile */}
                    {sub.worker && <WorkerCard worker={sub.worker} />}

                    {/* Work links */}
                    <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
                      <a
                        href={sub.github.startsWith("http") ? sub.github : `https://${sub.github}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-[#896558] hover:underline font-medium"
                      >
                        <GitBranch size={12} /> {sub.github}
                      </a>
                      {sub.demo && (
                        <a
                          href={sub.demo.startsWith("http") ? sub.demo : `https://${sub.demo}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-[#7a6560] hover:underline"
                        >
                          <Globe size={12} /> {sub.demo}
                        </a>
                      )}
                    </div>

                    {/* AI Note */}
                    {sub.aiNote && (
                      <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                        <Sparkles size={13} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-emerald-700 leading-relaxed">{sub.aiNote}</p>
                      </div>
                    )}

                    {/* Points + feedback inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1">
                          Skill Points
                        </label>
                        <input
                          type="number" min={0}
                          value={getPoints(sub.id)}
                          onChange={(e) => setPointsMap((p) => ({ ...p, [sub.id]: Number(e.target.value) }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1">
                          Rating
                        </label>
                        <div className="flex gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              onClick={() => setRatingMap((p) => ({ ...p, [sub.id]: s }))}
                              className="transition-transform hover:scale-110"
                            >
                              <Star
                                size={22}
                                className={s <= (ratingMap[sub.id] ?? 0) ? "text-[#896558] fill-[#896558]" : "text-[#e8ddd7]"}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1">
                        Feedback (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={feedbackMap[sub.id] ?? ""}
                        onChange={(e) => setFeedbackMap((p) => ({ ...p, [sub.id]: e.target.value }))}
                        placeholder="e.g. Great UI work, clean code structure..."
                        className="w-full px-3 py-2 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] resize-none"
                      />
                    </div>

                    {/* Select winner / Reject */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input
                          type="radio"
                          name="winner"
                          checked={winnerId === sub.id}
                          onChange={() => setWinnerId(sub.id)}
                          className="accent-[#896558]"
                        />
                        <span className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                          <Trophy size={14} /> Select as Winner (cash prize)
                        </span>
                      </label>
                      <button
                        onClick={() => { setRejectTarget(sub); setRejectFeedback(""); setRestoreSlot(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <ThumbsDown size={11} /> Reject (reopen slot)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Confirm button */}
          <button
            onClick={handleDistribute}
            disabled={!winnerId || loading}
            className="w-full py-4 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#5c4039] transition-all shadow-md text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? "Processing..."
              : <><CheckCircle size={18} /> Confirm & Distribute Rewards</>
            }
          </button>
        </div>
      </main>

      {/* ── Reject Modal ──────────────────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !rejectLoading && setRejectTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-[#e8ddd7] z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f0ec]">
              <h2 className="font-semibold text-[#1a1210]">Reject Submission</h2>
              <button onClick={() => setRejectTarget(null)} disabled={rejectLoading}
                className="w-8 h-8 rounded-lg hover:bg-[#f5f0ec] flex items-center justify-center text-[#7a6560]">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#7a6560]">
                Rejecting <span className="font-semibold text-[#1a1210]">{rejectTarget.workerName}</span>'s submission. Choose whether to restore the slot and permanently bar re-booking.
              </p>
              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Reason (required)</label>
                <label className="flex items-start gap-2 text-sm text-[#7a6560]">
                  <input type="checkbox" checked={restoreSlot} onChange={(e) => setRestoreSlot(e.target.checked)} className="mt-0.5 accent-[#896558]" />
                  <span><strong className="text-[#1a1210]">Restore slot and bar worker from re-booking</strong><br /><span className="text-xs">The worker will not be able to book or resubmit for this task.</span></span>
                </label>
                <textarea rows={3} value={rejectFeedback} onChange={(e) => setRejectFeedback(e.target.value)}
                  placeholder="The submission did not meet the quality standards because..."
                  className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRejectTarget(null)} disabled={rejectLoading}
                  className="flex-1 py-2.5 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl text-sm hover:bg-[#faf8f6] transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleReject} disabled={rejectLoading || !rejectFeedback.trim()}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {rejectLoading ? "Saving..." : <><X size={14} /> Confirm Reject</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
