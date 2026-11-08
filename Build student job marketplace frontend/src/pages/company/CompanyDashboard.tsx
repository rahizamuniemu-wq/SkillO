import { useState } from "react";
import { Plus, Sparkles, Users, Trophy, Clock, ChevronRight, CircleDot, X, Trash2 } from "lucide-react";
import CompanySidebar from "../../components/CompanySidebar";
import { AppState, Job } from "../../App";
import { toast } from "../../components/Toast";

const statusCfg: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  active: { label: "Active",    dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-200" },
  review: { label: "In Review", dot: "bg-amber-400",   text: "text-amber-700",  bg: "bg-amber-50 border border-amber-200" },
  approved: { label: "Approved", dot: "bg-blue-400", text: "text-blue-700", bg: "bg-blue-50 border border-blue-200" },
  closed: { label: "Closed",    dot: "bg-gray-400",    text: "text-gray-600",   bg: "bg-gray-50 border border-gray-200" },
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

function JobCard({ job, state, openEdit, closeTask, deleteTask }: {
  job: Job; state: AppState;
  openEdit:   (id: number) => void;
  closeTask:  (id: number) => void;
  deleteTask: (id: number) => void;
}) {
  const cfg = statusCfg[job.status] ?? statusCfg.active;
  const pendingReviews = state.submissions.filter((s) => s.jobId === job.id && s.status === "pending").length;
  const acceptedReviews = state.submissions.filter((s) => s.jobId === job.id && s.status === "accepted").length;
  const displayCfg = job.status === "review" && pendingReviews === 0 ? statusCfg.approved : cfg;
  const pct = job.slots > 0 ? (job.filled / job.slots) * 100 : 0;
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#e8ddd7] hover:border-[#c4a882] hover:shadow-sm transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h3 className="font-semibold text-[#1a1210]">{job.title}</h3>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${displayCfg.bg} ${displayCfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${displayCfg.dot}`} />{displayCfg.label}
            </span>
          </div>
          <p className="text-sm text-[#7a6560] mb-4">{job.category} · Deadline {job.deadline}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm mb-3">
            <span><span className="text-[#7a6560]">Slots </span><span className="font-semibold text-[#1a1210]">{job.filled}/{job.slots}</span></span>
            <span><span className="text-[#7a6560]">Reward </span><span className="font-semibold text-[#896558]">Tk {job.reward.toLocaleString()}</span></span>
            <span><span className="text-[#7a6560]">Submissions </span><span className="font-semibold text-[#1a1210]">{pendingReviews}</span></span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 bg-[#f5f0ec] rounded-full h-1.5">
              <div className="bg-[#896558] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-[#7a6560]">{Math.round(pct)}% full</span>
          </div>
        </div>
        <div className="flex flex-row sm:flex-col flex-wrap gap-2 sm:flex-shrink-0">
          {pendingReviews > 0 && (
            <button
              onClick={() => state.navigate("company-submissions")}
              className="flex items-center gap-1 px-4 py-2 bg-[#896558] text-white text-xs font-semibold rounded-lg hover:bg-[#5c4039] transition-colors"
            >
              Review ({pendingReviews}) <ChevronRight size={12} />
            </button>
          )}
          {pendingReviews === 0 && acceptedReviews > 0 && job.status !== "closed" && (
            <button
              onClick={() => state.navigate("company-evaluate")}
              className="flex items-center gap-1 px-4 py-2 bg-[#896558] text-white text-xs font-semibold rounded-lg hover:bg-[#5c4039] transition-colors"
            >
              Evaluate ({acceptedReviews}) <ChevronRight size={12} />
            </button>
          )}
          <button
            onClick={() => openEdit(job.id)}
            className="px-4 py-2 border border-[#e8ddd7] text-[#7a6560] text-xs font-medium rounded-lg hover:bg-[#faf8f6] transition-colors"
          >
            Edit Task
          </button>
          {job.status !== "closed" && (
            <button
              onClick={() => closeTask(job.id)}
              className="px-4 py-2 border border-amber-200 text-amber-600 text-xs font-medium rounded-lg hover:bg-amber-50 transition-colors"
            >
              Close Task
            </button>
          )}
          <button
            onClick={() => deleteTask(job.id)}
            className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDashboard({ state }: { state: AppState }) {
  const myEmail = state.user?.email ?? "";
  const myJobs  = state.jobs.filter((j) => !j.isDemo && j.companyEmail === myEmail);
  const myJobIds = new Set(myJobs.map((job) => job.id));
  const companySubmissions = state.submissions.filter((submission) => myJobIds.has(submission.jobId));
  const pendingByJob = (jobId: number) => companySubmissions.filter((submission) => submission.jobId === jobId && submission.status === "pending").length;
  const pendingReviews = companySubmissions.filter((submission) => submission.status === "pending").length;
  const activeTasks = myJobs.filter((job) => job.status !== "closed").length;

  const [editId, setEditId]             = useState<number | null>(null);
  const [editTitle, setEditTitle]       = useState("");
  const [editReward, setEditReward]     = useState(0);
  const [editDeadline, setEditDeadline] = useState("");
  const editJob = myJobs.find((j) => j.id === editId) ?? null;

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmDeleteJob = myJobs.find((j) => j.id === confirmDeleteId) ?? null;

  const openEdit = (id: number) => {
    const j = myJobs.find((j) => j.id === id);
    if (!j) return;
    setEditId(id); setEditTitle(j.title); setEditReward(j.reward); setEditDeadline(j.deadline);
  };

  const saveEdit = () => {
    if (editId == null) return;
    state.updateJob(editId, { title: editTitle, reward: editReward, deadline: editDeadline });
    setEditId(null);
    toast("Task updated successfully.", "success");
  };

  const closeTask = (id: number) => {
    state.updateJob(id, { status: "closed" });
    toast("Task closed. No new applications will be accepted.", "info");
  };

  const deleteTask = (id: number) => setConfirmDeleteId(id);

  const confirmDelete = async () => {
    if (confirmDeleteId == null) return;
    const err = await state.deleteJob(confirmDeleteId);
    setConfirmDeleteId(null);
    if (err) toast(err, "error");
    else toast("Task deleted.", "success");
  };

  const reviewJob = myJobs.find((j) => pendingByJob(j.id) > 0);
  const inReviewJobs = myJobs.filter((j) => pendingByJob(j.id) > 0).length;

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <CompanySidebar state={state} active="company-dashboard" />

      <main className="flex-1 pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <p className="text-xs text-[#7a6560] font-semibold uppercase tracking-wider mb-1">Company Dashboard</p>
              <h1 className="font-display text-2xl sm:text-3xl text-[#1a1210]">
                {getGreeting()}, {state.user?.companyName ?? state.user?.firstName ?? "there"}.
              </h1>
            </div>
            <button
              onClick={() => state.navigate("company-create-job")}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors shadow-sm self-start"
            >
              <Plus size={16} /> Post New Task
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { label: "Active Tasks",    value: activeTasks.toString(),                                           sub: `${inReviewJobs} in review`, icon: CircleDot, color: "text-emerald-600" },
              { label: "Total Applicants",value: myJobs.reduce((a, j) => a + j.filled, 0).toString(),          sub: "Across all tasks",     icon: Users,  color: "text-[#896558]" },
              { label: "Pending Reviews", value: pendingReviews.toString(),                                      sub: "Awaiting evaluation",  icon: Clock,  color: "text-amber-600" },
              { label: "Paid Out",        value: "Tk 0",                                                       sub: "No winners finalized", icon: Trophy, color: "text-[#896558]" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e8ddd7] shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-[#7a6560] font-medium">{s.label}</p>
                    <Icon size={16} className={s.color} />
                  </div>
                  <p className="font-display text-2xl sm:text-3xl text-[#1a1210]">{s.value}</p>
                  <p className="text-xs text-[#7a6560] mt-1">{s.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Banner when tasks have AI-reviewed submissions ready to evaluate */}
          {reviewJob && (
            <div className="bg-[#1a1210] rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#896558]/30 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={20} className="text-[#c4a882]" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Submissions Ready for Evaluation</p>
                  <p className="text-white/50 text-xs mt-0.5">
                    "{reviewJob.title}" has AI-reviewed submissions waiting — go to Evaluate Task to distribute rewards.
                  </p>
                </div>
              </div>
              <button
                onClick={() => state.navigate("company-submissions")}
                className="px-4 py-2.5 bg-[#896558] text-white text-xs font-semibold rounded-xl hover:bg-[#b08070] transition-colors flex-shrink-0"
              >
                Review Submissions →
              </button>
            </div>
          )}

          {/* Tasks list */}
          <div>
            <h2 className="font-semibold text-[#1a1210] mb-4">Your Tasks</h2>
            {myJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-[#e8ddd7] text-center">
                <p className="font-display text-xl text-[#1a1210] mb-2">No tasks yet</p>
                <p className="text-sm text-[#7a6560] mb-5">Post your first task to start receiving applications from students.</p>
                <button
                  onClick={() => state.navigate("company-create-job")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors shadow-sm"
                >
                  <Plus size={16} /> Post New Task
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myJobs.map((job) => (
                  <JobCard key={job.id} job={job} state={state} openEdit={openEdit} closeTask={closeTask} deleteTask={deleteTask} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {confirmDeleteJob && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-[#e8ddd7] z-10 p-6">
            <h2 className="font-semibold text-[#1a1210] mb-2">Delete Task?</h2>
            <p className="text-sm text-[#7a6560] mb-5">
              This will permanently delete{" "}
              <span className="font-semibold text-[#1a1210]">"{confirmDeleteJob.title}"</span>{" "}
              and all its submissions. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl text-sm hover:bg-[#faf8f6] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editJob && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[#e8ddd7] z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f0ec]">
              <h2 className="font-semibold text-[#1a1210]">Edit Task</h2>
              <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-lg hover:bg-[#f5f0ec] flex items-center justify-center text-[#7a6560]">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Task Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Reward (Tk)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#7a6560]">Tk</span>
                  <input
                    type="number"
                    value={editReward}
                    onChange={(e) => setEditReward(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Deadline</label>
                <input
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditId(null)} className="flex-1 py-3 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl hover:bg-[#faf8f6] transition-colors text-sm">Cancel</button>
                <button onClick={saveEdit} className="flex-1 py-3 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#5c4039] transition-colors text-sm">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
