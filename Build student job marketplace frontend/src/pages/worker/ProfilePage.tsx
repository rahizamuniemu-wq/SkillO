import { useState, useEffect, useRef } from "react";
import { Zap, Clock, Star, ArrowRight, CheckCircle, X, Camera } from "lucide-react";
import WorkerSidebar from "../../components/WorkerSidebar";
import { AppState } from "../../App";
import { toast } from "../../components/Toast";
import { uploadFile } from "../../lib/api";

const AVATAR_KEY = (email: string) => `skillo_avatar_${email}`;

function loadAvatar(email: string): string | null {
  try { return localStorage.getItem(AVATAR_KEY(email)); } catch { return null; }
}
function saveAvatar(email: string, dataUrl: string) {
  try { localStorage.setItem(AVATAR_KEY(email), dataUrl); } catch { /* storage full — ignore */ }
}

export default function ProfilePage({ state }: { state: AppState }) {
  const u = state.user;
  const fullName = u ? `${u.firstName} ${u.lastName}`.trim() : "Your Name";
  const initials  = u ? `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase() : "?";
  const email     = u?.email ?? "your@email.com";

  // Points come from the DB via user.points — refreshed on mount
  const userPoints  = u?.points ?? 0;
  const workerStats = state.getWorkerStats(u?.email ?? "");
  const walletTk    = workerStats.walletTk;

  useEffect(() => {
    void state.refreshMe();
    void state.refreshSubmissions();
  }, []);

  const mySubmissions = state.submissions
    .filter((submission) => submission.workerEmail === email)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  const completedTaskIds = new Set(
    mySubmissions
      .filter((submission) => submission.status === "accepted")
      .map((submission) => submission.jobId),
  );
  const tasksDone = completedTaskIds.size;

  // ── Profile picture ──────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(() => loadAvatar(email));
  const fileInputRef                = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please select an image file.", "error"); return; }
    if (file.size > 3 * 1024 * 1024) { toast("Image must be under 3 MB.", "error"); return; }
    try {
      const uploaded = await uploadFile(file);
      setAvatarUrl(uploaded.url);
      saveAvatar(email, uploaded.url);
      toast("Profile picture updated!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Profile picture upload failed.", "error");
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const removeAvatar = () => {
    setAvatarUrl(null);
    try { localStorage.removeItem(AVATAR_KEY(email)); } catch { /* ignored */ }
    toast("Profile picture removed.", "info");
  };

  // ── Profile edit state ───────────────────────────────────────────────────────
  const [editOpen, setEditOpen]             = useState(false);
  const [editSkills, setEditSkills]         = useState(u?.skills ?? "");
  const [editUniversity, setEditUniversity] = useState(u?.university ?? "");
  const [editBatch, setEditBatch]           = useState(u?.batch ?? "");
  const [editDepartment, setEditDepartment] = useState(u?.department ?? "");

  const [tempSkills, setTempSkills]           = useState(editSkills);
  const [tempUniversity, setTempUniversity]   = useState(editUniversity);
  const [tempBatch, setTempBatch]             = useState(editBatch);
  const [tempDepartment, setTempDepartment]   = useState(editDepartment);

  useEffect(() => {
    setEditSkills(u?.skills ?? "");
    setEditUniversity(u?.university ?? "");
    setEditBatch(u?.batch ?? "");
    setEditDepartment(u?.department ?? "");
  }, [u?.skills, u?.university, u?.batch, u?.department]);

  const openEdit = () => {
    setTempSkills(editSkills);
    setTempUniversity(editUniversity);
    setTempBatch(editBatch);
    setTempDepartment(editDepartment);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const error = await state.updateProfile({ skills: tempSkills, university: tempUniversity, batch: tempBatch, department: tempDepartment });
    if (error) {
      toast(error, "error");
      return;
    }
    setEditSkills(tempSkills);
    setEditUniversity(tempUniversity);
    setEditBatch(tempBatch);
    setEditDepartment(tempDepartment);
    setEditOpen(false);
    toast("Profile updated successfully.", "success");
  };

  const academicParts = [editDepartment, editUniversity, editBatch ? `Batch ${editBatch}` : ""].filter(Boolean);
  const academicLine  = academicParts.join(" \u00B7 ");
  const skillList     = editSkills.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <WorkerSidebar state={state} active="worker-profile" avatarUrl={avatarUrl} />

      {/* Hidden file input for avatar upload */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-3xl text-[#1a1210] mb-7">My Profile</h1>

          {/* Profile hero */}
          <div className="bg-white rounded-2xl p-6 border border-[#e8ddd7] shadow-sm mb-5">
            <div className="flex items-start gap-5">
              {/* Avatar with upload overlay */}
              <div className="relative flex-shrink-0 group" onClick={handleAvatarClick} style={{ cursor: "pointer" }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-[#e8ddd7]"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-[#896558] flex items-center justify-center font-display text-3xl text-white select-none">
                    {initials}
                  </div>
                )}
                {/* Camera overlay on hover */}
                <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={22} className="text-white" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#896558] border-2 border-white flex items-center justify-center shadow">
                  <Camera size={11} className="text-white" />
                </div>
              </div>

              <div className="flex-1">
                <h2 className="font-display text-2xl text-[#1a1210]">{fullName}</h2>
                <p className="text-[#7a6560] text-sm mt-0.5">{email}</p>
                {academicLine && <p className="text-sm text-[#1a1210] mt-2">{academicLine}</p>}
                {skillList.length > 0 ? (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {skillList.map((s) => (
                      <span key={s} className="text-xs bg-[#ede0d0] text-[#5c4039] px-2.5 py-1 rounded-lg font-medium">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#c4a882] mt-3">No skills added yet — edit your profile to add them.</p>
                )}
                {/* Remove avatar link */}
                {avatarUrl && (
                  <button onClick={removeAvatar} className="text-xs text-red-400 hover:text-red-600 mt-2 transition-colors">
                    Remove photo
                  </button>
                )}
              </div>

              <button
                onClick={openEdit}
                className="px-4 py-2 border border-[#e8ddd7] text-[#7a6560] text-xs font-semibold rounded-xl hover:bg-[#f8f6f3] transition-colors"
              >
                Edit Profile
              </button>
            </div>

            {/* Upload hint */}
            <p className="text-xs text-[#c4a882] mt-4 text-center">
              Click your avatar to upload a profile picture (JPG, PNG — max 3 MB)
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: Star,        label: "Skill Points", value: userPoints > 0 ? userPoints.toString() : "—", color: "text-[#896558]" },
              { icon: CheckCircle, label: "Tasks Done",   value: tasksDone.toString(),                         color: "text-emerald-600" },
              { icon: Zap,         label: "Wallet",       value: "Tk 0",                                       color: "text-[#896558]" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#e8ddd7] shadow-sm text-center">
                  <Icon size={18} className={`${s.color} mx-auto mb-1.5`} />
                  <p className="font-display text-xl text-[#896558]">{s.value}</p>
                  <p className="text-xs text-[#7a6560] mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl p-5 border border-[#e8ddd7] shadow-sm mb-5">
            <h3 className="font-semibold text-[#1a1210] mb-4">Recent Activity</h3>
            {mySubmissions.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Clock size={24} className="text-[#c4a882] mb-3" />
                <p className="text-sm text-[#7a6560]">No activity yet. Submit work to see updates here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mySubmissions.slice(0, 5).map((submission) => {
                  const activityStatus = submission.status === "accepted"
                    ? "Task accepted by company"
                    : submission.status === "rejected"
                    ? submission.restoreSlot ? "Submission rejected and slot restored" : "Submission needs changes"
                    : "Submission awaiting company review";
                  const statusClass = submission.status === "accepted"
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : submission.status === "rejected"
                    ? "text-red-700 bg-red-50 border-red-200"
                    : "text-blue-700 bg-blue-50 border-blue-200";
                  return (
                    <div key={submission.id} className="flex items-center justify-between gap-3 border-b border-[#f5f0ec] pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1a1210] truncate">{submission.jobTitle || "Task submission"}</p>
                        <p className="text-xs text-[#7a6560] mt-0.5">
                          {Number.isNaN(Date.parse(submission.submittedAt)) ? "Recently updated" : new Date(submission.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusClass}`}>
                        {activityStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CV CTA */}
          <div className="bg-[#1a1210] rounded-2xl p-5 flex items-center justify-between text-white">
            <div>
              <p className="font-semibold">Build your AI CV</p>
              <p className="text-white/50 text-sm mt-0.5">Complete tasks to earn verified entries &middot; Powered by Gemini AI</p>
            </div>
            <button
              onClick={() => state.navigate("worker-cv")}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#b08070] transition-colors flex-shrink-0"
            >
              View CV <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#e8ddd7] z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f0ec]">
              <h2 className="font-semibold text-[#1a1210]">Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#f5f0ec] flex items-center justify-center text-[#7a6560]">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Avatar in modal */}
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0 group cursor-pointer" onClick={handleAvatarClick}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={fullName} className="w-16 h-16 rounded-xl object-cover border-2 border-[#e8ddd7]" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[#896558] flex items-center justify-center font-display text-2xl text-white select-none">
                      {initials}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={18} className="text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1a1210]">Profile Picture</p>
                  <button onClick={handleAvatarClick} className="text-xs text-[#896558] hover:underline mt-0.5">
                    {avatarUrl ? "Change photo" : "Upload photo"}
                  </button>
                  {avatarUrl && (
                    <button onClick={removeAvatar} className="text-xs text-red-400 hover:text-red-600 ml-3">
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Full Name</label>
                <input type="text" value={fullName} disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm bg-[#f8f6f3] text-[#7a6560] cursor-not-allowed" />
                <p className="text-xs text-[#c4a882] mt-1">Name is linked to your account and cannot be changed here.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">University / Institute</label>
                <input type="text" value={tempUniversity} onChange={(e) => setTempUniversity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
                  placeholder="e.g. CUET, Dhaka University" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Batch</label>
                  <input type="text" value={tempBatch} onChange={(e) => setTempBatch(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
                    placeholder="e.g. 20th" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Department</label>
                  <input type="text" value={tempDepartment} onChange={(e) => setTempDepartment(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
                    placeholder="e.g. CSE" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Skills (comma-separated)</label>
                <input type="text" value={tempSkills} onChange={(e) => setTempSkills(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
                  placeholder="React, Python, TypeScript, ..." />
                {tempSkills && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tempSkills.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                      <span key={s} className="text-xs bg-[#ede0d0] text-[#5c4039] px-2 py-0.5 rounded-lg">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl text-sm hover:bg-[#faf8f6] transition-colors">
                  Cancel
                </button>
                <button onClick={saveEdit} className="flex-1 py-2.5 bg-[#896558] text-white font-semibold rounded-xl text-sm hover:bg-[#5c4039] transition-colors">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
