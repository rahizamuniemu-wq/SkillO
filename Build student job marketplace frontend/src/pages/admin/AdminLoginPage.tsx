import React, { useState, useRef } from "react";
import { ArrowLeft, AlertCircle, Loader2, Shield, KeyRound, Mail, CheckCircle, Eye, EyeOff } from "lucide-react";
import type { AppState } from "../../App";
import * as api from "../../lib/api";

// ─── Forgot-password sub-flow for admin ──────────────────────────────────────
function AdminForgotPassword({ onBack }: { onBack: () => void }) {
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
    setLoading(true); setError(null);
    try { await api.forgotPassword(email); setStep(2); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to send code."); }
    finally { setLoading(false); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.verifyResetCode(email, code);
      setResetToken(res.resetToken); setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code.");
      setDigits(["","","","","",""]); inputRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPw) { setError("Passwords do not match."); return; }
    setLoading(true); setError(null);
    try { await api.resetPassword(resetToken, newPassword); setSuccess(true); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to reset password."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0e0d] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Admin Login
        </button>
        <div className="flex justify-center mb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#896558] flex items-center justify-center">
            <KeyRound size={22} className="text-white" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-white mb-1">Reset Admin Password</h2>
        <div className="flex justify-center gap-2 mb-8 mt-4">
          {[1,2,3].map((s) => <div key={s} className={`h-1 w-10 rounded-full transition-all ${s <= step ? "bg-[#896558]" : "bg-white/10"}`} />)}
        </div>
        <div className="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-2xl shadow-xl">
          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <p className="text-white font-semibold mb-2">Password updated!</p>
              <p className="text-white/50 text-sm mb-6">Sign in with your new password.</p>
              <button onClick={onBack} className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] text-white font-semibold text-sm rounded-xl transition-all">
                Back to Admin Login
              </button>
            </div>
          ) : (
            <>
              {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs"><AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span></div>}
              {step === 1 && (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Admin Email</label>
                    <input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : "Send Reset Code →"}
                  </button>
                </form>
              )}
              {step === 2 && (
                <form onSubmit={handleVerifyCode}>
                  <div className="flex flex-col items-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#896558]/20 border border-[#896558]/30 flex items-center justify-center mb-3">
                      <Mail size={24} className="text-[#896558]" />
                    </div>
                    <p className="text-white/50 text-sm text-center">Code sent to<br /><span className="text-white font-medium">{email}</span></p>
                  </div>
                  <div className="flex gap-1.5 sm:gap-2 justify-center mb-6">
                    {digits.map((d, i) => (
                      <input key={i} ref={(el) => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={6} value={d}
                        onChange={(e) => handleDigit(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} onFocus={(e) => e.target.select()}
                        className={`w-9 sm:w-11 h-12 sm:h-[52px] text-center text-lg sm:text-xl font-bold rounded-xl border bg-white/5 text-white focus:outline-none transition-all ${d ? "border-[#896558] bg-[#896558]/10" : "border-white/15 focus:border-[#896558]"}`}
                        aria-label={`Digit ${i + 1}`} />
                    ))}
                  </div>
                  <button type="submit" disabled={loading || code.length < 6} className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying…</> : "Verify Code →"}
                  </button>
                </form>
              )}
              {step === 3 && (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">New Password</label>
                    <div className="relative">
                      <input required type={showPw ? "text" : "password"} value={newPassword} minLength={6} onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                        className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Confirm New Password</label>
                    <input required type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setError(null); }}
                      className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 mt-2">
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

// ─── Main Admin Login Page ────────────────────────────────────────────────────
export default function AdminLoginPage({ state, onBack }: { state: AppState; onBack: () => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  if (showForgot) return <AdminForgotPassword onBack={() => setShowForgot(false)} />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const err = await state.loginAdmin(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen bg-[#0f0e0d] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm transition-colors">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#896558] flex items-center justify-center">
            <Shield size={22} className="text-white" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold text-white mb-1">Admin Access</h2>
        <p className="text-center text-sm text-white/30 mb-8">SkillO Platform Control Panel</p>

        <div className="bg-white/5 border border-white/10 p-5 sm:p-8 rounded-2xl shadow-xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Admin Email</label>
              <input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
              <input required type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#896558]" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#896558] hover:bg-[#6e4e42] disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 mt-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Signing in…</> : "Access Admin Panel →"}
            </button>
          </form>
          <div className="mt-5 text-center">
            <button type="button" onClick={() => setShowForgot(true)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors">
              Forgot your password?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
