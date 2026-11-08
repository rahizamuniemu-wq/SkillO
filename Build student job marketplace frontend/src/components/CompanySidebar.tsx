import { LayoutDashboard, PlusCircle, ClipboardList, LogOut, Zap, Award, User, Menu, X } from "lucide-react";
import { useState } from "react";
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
  const [open, setOpen] = useState(false);
  const u = state.user;
  const myEmail     = u?.email ?? "";
  const displayName = u?.companyName ?? u?.firstName ?? "Company";
  const initials    = displayName.slice(0, 2).toUpperCase();

  const avatarUrl = avatarProp !== undefined
    ? avatarProp
    : loadAvatarFromStorage(myEmail);

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

  const SidebarContent = () => (
    <aside className="w-60 h-full bg-[#1a1210] flex flex-col">
      <div className="p-6 border-b border-white/10">
        <button onClick={() => { state.navigate("landing"); setOpen(false); }} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#896558] flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <span className="font-display text-xl text-white">SkillO</span>
        </button>

        <div className="mt-5 flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName}
              className="w-9 h-9 rounded-full object-cover border border-white/20 flex-shrink-0" />
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
              onClick={() => { state.navigate(item.page); setOpen(false); }}
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
          onClick={() => { state.logout(); setOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/8 transition-all"
        >
          <LogOut size={17} /> Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Mobile top bar (shown below lg) ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#1a1210] flex items-center justify-between px-4 border-b border-white/10">
        <button onClick={() => state.navigate("landing")} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#896558] flex items-center justify-center">
            <Zap size={13} className="text-white" fill="white" />
          </div>
          <span className="font-display text-lg text-white">SkillO</span>
        </button>
        <button onClick={() => setOpen(true)} className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors" aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>

      {/* ── Desktop static sidebar (hidden below lg) ── */}
      <div className="hidden lg:flex flex-col w-60 min-h-screen flex-shrink-0">
        <SidebarContent />
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-60 flex-shrink-0">
            <button onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label="Close menu">
              <X size={16} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
