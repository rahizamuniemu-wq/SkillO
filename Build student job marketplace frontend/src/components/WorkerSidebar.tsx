import { Search, Bookmark, FileText, User, LogOut, Zap } from "lucide-react";
import { AppState, Page } from "../App";

const nav = [
  { icon: Search,   label: "Browse Tasks", page: "worker-dashboard" as Page },
  { icon: Bookmark, label: "My Tasks",      page: "worker-my-jobs"  as Page },
  { icon: FileText, label: "CV Builder",    page: "worker-cv"       as Page },
  { icon: User,     label: "Profile",       page: "worker-profile"  as Page },
];

function loadAvatarFromStorage(email: string): string | null {
  try { return localStorage.getItem(`skillo_avatar_${email}`); } catch { return null; }
}

export default function WorkerSidebar({
  state,
  active,
  avatarUrl: avatarProp,
}: {
  state: AppState;
  active: Page;
  avatarUrl?: string | null;
}) {
  const u = state.user;
  const displayName = u ? `${u.firstName} ${u.lastName}`.trim() : "My Account";
  const initials    = u ? `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase() : "?";

  // Use the live prop if provided (ProfilePage passes it after an upload),
  // otherwise fall back to whatever is stored in localStorage.
  const avatarUrl = avatarProp !== undefined
    ? avatarProp
    : loadAvatarFromStorage(u?.email ?? "");

  const eduDetails = [
    u?.university,
    u?.batch      ? `${u.batch} batch`           : "",
    u?.department ? `${u.department} department`  : "",
  ].filter(Boolean).join(", ");

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
            {eduDetails ? (
              <p className="text-xs text-white/50 truncate mt-0.5" title={eduDetails}>{eduDetails}</p>
            ) : (
              <p className="text-xs text-white/40 italic mt-0.5">Student Account</p>
            )}
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
              {item.label}
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
