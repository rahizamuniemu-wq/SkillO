import { ArrowLeft, Clock, Users, BookOpen, GitBranch, Globe, Lock, CheckCircle, Sparkles } from "lucide-react";
import WorkerSidebar from "../../components/WorkerSidebar";
import { AppState } from "../../App";
import { toast } from "../../components/Toast";

const typeIcons: Record<string, typeof BookOpen> = { doc: BookOpen, video: Globe, file: GitBranch };

const diffColors: Record<string, string> = {
  Beginner:     "text-emerald-600 bg-emerald-50 border-emerald-200",
  Intermediate: "text-amber-600 bg-amber-50 border-amber-200",
  Advanced:     "text-red-600 bg-red-50 border-red-200",
};

export default function JobDetailPage({ state }: { state: AppState }) {
  const job = state.jobs.find((j) => j.id === state.selectedJobId) ?? null;
  const isBooked = job ? state.bookedJobIds.includes(job.id) : false;

  if (!job) {
    return (
      <div className="flex min-h-screen bg-[#f8f6f3]">
        <WorkerSidebar state={state} active="worker-dashboard" />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="font-display text-2xl text-[#1a1210] mb-3">Task not found</p>
            <button
              onClick={() => state.navigate("worker-dashboard")}
              className="px-5 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors"
            >
              Back to Browse
            </button>
          </div>
        </main>
      </div>
    );
  }

  const slotsLeft = job.slots - job.filled;
  const pct       = job.slots > 0 ? (job.filled / job.slots) * 100 : 0;
  const isFull    = slotsLeft <= 0;

  const bookSlot = async () => {
    const error = await state.bookJob(job.id);
    if (error) {
      toast(error, "error");
      return;
    }
    toast("Slot reserved! Learning materials are now unlocked.", "success");
  };

  const openMaterial = (url: string, label: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    toast(`Opening: ${label}`, "info");
  };

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <WorkerSidebar state={state} active="worker-dashboard" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => state.navigate("worker-dashboard")}
            className="flex items-center gap-1.5 text-sm text-[#7a6560] hover:text-[#896558] mb-6 transition-colors"
          >
            <ArrowLeft size={15} /> Back to Browse
          </button>

          {/* Header card */}
          <div className="bg-white rounded-2xl p-6 border border-[#e8ddd7] shadow-sm mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#896558] bg-[#ede0d0] px-2 py-0.5 rounded-full">{job.category}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${diffColors[job.difficulty] ?? diffColors.Intermediate}`}>
                    {job.difficulty}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full capitalize">
                    {job.status}
                  </span>
                </div>
                <h1 className="font-display text-3xl text-[#1a1210] mb-1">{job.title}</h1>
                <p className="text-[#7a6560] text-sm">
                  Posted by <span className="font-semibold text-[#1a1210]">{job.companyName}</span>{job.industry ? <span className="text-[#7a6560]"> · {job.industry}</span> : null}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-display text-4xl text-[#896558]">Tk {job.reward.toLocaleString()}</p>
                <p className="text-xs text-[#7a6560]">winner reward</p>
                <p className="text-sm font-semibold text-[#896558] mt-1">+{job.points} skill points</p>
                <p className="text-xs text-[#7a6560]">for valid submissions</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#f5f0ec]">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-[#7a6560]" />
                <div>
                  <p className="text-xs text-[#7a6560]">Deadline</p>
                  <p className="font-semibold text-[#1a1210] text-sm">{job.deadline}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users size={15} className="text-[#7a6560]" />
                <div>
                  <p className="text-xs text-[#7a6560]">Slots</p>
                  <p className="font-semibold text-[#1a1210] text-sm">
                    {isFull ? "Full" : `${slotsLeft} remaining`}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#7a6560]">Difficulty</p>
                <p className={`font-semibold text-sm ${
                  job.difficulty === "Beginner" ? "text-emerald-600"
                  : job.difficulty === "Advanced" ? "text-red-600"
                  : "text-amber-600"
                }`}>{job.difficulty}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-[#7a6560] mb-1">
                <span>{job.filled} of {job.slots} slots filled</span>
                <span className="text-[#896558] font-semibold">{slotsLeft} left</span>
              </div>
              <div className="bg-[#f5f0ec] rounded-full h-2">
                <div className="bg-[#896558] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl p-6 border border-[#e8ddd7] shadow-sm mb-5">
            <h2 className="font-semibold text-[#1a1210] mb-3">Task Description</h2>
            <p className="text-sm text-[#7a6560] leading-relaxed">{job.description}</p>

            {job.skills.length > 0 && (
              <>
                <h3 className="font-semibold text-[#1a1210] text-sm mt-5 mb-3">Required Skills</h3>
                <div className="flex gap-1.5 flex-wrap">
                  {job.skills.map((s) => (
                    <span key={s} className="text-xs bg-white border border-[#e8ddd7] text-[#7a6560] px-3 py-1.5 rounded-lg">{s}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Learning Materials */}
          <div className="bg-white rounded-2xl p-6 border border-[#e8ddd7] shadow-sm mb-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-[#1a1210]">Learning Materials</h2>
              {!isBooked && (
                <span className="text-xs text-[#7a6560] flex items-center gap-1">
                  <Lock size={11} /> Unlock by booking a slot
                </span>
              )}
            </div>
            <p className="text-xs text-[#7a6560] mb-4">
              Docs, guides, and references provided by {job.companyName}.
            </p>

            {job.materials.length === 0 ? (
              <p className="text-xs text-[#c4a882] italic">No materials attached to this task.</p>
            ) : (
              <div className="space-y-2">
                {job.materials.map((m) => {
                  const Icon = typeIcons[m.type] ?? BookOpen;
                  return (
                    <button
                      key={m.label}
                      onClick={() => isBooked && openMaterial(m.url, m.label)}
                      disabled={!isBooked}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        isBooked
                          ? "border-[#e8ddd7] hover:border-[#c4a882] hover:shadow-sm cursor-pointer bg-white"
                          : "border-dashed border-[#e8ddd7] opacity-50 bg-[#f8f6f3] cursor-not-allowed"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#ede0d0] flex items-center justify-center flex-shrink-0">
                        <Icon size={14} className="text-[#896558]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1a1210]">{m.label}</p>
                        <p className="text-xs text-[#7a6560] capitalize">{m.source === "upload" ? `Upload${m.size ? ` · ${m.size}` : ""}` : m.source === "drive" ? "Google Drive" : m.url}</p>
                      </div>
                      {isBooked
                        ? <span className="text-xs font-semibold text-[#896558]">Open →</span>
                        : <Lock size={13} className="text-[#7a6560]" />
                      }
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submission requirements */}
          <div className="bg-white rounded-2xl p-6 border border-[#e8ddd7] shadow-sm mb-5">
            <h2 className="font-semibold text-[#1a1210] mb-3">Submission Requirements</h2>
            <div className="space-y-2">
              {[
                { label: "GitHub Repository Link", req: true },
                { label: "Live Demo URL",           req: false },
                { label: "README / Documentation", req: true },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle size={14} className={r.req ? "text-[#896558]" : "text-[#c4a882]"} />
                  <span className="text-[#1a1210]">{r.label}</span>
                  {r.req && <span className="text-xs text-[#896558] font-semibold">Required</span>}
                </div>
              ))}
            </div>
            {job.useAI && (
              <div className="mt-4 flex items-start gap-2.5 bg-[#ede0d0] rounded-xl p-3">
                <Sparkles size={14} className="text-[#5c4039] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[#5c4039] leading-relaxed">
                  Gemini AI will pre-check your submission for formatting, completeness, and code quality before it reaches the company reviewer.
                </p>
              </div>
            )}
          </div>

          {/* CTA */}
          {isBooked ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle size={22} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-700">Slot Reserved!</p>
                  <p className="text-xs text-emerald-600">
                    Materials are now unlocked. Submit your work before {job.deadline}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => state.navigate("worker-my-jobs")}
                className="w-full py-3.5 border-2 border-[#896558] text-[#896558] font-semibold rounded-xl hover:bg-[#faf8f6] transition-colors"
              >
                View My Tasks →
              </button>
            </div>
          ) : isFull ? (
            <div className="w-full py-4 bg-[#f5f0ec] text-[#7a6560] font-semibold rounded-xl text-center text-base cursor-not-allowed">
              All slots are full
            </div>
          ) : (
            <button
              onClick={bookSlot}
              className="w-full py-4 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#5c4039] transition-all shadow-md text-base"
            >
              Reserve My Slot — {slotsLeft} spot{slotsLeft !== 1 ? "s" : ""} left
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
