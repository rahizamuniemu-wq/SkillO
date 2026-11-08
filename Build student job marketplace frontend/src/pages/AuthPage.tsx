import React, { useState, useEffect, useRef } from "react";
import { Zap, ArrowLeft, Building2, UserCheck, AlertCircle, Mail, RefreshCw, CheckCircle, Loader2, Shield, KeyRound, Eye, EyeOff } from "lucide-react";
import { AppState, UserAccount } from "../App";
import AdminLoginPage from "./admin/AdminLoginPage";
import * as api from "../lib/api";

// ─── Verification code screen ─────────────────────────────────────────────────
function VerifyScreen({ email, state }: { email: string; state: AppState }) {
  const [digits, setDigits]       = useState(["", "", "", "", "", ""]);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent]       = useState(false);
  const [cooldown, setCooldown]   = useState(0);
  const inputRefs                 = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join("");

  const handleDigit = (idx: number, val: string) => {
    if (val.length > 1) {
      const clean = val.replace(/\D/g, "").slice(0, 6);
      if (clean.length === 6) { setDigits(clean.split("")); inputRefs.current[5]?.focus(); return; }
      val = val.slice(-1);
    }
    if (!/^\d?$/.test(val)) return;
    const next = [...digits]; next[idx] = val; setDigits(next); setError(null);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true); setError(null);
    const err = await state.verifyEmail(email, code);
    setLoading(false);
    if (err) { setError(err); setDigits(["", "", "", "", "", ""]); inputRefs.current[0]?.focus(); }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true); setError(null);
    const err = await state.resendCode(email);
    setResending(false);
    if (err) { setError(err); return; }
    setResent(true); setCooldown(60); setTimeout(() => setResent(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#1a1210] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#896558] flex items-center justify-center">
            <Zap size={20} className="text-white" fill="white" />
          </div>
          <span className="font-display text-2xl text-white">SkillO</span>
        </div>
        <div className="bg-white/5 border border-white/10 p-8 shadow-xl rounded-2xl backdrop-blur-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#896558]/20 border border-[#896558]/30 flex items-center justify-center mb-4">
              <Mail size={28} className="text-[#896558]" />
            </div>
            <h2 className="text-xl font-bold text-white text-center">Check your email</h2>
            <p className="text-white/50 text-sm text-center mt-2 leading-relaxed">
              We sent a 6-digit code to<br /><span className="text-white font-medium">{email}</span>
            </p>
          </div>
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          {resent && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-xs">
              <CheckCircle size={15} className="flex-shrink-0" /><span>New code sent! Check your inbox.</span>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-6">
              {digits.map((d, i) => (
                <input key={i} ref={(el) => { inputRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={6} value={d}
                  onChange={(e) => handleDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  className={`w-11 text-center text-xl font-bold rounded-xl border bg-white/5 text-white focus:outline-none transition-all
                    ${d ? "border-[#896558] bg-[#896558]/10" : "border-white/15 focus:border-[#896558]"}
                    ${error ? "border-red-500/50" : ""}`}
                  style={{ height: "52px" }}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
            <button type="submit" disabled={loading || code.length < 6}
              className="w-full py-2.5 px-4 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : "Verify Email →"}
            </button>
          </form>
          <div className="mt-5 text-center">
            <p className="text-xs text-white/40 mb-2">Didn't receive the code?</p>
            <button type="button" onClick={handleResend} disabled={resending || cooldown > 0}
              className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
            </button>
          </div>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => state.setPendingEmail(null)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors">
              ← Back to sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Login Screen ───────────────────────────────────────────────────────
// AdminLoginScreen moved to ./admin/AdminLoginPage.tsx so it can also be served
// at the dedicated /admin URL.

// ─── Forgot Password Flow ─────────────────────────────────────────────────────
function ForgotPasswordFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [email, setEmail]             = useState("");
  const [digits, setDigits]           = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken]   = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const inputRefs                     = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  const handleDigit = (idx: number, val: string) => {
    if (val.length > 1) {
      const clean = val.replace(/\D/g, "").slice(0, 6);
      if (clean.length === 6) { setDigits(clean.split("")); inputRefs.current[5]?.focus(); return; }
      val = val.slice(-1);
    }
    if (!/^\d?$/.test(val)) return;
    const next = [...digits]; next[idx] = val; setDigits(next); setError(null);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };
  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true); setError(null);
    try { await api.forgotPassword(email.trim()); setStep(2); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to send code."); }
    finally { setLoading(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true); setError(null);
    try {
      const res = await api.verifyResetCode(email, code);
      setResetToken(res.resetToken); setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
      setDigits(["","","","","",""]); inputRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true); setError(null);
    try { await api.resetPassword(resetToken, newPassword); setSuccess(true); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to reset password."); }
    finally { setLoading(false); }
  };

  const stepLabel = ["Enter your email", "Check your email", "Set new password"][step - 1];

  return (
    <div className="min-h-screen bg-[#1a1210] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Sign In
        </button>
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#896558] flex items-center justify-center">
            <KeyRound size={22} className="text-white" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-white mb-1">Forgot Password</h2>
        <p className="text-center text-sm text-white/30 mb-4">{stepLabel}</p>
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 w-10 rounded-full transition-all ${s <= step ? "bg-[#896558]" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl shadow-xl">
          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <p className="text-white font-semibold mb-2">Password updated!</p>
              <p className="text-white/50 text-sm mb-6">You can now sign in with your new password.</p>
              <button onClick={onBack} className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] text-white font-semibold text-sm rounded-xl transition-all">
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
                </div>
              )}

              {step === 1 && (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Email Address</label>
                    <input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                  </div>
                  <p className="text-xs text-white/30">We'll email you a 6-digit code. Check your spam folder if it doesn't arrive within a minute.</p>
                  <button type="submit" disabled={loading}
                    className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : "Send Reset Code →"}
                  </button>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleVerifyCode}>
                  <div className="flex flex-col items-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#896558]/20 border border-[#896558]/30 flex items-center justify-center mb-4">
                      <Mail size={26} className="text-[#896558]" />
                    </div>
                    <p className="text-white/50 text-sm text-center">
                      We sent a 6-digit code to<br /><span className="text-white font-medium">{email}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center mb-6">
                    {digits.map((d, i) => (
                      <input key={i} ref={(el) => { inputRefs.current[i] = el; }}
                        type="text" inputMode="numeric" maxLength={6} value={d}
                        onChange={(e) => handleDigit(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onFocus={(e) => e.target.select()}
                        className={`w-11 text-center text-xl font-bold rounded-xl border bg-white/5 text-white focus:outline-none transition-all
                          ${d ? "border-[#896558] bg-[#896558]/10" : "border-white/15 focus:border-[#896558]"}
                          ${error ? "border-red-500/50" : ""}`}
                        style={{ height: "52px" }}
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>
                  <button type="submit" disabled={loading || code.length < 6}
                    className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 mb-4">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : "Verify Code →"}
                  </button>
                  <button type="button" onClick={() => { setStep(1); setDigits(["","","","","",""]); setError(null); }}
                    className="w-full text-xs text-white/30 hover:text-white/60 transition-colors text-center">
                    ← Use a different email
                  </button>
                </form>
              )}

              {step === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">New Password</label>
                    <div className="relative">
                      <input required type={showPw ? "text" : "password"} value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                        minLength={6} placeholder="At least 6 characters"
                        className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Confirm New Password</label>
                    <input required type={showPw ? "text" : "password"} value={confirmPw}
                      onChange={(e) => { setConfirmPw(e.target.value); setError(null); }}
                      placeholder="Repeat your new password"
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 mt-2">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : "Set New Password →"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main AuthPage ────────────────────────────────────────────────────────────
export default function AuthPage({ state }: { state: AppState }) {
  const isCompany = state.role === "company";
  const [isSignUp, setIsSignUp]   = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", password: "",
    companyName: "", industry: "", skills: "", university: "", batch: "", department: "",
  });

  useEffect(() => { setIsSignUp(state.authMode === "signup"); setError(null); }, [state.authMode]);

  if (state.pendingEmail) return <VerifyScreen email={state.pendingEmail} state={state} />;
  if (showAdmin) return <AdminLoginPage state={state} onBack={() => setShowAdmin(false)} />;
  if (showForgot) return <ForgotPasswordFlow onBack={() => { setShowForgot(false); setIsSignUp(false); setError(null); }} />;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value })); setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    if (isSignUp) {
      // For companies: derive firstName/lastName from the company name so the backend is satisfied
      const firstName = isCompany ? (formData.companyName.split(" ")[0] || formData.companyName) : formData.firstName;
      const lastName  = isCompany ? (formData.companyName.split(" ").slice(1).join(" ") || formData.companyName) : formData.lastName;
      const account: UserAccount = {
        role: isCompany ? "company" : "worker", email: formData.email, password: formData.password,
        firstName, lastName,
        ...(isCompany
          ? { companyName: formData.companyName, industry: formData.industry }
          : { university: formData.university, batch: formData.batch, department: formData.department, skills: formData.skills }),
      };
      const err = await state.registerUser(account);
      setLoading(false); if (err) setError(err);
    } else {
      const err = await state.loginUser(formData.email, formData.password, isCompany ? "company" : "worker");
      setLoading(false); if (err) setError(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1210] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <button onClick={() => state.navigate("landing")}
          className="inline-flex items-center gap-2 text-white/50 hover:text-white mb-6 text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Home
        </button>
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#896558] flex items-center justify-center">
            <Zap size={20} className="text-white" fill="white" />
          </div>
          <span className="font-display text-2xl text-white">SkillO</span>
        </div>
        <h2 className="text-center text-2xl font-bold text-white mt-4">
          {isSignUp ? "Create an Account" : "Welcome Back"}
        </h2>
        <p className="text-center text-sm text-white/50 mt-1">
          {isCompany ? "Posting projects and finding talent" : "Finding micro-tasks & building experience"}
        </p>
        <div className="mt-4 flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button type="button" onClick={() => state.goAuth("worker", isSignUp ? "signup" : "signin")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${!isCompany ? "bg-[#896558] text-white" : "text-white/50 hover:text-white"}`}>
            <UserCheck size={14} /> Student / Worker
          </button>
          <button type="button" onClick={() => state.goAuth("company", isSignUp ? "signup" : "signin")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${isCompany ? "bg-[#896558] text-white" : "text-white/50 hover:text-white"}`}>
            <Building2 size={14} /> Company / Client
          </button>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/5 border border-white/10 p-8 shadow-xl rounded-2xl backdrop-blur-sm">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={16} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Worker signup: first + last name */}
            {isSignUp && !isCompany && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">First Name</label>
                  <input required type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Last Name</label>
                  <input required type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                </div>
              </div>
            )}
            {/* Company signup: company name + type of company */}
            {isSignUp && isCompany && (
              <>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Company Name</label>
                  <input required type="text" name="companyName" placeholder="e.g. Tech Corp Ltd." value={formData.companyName} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Type of Company / Industry</label>
                  <input type="text" name="industry" placeholder="e.g. Software, FinTech, E-commerce" value={formData.industry} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Email Address</label>
              <input required type="email" name="email" value={formData.email} onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Password</label>
              <input required type="password" name="password" value={formData.password} onChange={handleChange}
                minLength={isSignUp ? 6 : undefined}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
              {isSignUp && <p className="text-xs text-white/30 mt-1">Minimum 6 characters</p>}
            </div>
            {/* Worker-only extra fields (university, batch, department, skills) */}
            {isSignUp && !isCompany && (
              <>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">University / Institute</label>
                  <input required type="text" name="university" placeholder="e.g. Dhaka University" value={formData.university} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Batch</label>
                    <input required type="text" name="batch" placeholder="e.g. 20th" value={formData.batch} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1">Department</label>
                    <input required type="text" name="department" placeholder="e.g. CSE" value={formData.department} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Top Skills</label>
                  <input type="text" name="skills" placeholder="e.g. React, Node.js, Python" value={formData.skills} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                </div>
              </>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-2">
              {loading
                ? <><Loader2 size={15} className="animate-spin" />{isSignUp ? "Creating account…" : "Signing in…"}</>
                : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>
          <div className="mt-6 text-center space-y-2">
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              className="text-xs text-white/60 hover:text-white transition-colors">
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
            {!isSignUp && (
              <div>
                <button type="button" onClick={() => setShowForgot(true)}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors">
                  Forgot your password?
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Admin access link — small and discreet at the bottom */}
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setShowAdmin(true)}
            className="inline-flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors">
            <Shield size={11} /> Admin Access
          </button>
        </div>
      </div>
    </div>
  );
}
