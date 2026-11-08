import { useState, useRef } from "react";
import { ArrowLeft, Plus, X, Sparkles, CheckSquare, BookOpen, Globe, FileText, Upload, Link, Cloud } from "lucide-react";
import CompanySidebar from "../../components/CompanySidebar";
import { AppState, JobMaterial } from "../../App";
import { toast } from "../../components/Toast";
import { uploadMaterialFile } from "../../lib/storage";
import * as api from "../../lib/api";

const categories = ["Frontend", "Backend", "Full Stack", "Mobile", "UI/UX Design", "Data Science", "DevOps", "Other"];
const difficulties = ["Beginner", "Intermediate", "Advanced"] as const;

const materialTypes = [
  { value: "doc",   label: "Doc",   Icon: BookOpen },
  { value: "video", label: "Video", Icon: Globe },
  { value: "file",  label: "File",  Icon: FileText },
];

type AddMode = "link" | "upload" | "drive";

const typeIcon = (type: string) => materialTypes.find((t) => t.value === type)?.Icon ?? BookOpen;
const sourceLabel = (m: JobMaterial) =>
  m.source === "upload" ? `Device upload${m.size ? ` · ${m.size}` : ""}` : m.source === "drive" ? "Google Drive" : m.url;

export default function CreateJobPage({ state }: { state: AppState }) {
  // Form fields
  const [title, setTitle]           = useState("");
  const [category, setCategory]     = useState(categories[0]);
  const [description, setDesc]      = useState("");
  const [skillsRaw, setSkillsRaw]   = useState("");
  const [deadline, setDeadline]     = useState("");
  const [slots, setSlots]           = useState(15);
  const [useAI, setUseAI]           = useState(true);
  const [reward, setReward]         = useState("");
  const [points, setPoints]         = useState("50");
  const [difficulty, setDifficulty] = useState<typeof difficulties[number]>("Intermediate");
  const [materials, setMaterials]   = useState<JobMaterial[]>([]);
  const [submissionFormats, setSubmissionFormats] = useState("");
  const [submitted, setSubmitted]   = useState(false);
  const [errors, setErrors]         = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<api.JobSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");

  // Add-material form
  const [addMode, setAddMode]     = useState<AddMode>("link");
  const [newType, setNewType]     = useState("doc");
  const [newLabel, setNewLabel]   = useState("");
  const [newUrl, setNewUrl]       = useState("");
  const [driveUrl, setDriveUrl]   = useState("");
  const [addError, setAddError]   = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateSuggestions = async () => {
    if (description.trim().length < 40) {
      setSuggestionError("Add at least 40 characters to the description so AI can make useful suggestions.");
      return;
    }
    setSuggesting(true);
    setSuggestionError("");
    try {
      setSuggestion(await api.suggestJobSettings({ title, category, description, materials }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI suggestions could not be generated.";
      setSuggestionError(message);
    } finally {
      setSuggesting(false);
    }
  };

  /* Suggestions are requested only when the user clicks the button. */
  const requestSuggestions = () => {
    void generateSuggestions();
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    setSkillsRaw(suggestion.skills.join(", "));
    setPoints(String(suggestion.points));
    setSubmissionFormats(suggestion.submissionFormats.join(", "));
    toast("AI suggestions applied. Review them before posting.", "success");
  };

  const addSuggestedResources = () => {
    if (!suggestion?.resources.length) return;
    setMaterials((current) => {
      const existing = new Set(current.map((material) => material.url));
      return [...current, ...suggestion.resources.filter((resource) => !existing.has(resource.url))];
    });
    toast("Suggested learning resources added.", "success");
  };

  const clearAddForm = () => { setNewLabel(""); setNewUrl(""); setDriveUrl(""); setAddError(""); };
  const removeMaterial = (i: number) => setMaterials(materials.filter((_, j) => j !== i));

  const addLink = () => {
    if (!newLabel.trim()) { setAddError("Please enter a label."); return; }
    if (!newUrl.trim())   { setAddError("Please enter a URL."); return; }
    setMaterials((p) => [...p, { type: newType, label: newLabel.trim(), url: newUrl.trim(), source: "link" }]);
    clearAddForm();
    toast("Link added.", "success");
  };

  const addDrive = () => {
    if (!newLabel.trim()) { setAddError("Please enter a label."); return; }
    if (!driveUrl.trim()) { setAddError("Please paste your Google Drive link."); return; }
    setMaterials((p) => [...p, { type: newType, label: newLabel.trim(), url: driveUrl.trim(), source: "drive" }]);
    clearAddForm();
    toast("Google Drive file added.", "success");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: JobMaterial[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const guessType = ["mp4", "mov", "webm", "avi"].includes(ext) ? "video" : "doc";
      try {
        const uploaded = await uploadMaterialFile(f);
        added.push(uploaded);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "File upload failed.");
      }
    }
    if (added.length === 0) return;
    setMaterials((p) => [...p, ...added]);
    toast(`${added.length} file${added.length > 1 ? "s" : ""} uploaded.`, "success");
  };

  const submit = async () => {
    const errs: string[] = [];
    if (!title.trim())    errs.push("Task title is required.");
    if (!description.trim()) errs.push("Description is required.");
    if (!deadline)        errs.push("Deadline is required.");
    if (!reward || Number(reward) <= 0) errs.push("Enter a valid reward amount.");
    if (errs.length) { setErrors(errs); return; }

    const error = await state.addJob({
      title: title.trim(),
      category,
      description: description.trim(),
      skills: skillsRaw.split(",").map((s) => s.trim()).filter(Boolean),
      slots,
      deadline,
      reward: Number(reward),
      points: Number(points) || 50,
      difficulty,
      companyName: state.user?.companyName ?? state.user?.firstName ?? "My Company",
      companyEmail: state.user?.email ?? "",
      useAI,
      materials,
      submissionFormats: submissionFormats.split(",").map((format) => format.trim().replace(/^\./, "").toLowerCase()).filter(Boolean),
    });

    if (error) {
      setErrors([error]);
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen bg-[#f8f6f3]">
        <CompanySidebar state={state} active="company-create-job" />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 rounded-full bg-[#ede0d0] flex items-center justify-center mx-auto mb-6">
              <CheckSquare size={34} className="text-[#896558]" />
            </div>
            <h2 className="font-display text-3xl text-[#1a1210] mb-3">Task is live!</h2>
            <p className="text-[#7a6560] text-sm mb-8 leading-relaxed">
              {useAI
                ? "Gemini AI will screen incoming applicants and fill your slots with the best candidates automatically."
                : "Candidates can start applying immediately. You will choose who fills your slots."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => state.navigate("company-dashboard")} className="flex-1 py-3 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#5c4039] transition-colors text-sm">
                View Dashboard
              </button>
              <button onClick={() => { setSubmitted(false); setTitle(""); setDesc(""); setSkillsRaw(""); setDeadline(""); setReward(""); setMaterials([]); setErrors([]); }} className="flex-1 py-3 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl hover:bg-white transition-colors text-sm">
                Post Another
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <CompanySidebar state={state} active="company-create-job" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => state.navigate("company-dashboard")} className="flex items-center gap-1.5 text-sm text-[#7a6560] hover:text-[#896558] mb-6 transition-colors">
            <ArrowLeft size={15} /> Back to Dashboard
          </button>

          <h1 className="font-display text-3xl text-[#1a1210] mb-1">Post a New Task</h1>
          <p className="text-[#7a6560] text-sm mb-7">Define requirements, attach learning resources, and set your slot limit.</p>

          {errors.length > 0 && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              {errors.map((e) => <p key={e} className="text-sm text-red-600">{e}</p>)}
            </div>
          )}

          <div className="space-y-5">
            {/* Task Info */}
            <Card title="Task Information">
              <Field label="Task Title *">
                <input value={title} onChange={(e) => setTitle(e.target.value)} type="text" placeholder="e.g. Build a Dashboard UI Component" className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors bg-white">
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulties[number])} className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors bg-white">
                    {difficulties.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Description *">
                <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Describe the deliverables, technical requirements, and acceptance criteria..." className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors resize-none" />
              </Field>
              <div className="bg-[#ede0d0] border border-[#c4a882] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#896558]" />
                    <p className="text-sm font-semibold text-[#5c4039]">AI task suggestions</p>
                  </div>
                  <button
                    type="button"
                    onClick={requestSuggestions}
                    disabled={suggesting}
                    className="px-3 py-2 bg-[#896558] text-white text-xs font-semibold rounded-lg disabled:opacity-60"
                  >
                    {suggesting ? "Analyzing..." : "Suggest skills, points & formats"}
                  </button>
                </div>
                <p className="text-xs text-[#5c4039]">
                  AI studies your task description and attached materials, then recommends required skills, points, submission formats, and learning resources.
                </p>
                {suggestionError && <p className="text-xs text-red-700">{suggestionError}</p>}
                {suggestion && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#5c4039]">{suggestion.rationale}</p>
                    <div className="text-xs text-[#5c4039] space-y-1">
                      <p><strong>Skills:</strong> {suggestion.skills.join(", ") || "No specific skills suggested"}</p>
                      <p><strong>Points:</strong> {suggestion.points}</p>
                      <p><strong>Submission formats:</strong> {suggestion.submissionFormats.join(", ") || "No specific format suggested"}</p>
                    </div>
                    {suggestion.resources.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#5c4039]">Learning resources</p>
                        {suggestion.resources.map((resource) => (
                          <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="block text-xs text-[#896558] hover:underline truncate">
                            {resource.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={applySuggestion} className="px-3 py-2 bg-[#896558] text-white text-xs font-semibold rounded-lg">
                        Apply settings
                      </button>
                      {suggestion.resources.length > 0 && (
                        <button type="button" onClick={addSuggestedResources} className="px-3 py-2 border border-[#896558] text-[#896558] text-xs font-semibold rounded-lg">
                          Add learning resources
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Field label="Required Skills (comma-separated)">
                <input value={skillsRaw} onChange={(e) => setSkillsRaw(e.target.value)} type="text" placeholder="React, TypeScript, Tailwind CSS" className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
              </Field>
            </Card>

            {/* Slots & Timeline */}
            <Card title="Slots & Timeline">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Submission Deadline *">
                  <input value={deadline} onChange={(e) => setDeadline(e.target.value)} type="date" className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors bg-white" />
                </Field>
                <Field label={`Participant Slots: ${slots}`}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSlots(Math.max(1, slots - 1))} className="w-10 h-10 rounded-xl border border-[#e8ddd7] flex items-center justify-center text-[#7a6560] hover:bg-white font-semibold text-lg transition-colors">−</button>
                    <span className="flex-1 text-center font-display text-3xl text-[#896558]">{slots}</span>
                    <button onClick={() => setSlots(Math.min(50, slots + 1))} className="w-10 h-10 rounded-xl border border-[#e8ddd7] flex items-center justify-center text-[#7a6560] hover:bg-white font-semibold text-lg transition-colors">+</button>
                  </div>
                </Field>
              </div>
              <button
                onClick={() => setUseAI(!useAI)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${useAI ? "border-[#896558] bg-white" : "border-[#e8ddd7] bg-white"}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${useAI ? "bg-[#896558]" : "bg-[#f5f0ec]"}`}>
                  <Sparkles size={18} className={useAI ? "text-white" : "text-[#7a6560]"} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1a1210] text-sm">Use Gemini AI to select candidates</p>
                  <p className="text-xs text-[#7a6560] mt-0.5">AI automatically screens and fills your {slots} slots with the best applicants</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-all flex-shrink-0 ${useAI ? "bg-[#896558]" : "bg-[#e8ddd7]"}`}>
                  <div className={`m-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${useAI ? "translate-x-5" : "translate-x-0"}`} />
                </div>
              </button>
            </Card>

            {/* Reward */}
            <Card title="Reward Structure">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cash Reward for Winner (Tk) *">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#7a6560]">Tk</span>
                    <input value={reward} onChange={(e) => setReward(e.target.value)} type="number" placeholder="5000" className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
                  </div>
                </Field>
                <Field label="Skill Points for All Valid Submissions">
                  <input value={points} onChange={(e) => setPoints(e.target.value)} type="number" placeholder="50" className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
                </Field>
              </div>
              <div className="bg-[#ede0d0] rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-[#5c4039] uppercase tracking-wider mb-2">How rewards work</p>
                <p className="text-sm text-[#5c4039] flex items-center gap-2"><span>🥇</span> Top winner: full cash (Tk) + bonus points + Featured Project badge</p>
                <p className="text-sm text-[#7a6560] flex items-center gap-2"><span>✅</span> All valid submissions: skill points + verified CV entry</p>
              </div>
            </Card>

            {/* Learning Materials */}
            <Card title="Learning Materials">
              <p className="text-xs text-[#7a6560] -mt-2 mb-4">Attach docs, videos, and files. Workers access these after booking a slot.</p>

              {materials.length > 0 && (
                <div className="space-y-2 mb-4">
                  {materials.map((m, i) => {
                    const TypeIcon = typeIcon(m.type);
                    return (
                      <div key={i} className="flex items-center gap-3 bg-[#f8f6f3] rounded-xl px-3 py-2.5 border border-[#e8ddd7]">
                        <div className="w-8 h-8 rounded-lg bg-[#ede0d0] flex items-center justify-center flex-shrink-0">
                          <TypeIcon size={14} className="text-[#896558]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1a1210] truncate">{m.label}</p>
                          <p className="text-xs text-[#7a6560] truncate">{sourceLabel(m)}</p>
                        </div>
                        <button onClick={() => removeMaterial(i)} className="text-[#7a6560] hover:text-red-500 transition-colors flex-shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border border-dashed border-[#c4a882] rounded-2xl overflow-hidden bg-white">
                {/* Mode tabs */}
                <div className="flex border-b border-[#f5f0ec]">
                  {([
                    { mode: "link"   as AddMode, Icon: Link,   label: "Paste Link"   },
                    { mode: "upload" as AddMode, Icon: Upload,  label: "Upload File"  },
                    { mode: "drive"  as AddMode, Icon: Cloud,   label: "Google Drive" },
                  ]).map(({ mode, Icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => { setAddMode(mode); setAddError(""); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${addMode === mode ? "bg-[#896558] text-white" : "text-[#7a6560] hover:bg-[#f8f6f3]"}`}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-3">
                  {addMode !== "upload" && (
                    <div className="flex gap-2">
                      {materialTypes.map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          onClick={() => setNewType(value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${newType === value ? "bg-[#896558] text-white border-[#896558]" : "bg-white text-[#7a6560] border-[#e8ddd7] hover:border-[#c4a882]"}`}
                        >
                          <Icon size={12} /> {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {addMode === "link" && (
                    <>
                      <input type="text" value={newLabel} onChange={(e) => { setNewLabel(e.target.value); setAddError(""); }} placeholder="Label — e.g. React Hooks Guide" className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
                      <div className="flex gap-2">
                        <input type="url" value={newUrl} onChange={(e) => { setNewUrl(e.target.value); setAddError(""); }} onKeyDown={(e) => e.key === "Enter" && addLink()} placeholder="https://docs.example.com/guide" className="flex-1 px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
                        <button onClick={addLink} className="px-4 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors flex items-center gap-1.5 flex-shrink-0">
                          <Plus size={15} /> Add
                        </button>
                      </div>
                    </>
                  )}

                  {addMode === "upload" && (
                    <>
                      <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.mp4,.mov,.webm,.png,.jpg,.jpeg,.zip" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none ${dragOver ? "border-[#896558] bg-[#faf8f6]" : "border-[#e8ddd7] hover:border-[#c4a882] hover:bg-[#faf8f6]"}`}
                      >
                        <div className="w-12 h-12 rounded-full bg-[#ede0d0] flex items-center justify-center">
                          <Upload size={22} className="text-[#896558]" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-[#1a1210]">Drop files here or click to browse</p>
                          <p className="text-xs text-[#7a6560] mt-1">PDF, Word, PPT, Excel, MP4, ZIP, Images</p>
                        </div>
                        <button type="button" className="px-5 py-2 bg-[#896558] text-white text-xs font-semibold rounded-xl hover:bg-[#5c4039] transition-colors" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                          Choose Files
                        </button>
                      </div>
                    </>
                  )}

                  {addMode === "drive" && (
                    <>
                      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <Cloud size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-700 leading-relaxed">Open your file in Google Drive, click <strong>Share → Copy link</strong>, and paste it below. Set access to <strong>Anyone with the link</strong>.</p>
                      </div>
                      <input type="text" value={newLabel} onChange={(e) => { setNewLabel(e.target.value); setAddError(""); }} placeholder="Label — e.g. Project Brief.pdf" className="w-full px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
                      <div className="flex gap-2">
                        <input type="url" value={driveUrl} onChange={(e) => { setDriveUrl(e.target.value); setAddError(""); }} onKeyDown={(e) => e.key === "Enter" && addDrive()} placeholder="https://drive.google.com/file/d/..." className="flex-1 px-4 py-2.5 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors" />
                        <button onClick={addDrive} className="px-4 py-2.5 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#5c4039] transition-colors flex items-center gap-1.5 flex-shrink-0">
                          <Plus size={15} /> Add
                        </button>
                      </div>
                    </>
                  )}

                  {addError && <p className="text-xs text-red-500">{addError}</p>}
                </div>
              </div>
            </Card>

            {/* Submission Requirements */}
            <Card title="Submission File Formats">
              <p className="text-xs text-[#7a6560] -mt-2 mb-3">Optional. List allowed extensions separated by commas, such as PDF, ZIP, PNG.</p>
              <input
                type="text"
                value={submissionFormats}
                onChange={(e) => setSubmissionFormats(e.target.value)}
                placeholder="PDF, ZIP, PNG"
                className="w-full px-4 py-3 rounded-xl border border-[#e8ddd7] text-sm focus:outline-none focus:border-[#896558] transition-colors"
              />
            </Card>

            <Card title="Submission Requirements">
              <div className="space-y-2.5">
                {[
                  { label: "GitHub Repository Link", required: true },
                  { label: "Live Demo URL", required: false },
                  { label: "Documentation / README", required: true },
                  { label: "Video walkthrough", required: false },
                ].map((r) => (
                  <label key={r.label} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked={r.required} className="w-4 h-4 accent-[#896558]" />
                    <span className="text-sm text-[#1a1210]">{r.label}</span>
                    {r.required && <span className="text-xs text-[#896558] font-semibold">Required</span>}
                  </label>
                ))}
              </div>
            </Card>

            <div className="flex gap-3 pb-8">
              <button onClick={() => state.navigate("company-dashboard")} className="flex-1 py-3.5 border border-[#e8ddd7] text-[#7a6560] font-semibold rounded-xl hover:bg-white transition-colors bg-[#f8f6f3]">
                Cancel
              </button>
              <button onClick={submit} className="flex-1 py-3.5 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#5c4039] transition-colors shadow-sm">
                Post Task →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#e8ddd7] shadow-sm space-y-4">
      <h3 className="font-semibold text-[#1a1210] pb-3 border-b border-[#f5f0ec]">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
