import { useState } from "react";
import {
  Briefcase, GraduationCap, Sparkles, ArrowRight, CheckCircle2,
  Users, Trophy, FileText, BookOpen, Star, ChevronRight, Zap, X
} from "lucide-react";
import { AppState } from "../App";

const heroImg = "https://images.unsplash.com/photo-1752650735943-d0fbf1edce21?w=900&h=700&fit=crop&auto=format";
const teamImg = "https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=800&h=500&fit=crop&auto=format";
const devImg  = "https://images.unsplash.com/photo-1629904853893-c2c8981a1dc5?w=800&h=500&fit=crop&auto=format";

const workerSteps = [
  { n: "01", title: "Browse & Book a Slot",       desc: "Find tasks that match your skills. Only 15 slots per task — reserve yours before they're gone." },
  { n: "02", title: "Download Materials & Build", desc: "Access company-provided guides, docs, and references. Submit your work before the deadline." },
  { n: "03", title: "Earn, Grow & Get Hired",     desc: "Top work gets paid. Every valid submission earns skill points and a verified CV entry." },
];

const companySteps = [
  { n: "01", title: "Post a Task",                    desc: "Define requirements, attach learning resources, set your slot limit and reward structure." },
  { n: "02", title: "AI Shortlists the Best",         desc: "Google Gemini AI screens applicants and filters submissions for quality before you review anything." },
  { n: "03", title: "Pick a Winner & Optionally Hire",desc: "Score submissions, pay the best, and offer temporary or permanent roles to standout talent." },
];

const features = [
  { icon: Users,    title: "15-Slot Cap Per Task",      desc: "Eliminates review fatigue. Companies only ever evaluate a focused, manageable pool of work." },
  { icon: Sparkles, title: "Gemini AI Screening",       desc: "Google Gemini API pre-screens both applicants and submissions for completeness and quality." },
  { icon: Trophy,   title: "Dual-Tier Rewards",         desc: "Top submission earns cash. All valid participants earn skill points and verified CV credits." },
  { icon: FileText, title: "Auto-Generated CV",         desc: "AI compiles your verified task history into polished resume bullet points and summaries." },
  { icon: BookOpen, title: "Embedded Learning Hub",     desc: "Every task ships with docs, cheat sheets, and video links so you can learn while you build." },
  { icon: Briefcase,title: "Direct Hiring Pipeline",    desc: "Impressed companies can offer temporary or permanent roles directly through the platform." },
];

const testimonials = [
  { name: "Nusrat Jahan",  role: "Computer Science Student",  text: "I landed my first freelance gig after a SkillO submission. The company actually read my code and gave me real feedback.", rating: 5 },
  { name: "Aryan Hossain", role: "Junior Developer",           text: "The AI CV builder turned my three completed tasks into a resume that actually got me interviews. I was shocked.", rating: 5 },
  { name: "Fatima Malik",  role: "HR Lead at TechForward",     text: "We stopped wasting hours reviewing 200 applications. SkillO gives us 15 pre-screened submissions ready to judge.", rating: 5 },
];

const legalContent: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: `SkillO collects only the information necessary to operate the platform — your name, email address, and work submissions. We never sell your personal data to third parties. Submissions are shared only with the company that posted the relevant task. AI-generated CV data is stored locally and only exported when you choose to download it. You may request deletion of your account and all associated data at any time by contacting support@skillo.io.`,
  },
  terms: {
    title: "Terms of Service",
    body: `By using SkillO you agree to submit only original work that you have the right to share. Companies agree to pay the stated reward to the selected winner within 7 business days of selection. SkillO takes no commission on task rewards. AI screening decisions are advisory; final evaluation authority rests with the posting company. Accounts found to be fraudulent or abusive will be suspended without notice.`,
  },
  contact: {
    title: "Contact Us",
    body: `We'd love to hear from you.\n\nGeneral enquiries: hello@skillo.io\nSupport: support@skillo.io\nPartnerships: partners@skillo.io\n\nSkillO is a project developed at Chittagong University of Engineering and Technology (CUET), Department of CSE.\n\nResponse time: within 2 business days.`,
  },
};

