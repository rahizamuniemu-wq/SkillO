import { LayoutDashboard, PlusCircle, ClipboardList, LogOut, Zap, Award, User } from "lucide-react";
import { AppState, Page } from "../App";

function loadAvatarFromStorage(email: string): string | null {
  try { return localStorage.getItem(`skillo_avatar_${email}`); } catch { return null; }
}

export default function CompanySidebar({
  state,
  active,
  avatarUrl: avatarProp,
}: {
  state: AppState;
  active: Page;
  avatarUrl?: string | null;
}) {
  const u = state.user;
  const myEmail     = u?.email ?? "";
  const displayName = u?.companyName ?? u?.firstName ?? "Company";
  const initials    = displayName.slice(0, 2).toUpperCase();

  // Use live prop if provided, else read from localStorage
  const avatarUrl = avatarProp !== undefined
    ? avatarProp
    : loadAvatarFromStorage(myEmail);

  // Count jobs that have all slots accepted and are ready to evaluate
  const evaluateCount = state.jobs.filter((j) => {
    if (j.companyEmail !== myEmail) return false;
    if (j.status === "closed") return false;
    const accepted = state.submissions.filter(
      (s) => s.jobId === j.id && s.status === "accepted"
    ).length;
    return accepted >= j.slots;
  }).length;

  const nav = [
    { icon: LayoutDashboard, label: "Dashboard",    page: "company-dashboard"   as Page, badge: 0 },
    { icon: PlusCircle,      label: "Post a Task",   page: "company-create-job"  as Page, badge: 0 },
    { icon: ClipboardList,   label: "Submissions",   page: "company-submissions" as Page, badge: 0 },
    { icon: Award,           label: "Evaluate Task", page: "company-evaluate"    as Page, badge: evaluateCount },
    { icon: User,            label: "Profile",       page: "company-profile"     as Page, badge: 0 },
  ];

  return (
    <aside className="w-60 min-h-screen bg-[#1a1210] flex flex-col">
      <div className="p-6 border-b border-white/10">
        <button onClick={() => state.navigate("landing")} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#896558] flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <span className="font-display text-xl text-white">SkillO</span>
        </button>

        <div className="mt-5 flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover border border-white/20 flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#896558] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-white/40">Company Account</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.page;
          return (
            <button
              key={item.page}
              onClick={() => state.navigate(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive ? "bg-[#896558] text-white" : "text-white/50 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon size={17} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge > 0 && (
                <span className="min-w-[20px] h-5 rounded-full bg-amber-400 text-[#1a1210] text-xs font-bold flex items-center justify-center px-1">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => state.logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/8 transition-all"
        >
          <LogOut size={17} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
