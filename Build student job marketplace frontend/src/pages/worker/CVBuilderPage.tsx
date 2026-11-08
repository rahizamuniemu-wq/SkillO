import { useState, useEffect } from "react";
import {
  Sparkles, Download, CheckCircle, ArrowRight, FileText,
  Trophy, Star, Calendar, GitBranch,
} from "lucide-react";
import WorkerSidebar from "../../components/WorkerSidebar";
import { AppState, Submission } from "../../App";
import { toast } from "../../components/Toast";

// ── helpers ───────────────────────────────────────────────────────────────────

function isVerified(s: Submission) {
  return s.pointsAwarded > 0 || s.isWinner || s.status === "accepted";
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); }
  catch { return d; }
}

// ── PDF builder ───────────────────────────────────────────────────────────────
// Generates a standalone HTML string styled for A4 printing.
// The browser's "Save as PDF" print destination produces a clean, font-embedded PDF.
function buildPrintHTML(data: {
  fullName: string;
  email: string;
  githubHandle: string;
  university: string;
  department: string;
  batch: string;
  allSkills: string[];
  summary: string;
  verifiedProjects: Array<{
    jobTitle: string;
    companyName: string;
    category: string;
    date: string;
    skills: string[];
    isWinner: boolean;
    pointsAwarded: number;
    github: string;
    feedback: string;
    slots: number;
    bullet1: string;
    bullet2: string;
  }>;
  userPoints: number;
  winnerCount: number;
  tasksCompleted: number;
  generated: boolean;
  recommendations: string[];
}): string {
  const {
    fullName, email, githubHandle, university, department, batch,
    allSkills, summary, verifiedProjects, tasksCompleted, winnerCount,
    userPoints, generated, recommendations,
  } = data;

  const skillsHtml = allSkills.length > 0
    ? allSkills.map(s => `<span class="skill-tag">${s}</span>`).join("")
    : "<span class='muted'>No skills listed yet</span>";

  const projectsHtml = verifiedProjects.length > 0
    ? verifiedProjects.map((p) => `
      <div class="project">
        <div class="project-header">
          <div class="project-left">
            <div class="project-title">${p.jobTitle}${p.isWinner ? ' <span class="winner-badge">🏆 Winner</span>' : ""}</div>
            <div class="project-meta">${p.companyName} · ${p.category}${p.pointsAwarded > 0 ? ` · +${p.pointsAwarded} pts` : ""}</div>
          </div>
          <div class="project-date">${p.date}</div>
        </div>
        <ul class="bullets">
          <li>${p.bullet1}</li>
          ${p.bullet2 ? `<li>${p.bullet2}</li>` : ""}
          ${p.isWinner ? `<li>Selected as top submission out of ${p.slots} competing participants — awarded cash prize by company.</li>` : ""}
          ${p.feedback ? `<li class="feedback-item">Company feedback: "${p.feedback}"</li>` : ""}
        </ul>
        ${p.skills.length > 0 ? `<div class="skill-row">${p.skills.map(s => `<span class="skill-sm">${s}</span>`).join("")}</div>` : ""}
        ${p.github ? `<div class="github-link">&#9656; ${p.github}</div>` : ""}
      </div>`).join("")
    : `<p class="muted">No verified projects yet. Complete tasks on SkillO to add entries.</p>`;

  const eduHtml = (university || department) ? `
    <section>
      <h2 class="section-title">Education</h2>
      <div class="project">
        <div class="project-header">
          <div class="project-left">
            <div class="project-title">${department || "Computer Science"}</div>
            <div class="project-meta">${university}</div>
          </div>
          ${batch ? `<div class="project-date">Batch ${batch}</div>` : ""}
        </div>
      </div>
    </section>` : "";

  const recHtml = generated && recommendations.length > 0 ? `
    <section class="no-break">
      <h2 class="section-title">AI Career Recommendations</h2>
      <ul class="bullets">
        ${recommendations.map(r => `<li class="rec-item">${r}</li>`).join("")}
      </ul>
    </section>` : "";

  const verNote = tasksCompleted > 0 ? `
    <div class="verification-note">
      <strong>SkillO Verified:</strong> ${tasksCompleted} project${tasksCompleted > 1 ? "s" : ""} on this CV ${tasksCompleted > 1 ? "are" : "is"} verified by real companies through the SkillO platform. Each entry represents a genuine, peer-reviewed deliverable. Verify at <strong>skillo.app</strong>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CV — ${fullName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:18mm 18mm 18mm 18mm}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1a1210;background:#fff;line-height:1.5}
  .header{background:#1a1210;color:#fff;padding:22px 28px 18px;margin-bottom:0}
  .header h1{font-size:22pt;font-weight:700;letter-spacing:-0.5px;margin-bottom:4px}
  .header .subtitle{font-size:10pt;color:#c4a882;margin-bottom:8px}
  .header .contact{font-size:9pt;color:#a0968e;display:flex;flex-wrap:wrap;gap:16px}
  .header .contact span{display:inline-flex;align-items:center;gap:4px}
  .body{padding:20px 28px}
  section{margin-bottom:20px}
  .section-title{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#896558;border-bottom:1.5px solid #ede0d0;padding-bottom:5px;margin-bottom:12px}
  .summary-text{font-size:10.5pt;color:#1a1210;line-height:1.65}
  .project{margin-bottom:14px;padding-left:10px;border-left:2.5px solid #896558}
  .project-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
  .project-left{}
  .project-title{font-size:10.5pt;font-weight:700;color:#1a1210}
  .project-meta{font-size:9.5pt;color:#7a6560;margin-top:1px}
  .project-date{font-size:9pt;color:#7a6560;white-space:nowrap;flex-shrink:0;margin-left:10px;padding-top:1px}
  .bullets{margin:6px 0 6px 14px;padding:0}
  .bullets li{font-size:10pt;color:#1a1210;margin-bottom:3px;line-height:1.55}
  .feedback-item{color:#5c4039;font-style:italic}
  .rec-item{color:#7a6560}
  .winner-badge{font-size:8.5pt;font-weight:600;color:#b45309;background:#fef3c7;border-radius:4px;padding:1px 6px;margin-left:6px}
  .skill-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
  .skill-tag,.skill-sm{font-size:8.5pt;background:#f5f0ec;border:1px solid #e8ddd7;color:#5c4039;padding:2px 7px;border-radius:4px}
  .skills-wrap{display:flex;flex-wrap:wrap;gap:5px}
  .github-link{font-size:9pt;color:#896558;margin-top:4px}
  .muted{color:#9e8a85;font-size:10pt;font-style:italic}
  .stats-row{display:flex;gap:24px;margin-bottom:8px}
  .stat{text-align:center}
  .stat .val{font-size:16pt;font-weight:700;color:#896558}
  .stat .lbl{font-size:8pt;color:#7a6560}
  .verification-note{margin-top:20px;padding:10px 14px;background:#f5f0ec;border-left:3px solid #896558;font-size:9pt;color:#5c4039;line-height:1.5}
  .no-break{page-break-inside:avoid}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .header{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>

<div class="header">
  <h1>${fullName}</h1>
  ${allSkills.length > 0 ? `<div class="subtitle">${allSkills.slice(0,3).join(" · ")}${department ? ` · ${department}` : ""}</div>` : ""}
  <div class="contact">
    <span>${email}</span>
    <span>github.com/${githubHandle}</span>
    ${university ? `<span>${university}${batch ? `, Batch ${batch}` : ""}</span>` : ""}
    <span>SkillO Verified Profile</span>
  </div>
</div>

<div class="body">

  ${tasksCompleted > 0 ? `
  <div class="stats-row">
    <div class="stat"><div class="val">${tasksCompleted}</div><div class="lbl">Tasks Completed</div></div>
    <div class="stat"><div class="val">${userPoints}</div><div class="lbl">Skill Points</div></div>
    <div class="stat"><div class="val">${winnerCount}</div><div class="lbl">Task Wins</div></div>
  </div>` : ""}

  <section>
    <h2 class="section-title">Professional Summary</h2>
    <p class="summary-text">${summary}</p>
  </section>

  <section>
    <h2 class="section-title">Verified Project Experience</h2>
    ${projectsHtml}
  </section>

  ${eduHtml}

  ${allSkills.length > 0 ? `
  <section class="no-break">
    <h2 class="section-title">Technical Skills</h2>
    <div class="skills-wrap">${skillsHtml}</div>
  </section>` : ""}

  ${recHtml}

  ${verNote}

</div>
</body>
</html>`;
}

// ── printCV — opens the PDF HTML in a hidden iframe and triggers print ─────────
function printCV(html: string, fileName: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { toast("Could not open print window.", "error"); return; }
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow?.focus();
  // Small delay so fonts + styles load before print dialog opens
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* ignored */ } }, 2000);
    }
  }, 500);
  // Set suggested filename via document.title inside the iframe
  try { (doc as Document).title = fileName; } catch { /* ignored */ }
}

export default function CVBuilderPage({ state }: { state: AppState }) {
  const u = state.user;
  const fullName    = u ? `${u.firstName} ${u.lastName}`.trim() : "Your Name";
  const email       = u?.email ?? "your@email.com";
  const githubHandle = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const university  = u?.university ?? "";
  const department  = u?.department ?? "";
  const batch       = u?.batch ?? "";
  const userPoints  = u?.points ?? 0;

  const rawSkills   = u?.skills ?? "";
  const skillList   = rawSkills.split(",").map((s) => s.trim()).filter(Boolean);

  // Load worker's submissions on mount
  useEffect(() => { state.refreshSubmissions?.(); }, []);

  // All submissions belonging to this worker
  const workerEmail = u?.email ?? "";
  const mySubs = state.submissions.filter((s) => s.workerEmail === workerEmail);
  const verifiedProjects = mySubs.filter(isVerified);
  const tasksCompleted   = verifiedProjects.length;
  const winnerCount      = mySubs.filter((s) => s.isWinner).length;

  // Collect all unique skills from completed tasks (supplement profile skills)
  const taskSkills = Array.from(new Set(
    mySubs.flatMap((s) => {
      const job = state.jobs.find((j) => j.id === s.jobId);
      return job?.skills ?? [];
    })
  ));
  const allSkills = Array.from(new Set([...skillList, ...taskSkills]));

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState(false);

  // Always auto-show the CV if the worker already has data
  const hasData = tasksCompleted > 0 || userPoints > 0 || skillList.length > 0;
  useEffect(() => { if (hasData) setGenerated(true); }, [hasData]);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 1500);
  };

  // Build a rich AI summary
  const buildSummary = () => {
    const skillStr = allSkills.slice(0, 4).join(", ");
    const expStr   = tasksCompleted > 0
      ? `${tasksCompleted} verified real-world project${tasksCompleted > 1 ? "s" : ""} on SkillO`
      : "real-world projects on SkillO";
    const winStr   = winnerCount > 0 ? ` Won ${winnerCount} task competition${winnerCount > 1 ? "s" : ""}.` : "";
    const pointStr = userPoints > 0 ? ` Earned ${userPoints} skill points.` : "";
    const eduStr   = university ? ` Currently studying ${department ? `${department} at ` : "at "}${university}${batch ? `, Batch ${batch}` : ""}.` : "";
    const introSkill = skillStr
      ? `Results-driven developer proficient in ${skillStr}.`
      : "Motivated developer with hands-on industry experience.";
    return `${introSkill}${eduStr} Completed ${expStr} with real companies, demonstrating the ability to deliver production-quality work under professional requirements.${winStr}${pointStr} Seeking opportunities to apply practical skills in a collaborative environment.`;
  };

  // Build AI career recommendations based on actual data
  const buildRecommendations = () => {
    const recs: string[] = [];
    if (tasksCompleted === 0) {
      recs.push("Complete your first SkillO task to earn a verified project entry — it's the strongest thing you can put on a resume.");
    } else if (tasksCompleted < 3) {
      recs.push(`You have ${tasksCompleted} verified project${tasksCompleted > 1 ? "s" : ""}. Aim for 3–5 to make your resume competitive for junior roles.`);
    } else {
      recs.push(`With ${tasksCompleted} completed projects, you're ready to apply for junior positions. Highlight your best 2–3 on application cover letters.`);
    }
    if (winnerCount > 0) {
      recs.push(`You've won ${winnerCount} task competition${winnerCount > 1 ? "s" : ""} — mention this prominently. Winning a real company task shows you can outperform peers.`);
    }
    if (allSkills.length < 3) {
      recs.push("Add more skills to your profile to appear in more task searches and strengthen your Technical Skills section.");
    } else {
      const topSkill = allSkills[0];
      recs.push(`Your strongest skill appears to be ${topSkill}. Look for SkillO tasks in that area to build a focused, employer-ready portfolio.`);
    }
    if (!university) {
      recs.push("Add your university and department to your profile — recruiters look for this context when evaluating student developers.");
    }
    recs.push("Keep your GitHub active alongside SkillO tasks — having both demonstrates consistent, verifiable output to employers.");
    return recs;
  };

  // Build data object for PDF
  const buildPDFData = () => ({
    fullName, email, githubHandle, university, department, batch,
    allSkills,
    summary: buildSummary(),
    verifiedProjects: verifiedProjects.map((sub) => {
      const job = state.jobs.find((j) => j.id === sub.jobId);
      const jobSkills = job?.skills ?? [];
      return {
        jobTitle: sub.jobTitle,
        companyName: sub.companyName ?? "Company",
        category: job?.category ?? "Project",
        date: fmtDate(sub.submittedAt),
        skills: jobSkills,
        isWinner: sub.isWinner,
        pointsAwarded: sub.pointsAwarded,
        github: sub.github ?? "",
        feedback: sub.feedback ?? "",
        slots: job?.slots ?? 0,
        bullet1: `Delivered a complete ${job?.category ?? "software"} solution for ${sub.companyName ?? "a real company"}, meeting all specified requirements and deadlines.`,
        bullet2: jobSkills.length > 0
          ? `Applied ${jobSkills.slice(0, 3).join(", ")} to build and submit a working, peer-reviewed implementation.`
          : "",
      };
    }),
    userPoints,
    winnerCount,
    tasksCompleted,
    generated,
    recommendations: buildRecommendations(),
  });

  const handleDownloadPDF = () => {
    if (!generated) {
      toast("Please build your CV first by clicking 'Build CV with AI'.", "info");
      return;
    }
    toast("Opening print dialog — choose 'Save as PDF' to download.", "info");
    const html = buildPrintHTML(buildPDFData());
    const fileName = `${fullName.replace(/\s+/g, "_")}_CV_SkillO.pdf`;
    printCV(html, fileName);
  };

  return (
    <div className="flex min-h-screen bg-[#f8f6f3]">
      <WorkerSidebar state={state} active="worker-cv" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="font-display text-3xl text-[#1a1210]">AI CV Builder</h1>
              <p className="text-[#7a6560] text-sm mt-1">Generate a professional resume from your verified SkillO experience</p>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#896558] text-[#896558] text-sm font-semibold rounded-xl hover:bg-white transition-colors"
            >
              <Download size={16} /> Download PDF
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* ── Left sidebar ── */}
            <div className="space-y-4">
              {/* AI panel */}
              <div className="bg-[#1a1210] rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2.5 mb-3">
                  <Sparkles size={18} className="text-[#c4a882]" />
                  <p className="font-semibold text-sm">Gemini AI Assistant</p>
                </div>
                <p className="text-white/60 text-xs leading-relaxed mb-4">
                  Generates a professional summary, verified project entries, and career recommendations from your real SkillO task history.
                </p>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="w-full py-3 bg-[#896558] text-white text-sm font-semibold rounded-xl hover:bg-[#b08070] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating...</>
                  ) : generated ? (
                    <><Sparkles size={14} /> Regenerate</>
                  ) : (
                    <>Build CV with AI <ArrowRight size={14} /></>
                  )}
                </button>
              </div>

              {/* Skills from profile + tasks */}
              {allSkills.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-[#e8ddd7] shadow-sm">
                  <p className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider mb-3">Your Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allSkills.map((s) => (
                      <span key={s} className="text-xs bg-[#ede0d0] text-[#5c4039] px-2 py-1 rounded-lg font-medium">{s}</span>
                    ))}
                  </div>
                  {taskSkills.length > 0 && (
                    <p className="text-xs text-[#7a6560] mt-2">
                      <CheckCircle size={10} className="inline text-[#896558] mr-1" />
                      {taskSkills.length} skill{taskSkills.length > 1 ? "s" : ""} verified via completed tasks
                    </p>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="bg-white rounded-2xl p-4 border border-[#e8ddd7] shadow-sm">
                <p className="text-xs font-semibold text-[#7a6560] uppercase tracking-wider mb-3">Profile Stats</p>
                <div className="space-y-2.5">
                  {[
                    ["Tasks Completed", tasksCompleted.toString()],
                    ["Skill Points",    userPoints.toString()],
                    ["Task Wins",       winnerCount.toString()],
                    ["Verified Entries", tasksCompleted.toString()],
                  ].map(([l, v]) => (
                    <div key={l} className="flex items-center justify-between">
                      <span className="text-xs text-[#7a6560]">{l}</span>
                      <span className="text-sm font-semibold text-[#896558]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── CV Preview ── */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-[#e8ddd7] shadow-sm overflow-hidden">
                {/* CV Header */}
                <div className="bg-[#1a1210] px-8 py-7 text-white">
                  <h2 className="font-display text-3xl">{fullName}</h2>
                  {allSkills.length > 0 && (
                    <p className="text-white/60 text-sm mt-0.5">
                      {allSkills[0]}{allSkills[1] ? ` · ${allSkills[1]}` : ""}
                      {department ? ` · ${department}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-white/50">
                    <span>{email}</span>
                    <span>github.com/{githubHandle}</span>
                    {university && <span>{university}{batch ? `, Batch ${batch}` : ""}</span>}
                    <span className="flex items-center gap-1">
                      <CheckCircle size={11} className="text-[#896558]" /> SkillO Profile
                    </span>
                  </div>
                </div>

                <div className="p-8 space-y-7">
                  {/* Professional Summary */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#896558] pb-2 border-b border-[#f5f0ec] mb-3">
                      Professional Summary
                    </h3>
                    {generated ? (
                      <p className="text-sm text-[#1a1210] leading-relaxed">{buildSummary()}</p>
                    ) : (
                      <div className="bg-[#f8f6f3] border border-dashed border-[#e8ddd7] rounded-xl p-4 text-center">
                        <Sparkles size={20} className="text-[#c4a882] mx-auto mb-2" />
                        <p className="text-xs text-[#7a6560]">Click "Build CV with AI" to generate your professional summary</p>
                      </div>
                    )}
                  </div>

                  {/* Verified Project Experience */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#896558] pb-2 border-b border-[#f5f0ec] mb-4">
                      Verified Project Experience
                    </h3>
                    {verifiedProjects.length > 0 ? (
                      <div className="space-y-5">
                        {verifiedProjects.map((sub) => {
                          const job = state.jobs.find((j) => j.id === sub.jobId);
                          const jobSkills = job?.skills ?? [];
                          return (
                            <div key={sub.id} className="border-l-2 border-[#896558] pl-4">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <h4 className="font-semibold text-[#1a1210] text-sm">{sub.jobTitle}</h4>
                                  <p className="text-xs text-[#7a6560] mt-0.5">
                                    {sub.companyName ?? "Company"} · {job?.category ?? "Project"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                  {sub.isWinner && (
                                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                      <Trophy size={10} /> Winner
                                    </span>
                                  )}
                                  {sub.pointsAwarded > 0 && (
                                    <span className="flex items-center gap-1 text-xs font-semibold text-[#896558] bg-[#ede0d0] px-2 py-0.5 rounded-full">
                                      <Star size={10} /> +{sub.pointsAwarded} pts
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 text-xs text-[#7a6560]">
                                    <Calendar size={10} /> {fmtDate(sub.submittedAt)}
                                  </span>
                                </div>
                              </div>

                              {/* AI-generated bullet points for each project */}
                              {generated && (
                                <ul className="mt-2 space-y-1">
                                  <li className="text-xs text-[#1a1210] flex items-start gap-1.5 leading-relaxed">
                                    <span className="text-[#896558] mt-0.5 flex-shrink-0">▸</span>
                                    Delivered a complete {job?.category ?? "software"} solution for {sub.companyName ?? "a real company"}, meeting all specified requirements and deadlines.
                                  </li>
                                  {jobSkills.length > 0 && (
                                    <li className="text-xs text-[#1a1210] flex items-start gap-1.5 leading-relaxed">
                                      <span className="text-[#896558] mt-0.5 flex-shrink-0">▸</span>
                                      Applied {jobSkills.slice(0, 3).join(", ")} to build and submit a working, peer-reviewed implementation.
                                    </li>
                                  )}
                                  {sub.isWinner && (
                                    <li className="text-xs text-[#1a1210] flex items-start gap-1.5 leading-relaxed">
                                      <span className="text-amber-600 mt-0.5 flex-shrink-0">▸</span>
                                      Selected as the top submission out of {job?.slots ?? "multiple"} competing participants — awarded cash prize.
                                    </li>
                                  )}
                                  {sub.feedback && (
                                    <li className="text-xs text-[#7a6560] italic flex items-start gap-1.5 leading-relaxed">
                                      <span className="mt-0.5 flex-shrink-0">✦</span>
                                      Company feedback: "{sub.feedback}"
                                    </li>
                                  )}
                                </ul>
                              )}

                              {/* Tech tags */}
                              {jobSkills.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {jobSkills.map((sk) => (
                                    <span key={sk} className="text-xs bg-[#f8f6f3] border border-[#e8ddd7] text-[#7a6560] px-2 py-0.5 rounded">{sk}</span>
                                  ))}
                                </div>
                              )}

                              {/* GitHub link */}
                              {sub.github && (
                                <a href={sub.github.startsWith("http") ? sub.github : `https://${sub.github}`}
                                  target="_blank" rel="noreferrer"
                                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#896558] hover:underline">
                                  <GitBranch size={11} /> {sub.github}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-[#f8f6f3] border border-dashed border-[#e8ddd7] rounded-xl p-8 text-center">
                        <FileText size={24} className="text-[#c4a882] mx-auto mb-3" />
                        <p className="text-sm font-semibold text-[#1a1210] mb-1">No verified projects yet</p>
                        <p className="text-xs text-[#7a6560] mb-4 leading-relaxed max-w-xs mx-auto">
                          Complete SkillO tasks to earn verified CV entries. Each accepted submission adds a real project to your resume.
                        </p>
                        <button
                          onClick={() => state.navigate("worker-dashboard")}
                          className="px-5 py-2 bg-[#896558] text-white text-xs font-semibold rounded-xl hover:bg-[#5c4039] transition-colors"
                        >
                          Browse Tasks →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  {(university || department) && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#896558] pb-2 border-b border-[#f5f0ec] mb-3">
                        Education
                      </h3>
                      <div className="border-l-2 border-[#e8ddd7] pl-4">
                        <p className="font-semibold text-[#1a1210] text-sm">{department || "Computer Science"}</p>
                        <p className="text-xs text-[#7a6560]">{university}{batch ? ` · Batch ${batch}` : ""}</p>
                      </div>
                    </div>
                  )}

                  {/* Technical Skills */}
                  {allSkills.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#896558] pb-2 border-b border-[#f5f0ec] mb-3">
                        Technical Skills
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {allSkills.map((s) => (
                          <span key={s} className="text-xs bg-[#f8f6f3] border border-[#e8ddd7] text-[#1a1210] px-2.5 py-1 rounded-lg">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Career Recommendations */}
                  {generated && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#896558] pb-2 border-b border-[#f5f0ec] mb-3">
                        AI Career Recommendations
                      </h3>
                      <div className="space-y-2">
                        {buildRecommendations().map((r, i) => (
                          <p key={i} className="text-xs text-[#7a6560] flex items-start gap-2 leading-relaxed">
                            <ArrowRight size={12} className="text-[#896558] flex-shrink-0 mt-0.5" />
                            {r}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SkillO verification note */}
                  {verifiedProjects.length > 0 && (
                    <div className="bg-[#ede0d0] rounded-xl p-4 flex items-start gap-3">
                      <CheckCircle size={16} className="text-[#896558] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-[#5c4039] mb-0.5">SkillO Verified</p>
                        <p className="text-xs text-[#7a6560] leading-relaxed">
                          {verifiedProjects.length} project{verifiedProjects.length > 1 ? "s" : ""} on this CV {verifiedProjects.length > 1 ? "are" : "is"} verified by real companies through the SkillO platform. Each entry represents a genuine, reviewed deliverable.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