export default function LandingPage({ state }: { state: AppState }) {
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | "contact" | null>(null);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const modal = legalModal ? legalContent[legalModal] : null;

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Legal modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLegalModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#e8ddd7] z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f5f0ec]">
              <h2 className="font-semibold text-[#1a1210]">{modal.title}</h2>
              <button onClick={() => setLegalModal(null)} className="w-8 h-8 rounded-lg hover:bg-[#f5f0ec] flex items-center justify-center text-[#7a6560]">
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-[#7a6560] leading-relaxed whitespace-pre-line">{modal.body}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e8ddd7]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#896558] flex items-center justify-center">
              <Zap size={15} className="text-white" fill="white" />
            </div>
            <span className="font-display text-xl text-[#1a1210] tracking-tight">SkillO</span>
          </button>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#7a6560]">
            <button onClick={() => scrollTo("how-it-works")} className="hover:text-[#896558] transition-colors">How it works</button>
            <button onClick={() => scrollTo("for-companies")} className="hover:text-[#896558] transition-colors">For Companies</button>
            <button onClick={() => scrollTo("for-students")}  className="hover:text-[#896558] transition-colors">For Students</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { import("../lib/api").then(a => a.clearToken()); state.goAuth("worker", "signin"); }} className="text-sm text-[#896558] font-semibold px-4 py-2 rounded-lg hover:bg-[#f5f0ec] transition-colors">
              Sign In
            </button>
            <button onClick={() => state.goAuth("worker", "signup")} className="text-sm text-white font-semibold px-4 py-2 rounded-xl bg-[#896558] hover:bg-[#5c4039] transition-all shadow-sm">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section id="hero" className="pt-28 pb-0 px-6 lg:px-10 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-end">
            <div className="pb-16 lg:pb-24">
              <h1 className="font-display text-5xl lg:text-6xl xl:text-7xl text-[#1a1210] leading-[1.05] mb-6">
                Build skills.<br />Earn proof.<br />
                <em className="text-[#896558] not-italic">Get hired.</em>
              </h1>
              <p className="text-[#7a6560] text-lg leading-relaxed mb-10 max-w-md">
                SkillO connects students and entry-level developers with real company tasks — capped at 15 participants so your work actually gets seen and rewarded.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => state.goAuth("worker", "signup")}
                  className="group flex items-center justify-center gap-2 px-7 py-3.5 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#5c4039] transition-all shadow-md hover:shadow-lg hover:shadow-[#89655830] text-sm"
                >
                  <GraduationCap size={17} />
                  Join as Student / Worker
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => state.goAuth("company", "signup")}
                  className="group flex items-center justify-center gap-2 px-7 py-3.5 border-2 border-[#896558] text-[#896558] font-semibold rounded-xl hover:bg-[#faf8f6] transition-all text-sm"
                >
                  <Briefcase size={17} />
                  Post Tasks as a Company
                </button>
              </div>
              <div className="flex items-center gap-6 mt-8 text-xs text-[#7a6560]">
                {["Free to join", "Verified CV entries", "Real company tasks"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[#896558]" />{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Hero visual */}
            <div className="relative h-[500px] lg:h-[620px]">
              <div className="absolute inset-x-0 bottom-0 h-[90%] rounded-t-3xl overflow-hidden bg-[#e8ddd7]">
                <img src={heroImg} alt="Two students collaborating on a laptop" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#5c4039]/40 to-transparent" />
              </div>
              <div className="absolute top-6 -left-4 lg:-left-8 bg-white rounded-2xl shadow-xl p-4 w-52 border border-[#e8ddd7]">
                <p className="text-xs text-[#7a6560] font-medium mb-2">Live right now</p>
                <p className="font-semibold text-[#1a1210] text-sm leading-snug">Build a Dashboard UI Component</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {["#896558","#b08070","#5c4039","#c4a882"].map((c, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center" style={{ background: c }}>
                        <span className="text-white text-[9px] font-bold">{["A","R","M","L"][i]}</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-[#896558] font-semibold">4 slots left</span>
                </div>
                <div className="mt-2 bg-[#f5f0ec] rounded-full h-1.5">
                  <div className="bg-[#896558] h-1.5 rounded-full" style={{ width: "73%" }} />
                </div>
              </div>
              <div className="absolute bottom-10 -right-2 lg:-right-6 bg-[#5c4039] rounded-2xl shadow-xl p-4 w-44 text-white">
                <Trophy size={18} className="text-[#c4a882] mb-2" />
                <p className="text-xs text-white/70 mb-0.5">Top submission</p>
                <p className="font-display text-2xl">Tk 200</p>
                <p className="text-xs text-white/60 mt-0.5">+ Verified CV entry</p>
              </div>
              <div className="absolute bottom-16 left-4 bg-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 border border-[#e8ddd7]">
                <Sparkles size={14} className="text-[#896558]" />
                <span className="text-xs font-semibold text-[#1a1210]">Gemini AI pre-screened</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-10 border-y border-[#e8ddd7] bg-[#faf8f6]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x divide-[#e8ddd7]">
            {[
              { v: "15",     l: "Max participants per task" },
              { v: "100%",   l: "Submissions get AI review" },
              { v: "2-tier", l: "Cash + points reward system" },
              { v: "Gemini", l: "AI powers screening & CV" },
            ].map((s) => (
              <div key={s.l} className="text-center lg:px-10">
                <p className="font-display text-4xl text-[#896558] mb-1">{s.v}</p>
                <p className="text-sm text-[#7a6560]">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6 lg:px-10" style={{ scrollMarginTop: "64px" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase text-[#896558] mb-3">Two sides, one platform</p>
            <h2 className="font-display text-4xl lg:text-5xl text-[#1a1210]">How SkillO works</h2>
          </div>

          {/* Students */}
          <div id="for-students" className="grid lg:grid-cols-2 gap-12 items-center mb-20" style={{ scrollMarginTop: "80px" }}>
            <div className="rounded-3xl overflow-hidden bg-[#e8ddd7] aspect-video lg:aspect-auto lg:h-[400px]">
              <img src={heroImg} alt="Students working together" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-[#896558] text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <GraduationCap size={12} /> For Students & Workers
              </div>
              <div className="space-y-7">
                {workerSteps.map((s) => (
                  <div key={s.n} className="flex gap-5">
                    <span className="font-display text-4xl text-[#c4a882] leading-none flex-shrink-0 w-12">{s.n}</span>
                    <div>
                      <h3 className="font-semibold text-[#1a1210] mb-1">{s.title}</h3>
                      <p className="text-sm text-[#7a6560] leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => state.goAuth("worker", "signup")} className="group mt-8 flex items-center gap-1.5 text-sm font-semibold text-[#896558] hover:text-[#5c4039] transition-colors">
                Start earning skill points
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Companies */}
          <div id="for-companies" className="grid lg:grid-cols-2 gap-12 items-center" style={{ scrollMarginTop: "80px" }}>
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 bg-[#5c4039] text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Briefcase size={12} /> For Companies
              </div>
              <div className="space-y-7">
                {companySteps.map((s) => (
                  <div key={s.n} className="flex gap-5">
                    <span className="font-display text-4xl text-[#c4a882] leading-none flex-shrink-0 w-12">{s.n}</span>
                    <div>
                      <h3 className="font-semibold text-[#1a1210] mb-1">{s.title}</h3>
                      <p className="text-sm text-[#7a6560] leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => state.goAuth("company", "signup")} className="group mt-8 flex items-center gap-1.5 text-sm font-semibold text-[#896558] hover:text-[#5c4039] transition-colors">
                Post your first task
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="order-1 lg:order-2 rounded-3xl overflow-hidden bg-[#e8ddd7] aspect-video lg:aspect-auto lg:h-[400px]">
              <img src={teamImg} alt="Company team reviewing work" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 lg:px-10 bg-[#faf8f6]">
        <div className="max-w-7xl mx-auto">
          <div className="lg:flex lg:items-end lg:justify-between mb-14">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-[#896558] mb-3">Platform features</p>
              <h2 className="font-display text-4xl lg:text-5xl text-[#1a1210] max-w-sm">Everything in one place</h2>
            </div>
            <p className="text-[#7a6560] text-sm max-w-xs mt-4 lg:mt-0 leading-relaxed">
              Built to bridge the gap between academic learning and real industry experience.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-[#e8ddd7] hover:border-[#c4a882] hover:shadow-md transition-all duration-200 group">
                  <div className="w-11 h-11 rounded-xl bg-[#ede0d0] flex items-center justify-center mb-4 group-hover:bg-[#c4a882] transition-colors">
                    <Icon size={20} className="text-[#896558] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-semibold text-[#1a1210] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#7a6560] leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI Spotlight ── */}
      <section className="py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#ede0d0] text-[#5c4039] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Sparkles size={12} /> Google Gemini AI Integration
              </div>
              <h2 className="font-display text-4xl text-[#1a1210] mb-5">AI that works for everyone</h2>
              <div className="space-y-5">
                {[
                  { title: "Candidate Screening",  desc: "Gemini AI ranks applicants and fills slots with the strongest candidates automatically." },
                  { title: "Submission Pre-check", desc: "Before company review, AI validates formatting, completeness, and code structure." },
                  { title: "CV & Resume Builder",  desc: "Gemini drafts bullet points, career summaries, and job recommendations from your history." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#ede0d0] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 size={14} className="text-[#896558]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1a1210] text-sm mb-0.5">{item.title}</h3>
                      <p className="text-sm text-[#7a6560] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => state.goAuth("worker", "signup")} className="group mt-8 flex items-center gap-1.5 text-sm font-semibold text-[#896558] hover:text-[#5c4039] transition-colors">
                See it in action
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="rounded-3xl overflow-hidden bg-[#e8ddd7] h-[380px]">
              <img src={devImg} alt="Developers working at monitors" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6 lg:px-10 bg-[#faf8f6]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-[#896558] mb-3">Real experiences</p>
            <h2 className="font-display text-4xl text-[#1a1210]">What people are saying</h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-[#e8ddd7]">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} className="text-[#896558] fill-[#896558]" />
                  ))}
                </div>
                <p className="text-[#1a1210] text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#ede0d0] flex items-center justify-center text-xs font-semibold text-[#896558]">
                    {t.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1a1210] text-sm">{t.name}</p>
                    <p className="text-xs text-[#7a6560]">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-6 lg:px-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1a1210] rounded-3xl px-10 py-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 30% 50%, #896558 0%, transparent 60%), radial-gradient(circle at 70% 50%, #c4a882 0%, transparent 60%)" }} />
            <div className="relative">
              <p className="text-xs font-bold tracking-widest uppercase text-[#c4a882] mb-4">Start today, free</p>
              <h2 className="font-display text-4xl lg:text-5xl text-white mb-5 leading-tight">
                Your next opportunity<br />is already posted.
              </h2>
              <p className="text-white/60 text-base mb-9 max-w-md mx-auto leading-relaxed">
                Tasks go live every week. The first 15 people who apply get to work. Don't wait.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => state.goAuth("worker", "signup")} className="px-8 py-3.5 bg-[#896558] text-white font-semibold rounded-xl hover:bg-[#b08070] transition-colors text-sm">
                  Find a Task to Work On
                </button>
                <button onClick={() => state.goAuth("company", "signup")} className="px-8 py-3.5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-sm">
                  Post a Task for Your Company
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e8ddd7] py-10 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#896558] flex items-center justify-center">
              <Zap size={13} className="text-white" fill="white" />
            </div>
            <span className="font-display text-lg text-[#1a1210]">SkillO</span>
            <span className="text-[#e8ddd7] text-xs hidden sm:inline">·</span>
            <span className="text-[#7a6560] text-xs hidden sm:inline">AI-Powered Micro-Task & Skill Platform</span>
          </div>
          <div className="flex gap-6 text-sm text-[#7a6560]">
            <button onClick={() => setLegalModal("privacy")} className="hover:text-[#896558] transition-colors">Privacy</button>
            <button onClick={() => setLegalModal("terms")}   className="hover:text-[#896558] transition-colors">Terms</button>
            <button onClick={() => setLegalModal("contact")} className="hover:text-[#896558] transition-colors">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
