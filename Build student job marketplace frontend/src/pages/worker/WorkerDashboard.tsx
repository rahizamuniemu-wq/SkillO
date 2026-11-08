import { useEffect, useState } from "react";
import { Search, Filter, Clock, Users, Trophy, Star } from "lucide-react";
import WorkerSidebar from "../../components/WorkerSidebar";
import { AppState } from "../../App";
import { toast } from "../../components/Toast";

const categories = ["All", "Frontend", "Backend", "Full Stack", "Mobile", "Data Science", "UI/UX Design", "DevOps", "Other"];

const diffColors: Record<string, string> = {
  Beginner:     "text-emerald-600 bg-emerald-50",
  Intermediate: "text-amber-600 bg-amber-50",
  Advanced:     "text-red-600 bg-red-50",
};

export default function WorkerDashboard({ state }: { state: AppState }) {
  const [cat, setCat]       = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void state.refreshSubmissions();
  }, []);

  const visibleJobs = state.jobs
    .filter((j) => j.status !== "closed")
    .filter((j) => {
      const matchCat    = cat === "All" || j.category === cat;
      const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.skills.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
        j.companyName.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });

  const openCount = state.jobs.filter((j) => j.status !== "closed" && j.filled < j.slots).length;
  const userPoints = state.user?.points ?? 0;
  const completedTaskIds = new Set(
    state.submissions
      .filter((submission) => submission.workerEmail === state.user?.email && submission.status === "accepted")
      .map((submission) => submission.jobId),
  );
  const tasksDone = completedTaskIds.size;

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <WorkerSidebar state={state} active="worker-dashboard" />

      <main className="flex-1 pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-7">
            <h1 className="font-display text-2xl sm:text-3xl text-[#1a1210]">Browse Tasks</h1>
            <p className="text-[#7a6560] text-sm mt-1">Find a task, book your slot, start building real experience.</p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-7">
            {[
              { label: "Open Tasks",  value: openCount.toString(),  sub: "Slots available", icon: Filter },
              { label: "Your Points", value: userPoints.toString(),  sub: userPoints > 0 ? "Keep earning" : "Start a task to earn", icon: Star },
              { label: "Tasks Done",  value: tasksDone.toString(),    sub: tasksDone > 0 ? "Accepted by companies" : "Complete a task to earn", icon: Trophy },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#e8ddd7] shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#ede0d0] flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-[#896558]" />
                  </div>
                  <div>
                    <p className="font-display text-2xl text-[#896558] leading-none">{s.value}</p>
                    <p className="text-xs font-semibold text-[#1a1210] mt-0.5">{s.label}</p>
                    <p className="text-xs text-[#7a6560]">{s.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7a6560]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, tech stack, or company..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e8ddd7] bg-white text-sm focus:outline-none focus:border-[#896558] transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${cat === c ? "bg-[#896558] text-white shadow-sm" : "bg-white text-[#7a6560] border border-[#e8ddd7] hover:border-[#c4a882]"}`}
              >
                {c}
              </button>
            ))}
          </div>

          {visibleJobs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-[#e8ddd7] text-center">
              <p className="font-display text-xl text-[#1a1210] mb-2">No tasks found</p>
              <p className="text-sm text-[#7a6560]">Try a different category or search term.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleJobs.map((job) => {
                const isFull   = job.filled >= job.slots;
                const isBooked = state.bookedJobIds.includes(job.id);
                const pct      = job.slots > 0 ? (job.filled / job.slots) * 100 : 0;
                return (
                  <div
                    key={job.id}
                    onClick={() => !(isFull || isBooked) && state.openJobDetail(job.id)}
                    className={`bg-white rounded-2xl p-5 border border-[#e8ddd7] transition-all ${
                      isFull || isBooked ? "opacity-60" : "hover:border-[#c4a882] hover:shadow-md cursor-pointer"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold text-[#896558] bg-[#ede0d0] px-2 py-0.5 rounded-full">{job.category}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diffColors[job.difficulty] ?? diffColors.Intermediate}`}>{job.difficulty}</span>
                          {isFull   && <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Slots Full</span>}
                          {isBooked && <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Booked ✓</span>}
                        </div>
                        <h3 className="font-semibold text-[#1a1210] mt-1.5 mb-0.5">{job.title}</h3>
                        <p className="text-sm text-[#7a6560] flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                          <span>{job.companyName}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> Due {job.deadline}</span>
                        </p>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {job.skills.map((t) => (
                            <span key={t} className="text-xs bg-[#f8f6f3] border border-[#e8ddd7] text-[#7a6560] px-2 py-0.5 rounded-lg">{t}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 bg-[#f5f0ec] rounded-full h-1.5">
                            <div className="bg-[#896558] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-[#7a6560] whitespace-nowrap flex items-center gap-1">
                            <Users size={11} /> {job.slots - job.filled} left
                          </span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-end gap-2 w-full sm:w-auto sm:flex-shrink-0">
                        <div className="text-right">
                          <p className="font-display text-2xl text-[#896558]">Tk {job.reward.toLocaleString()}</p>
                          <p className="text-xs text-[#7a6560]">top reward</p>
                          <p className="text-xs text-[#896558] font-semibold mt-0.5">+{job.points} pts</p>
                        </div>
                        <button
                          disabled={isFull || isBooked}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isFull && !isBooked) {
                              void state.bookJob(job.id).then((error) => {
                                if (error) {
                                  toast(error, "error");
                                  return;
                                }
                                state.navigate("worker-my-jobs");
                              });
                            }
                          }}
                          className={`mt-1 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                            isBooked
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                              : isFull
                              ? "bg-[#f5f0ec] text-[#7a6560] cursor-not-allowed"
                              : "bg-[#896558] text-white hover:bg-[#5c4039] shadow-sm"
                          }`}
                        >
                          {isBooked ? "Booked ✓" : isFull ? "Full" : "Book Slot"}
                        </button>
                      </div>
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