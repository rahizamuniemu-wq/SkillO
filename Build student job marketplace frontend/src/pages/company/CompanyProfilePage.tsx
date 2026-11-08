import { useState, useRef, useEffect } from "react";
import { X, Camera, Building2, Mail, Briefcase, Globe } from "lucide-react";
import CompanySidebar from "../../components/CompanySidebar";
import { AppState } from "../../App";
import { toast } from "../../components/Toast";
import { uploadFile } from "../../lib/api";

const AVATAR_KEY = (email: string) => `skillo_avatar_${email}`;

function loadAvatar(email: string): string | null {
  try { return localStorage.getItem(AVATAR_KEY(email)); } catch { return null; }
}
function saveAvatar(email: string, dataUrl: string) {
  try { localStorage.setItem(AVATAR_KEY(email), dataUrl); } catch { /* storage full */ }
}

export default function CompanyProfilePage({ state }: { state: AppState }) {
  const u = state.user;
  const companyName = u?.companyName ?? u?.firstName ?? "Company";
  const industry    = u?.industry   ?? "";
  const email       = u?.email      ?? "";
  const initials    = companyName.slice(0, 2).toUpperCase();

  useEffect(() => { state.refreshMe?.(); }, []);

  // ── Avatar ──────────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => loadAvatar(email));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please select an image file.", "error"); return; }
    if (file.size > 3 * 1024 * 1024)    { toast("Image must be under 3 MB.", "error"); return; }
    try {
      const uploaded = await uploadFile(file);
      setAvatarUrl(uploaded.url);
      saveAvatar(email, uploaded.url);
      toast("Profile picture updated!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Profile picture upload failed.", "error");
    }
    e.target.value = "";
  };

  const removeAvatar = () => {
    setAvatarUrl(null);
    try { localStorage.removeItem(AVATAR_KEY(email)); } catch { /* ignored */ }
    toast("Profile picture removed.", "info");
  };

  // ── Edit modal ───────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen]     = useState(false);
  const [tempWebsite, setTempWebsite] = useState("");
  const [tempDesc, setTempDesc]     = useState("");

  useEffect(() => {
    setWebsite(u?.website ?? "");
    setDesc(u?.description ?? "");
  }, [u?.website, u?.description]);
  const [website, setWebsite]       = useState(u?.website ?? "");
  const [desc, setDesc]             = useState(u?.description ?? "");

  const openEdit = () => {
    setTempWebsite(website);
    setTempDesc(desc);
    setEditOpen(true);
  };
  const saveEdit = async () => {
    const error = await state.updateProfile({ website: tempWebsite, description: tempDesc });
    if (error) {
      toast(error, "error");
      return;
    }
    setWebsite(tempWebsite);
    setDesc(tempDesc);
    setEditOpen(false);
    toast("Profile updated.", "success");
  };

  // Stats from actual job data
  const myJobs      = state.jobs.filter((j) => j.companyEmail === email && !j.isDemo);
  const activeJobs  = myJobs.filter((j) => j.status !== "closed").length;
  const closedJobs  = myJobs.filter((j) => j.status === "closed").length;
  const totalSubs   = state.submissions.filter((s) => s.companyEmail === email).length;
  const totalSlotsFilled = myJobs.reduce((a, j) => a + j.filled, 0);

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <CompanySidebar state={state} active="company-profile" avatarUrl={avatarUrl} />

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />

      <main className="flex-1 pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-2xl sm:text-3xl text-[#1a1210] mb-7">Company Profile</h1>

          {/* Hero card */}
          <div className="bg-white rounded-2xl p-6 border border-[#e8ddd7] shadow-sm mb-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0 group cursor-pointer" onClick={handleAvatarClick}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={companyName}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-[#e8ddd7]" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-[#896558] flex items-center justify-center font-display text-3xl text-white select-none">
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={22} className="text-white" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#896558] border-2 border-white flex items-center justify-center shadow">
                  <Camera size={11} className="text-white" />
                </div>
              </div>

              <div className="flex-1">
                <h2 className="font-display text-2xl text-[#1a1210]">{companyName}</h2>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-[#7a6560]">
                  {industry && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} /> {industry}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} /> {email}
                  </span>
                  {website && (
                    <a href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-[#896558] hover:underline">
                      <Globe size={13} /> {website}
                    </a>
                  )}
                </div>
                {desc && <p className="text-sm text-[#1a1210] mt-3 leading-relaxed">{desc}</p>}
                {avatarUrl && (
                  <button onClick={removeAvatar} className="text-xs text-red-400 hover:text-red-600 mt-2 transition-colors">
                    Remove photo
                  </button>
                )}
              </div>

              <button onClick={openEdit}
                className="px-4 py-2 border border-[#e8ddd7] text-[#7a6560] text-xs font-semibold rounded-xl hover:bg-[#f8f6f3] transition-colors self-start sm:self-auto">
                Edit Profile
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-4">
              <Building2 size={11} className="text-[#c4a882]" />
              <p className="text-xs text-[#c4a882]">
                Click your logo to upload a profile picture (JPG, PNG — max 3 MB)
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Active Tasks",     value: activeJobs.toString() },
              { label: "Completed Tasks",  value: closedJobs.toString() },
              { label: "Total Submissions",value: totalSubs.toString() },
              { label: "Slots Filled",     value: totalSlotsFilled.toString() },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#e8ddd7] shadow-sm text-center">
                <p className="font-display text-2xl text-[#896558]">{s.value}</p>
                <p className="text-xs text-[#7a6560] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Recent tasks */}
          <div className="bg-white rounded-2xl p-5 border border-[#e8ddd7] shadow-sm">
            <h3 className="font-semibold text-[#1a1210] mb-4">Posted Tasks</h3>
            {myJobs.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={24} className="text-[#c4a882] mx-auto mb-3" />
                <p className="text-sm text-[#7a6560]">No tasks posted yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-4 py-2 border-b border-[#f5f0ec] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#1a1210]">{job.title}</p>
                      <p className="text-xs text-[#7a6560]">{job.category} · Deadline {job.deadline}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        job.status === "active"  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        job.status === "review"  ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-gray-50 text-gray-600 border border-gray-200"
                      }`}>
                        {job.status === "active" ? "Active" : job.status === "review" ? "In Review" : "Closed"}
                      </span>
                      <span className="text-xs text-[#7a6560]">{job.filled}/{job.slots} slots</span>
                    </div>
                  </div>
                ))}
                {myJobs.length > 5 && (
                  <button onClick={() => state.navigate("company-dashboard")}
                    className="text-xs text-[#896558] hover:underline mt-1">
                    View all {myJobs.length} tasks →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[#e8ddd7] z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f0ec]">
              <h2 className="font-semibold text-[#1a1210]">Edit Company Profile</h2>
              <button onClick={() => setEditOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#f5f0ec] flex items-center justify-center text-[#7a6560]">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Avatar in modal */}
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0 group cursor-pointer" onClick={handleAvatarClick}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={companyName} className="w-16 h-16 rounded-xl object-cover border-2 border-[#e8ddd7]" />
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
                  <p className="text-sm font-medium text-[#1a1210]">Company Logo</p>
                  <button onClick={handleAvatarClick} className="text-xs text-[#896558] hover:underline mt-0.5">
                    {avatarUrl ? "Change logo" : "Upload logo"}
                  </button>
                  {avatarUrl && (
                    <button onClick={removeAvatar} className="text-xs text-red-400 hover:text-red-600 ml-3">Remove</button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Company Name</label>
                <input type="text" value={companyName} disabled
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm bg-[#f8f6f3] text-[#7a6560] cursor-not-allowed" />
                <p className="text-xs text-[#c4a882] mt-1">Name is linked to your account and cannot be changed here.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Website (optional)</label>
                <input type="url" value={tempWebsite} onChange={(e) => setTempWebsite(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">Short Description (optional)</label>
                <textarea rows={3} value={tempDesc} onChange={(e) => setTempDesc(e.target.value)}
                  placeholder="Brief description of what your company does..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors resize-none" />
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
