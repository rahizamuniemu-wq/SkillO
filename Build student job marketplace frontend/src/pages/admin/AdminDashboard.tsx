import { useState, useEffect } from "react";
import { Users, Building2, CheckCircle, Clock, TrendingUp, Shield, LogOut, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import * as api from "../../lib/api";
import type { PlatformStats, AdminUser } from "../../lib/api";

interface Props {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: Props) {
  const [stats, setStats]         = useState<PlatformStats | null>(null);
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(true);
  const [filter, setFilter]       = useState<"all" | "worker" | "company">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [s, u] = await Promise.all([api.getAdminStats(), api.getAdminUsers()]);
      setStats(s);
      setUsers(u ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  const filtered = users.filter((u) => filter === "all" || u.role === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#896558]/30 border-t-[#896558] animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0e0d]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#1a1210]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#896558] flex items-center justify-center">
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">SkillO Admin</p>
              <p className="text-white/40 text-xs">Platform Control Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-xs font-medium transition-colors"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
            >
              <LogOut size={12} /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <>
            <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">Platform Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: "Total Users",       value: stats.totalUsers,        icon: Users,       color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
                { label: "Workers / Students", value: stats.totalWorkers,      icon: Users,       color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Companies",          value: stats.totalCompanies,    icon: Building2,   color: "text-[#c4a882]",   bg: "bg-[#896558]/10 border-[#896558]/20" },
                { label: "Verified Workers",   value: stats.verifiedWorkers,   icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                { label: "Verified Companies", value: stats.verifiedCompanies, icon: CheckCircle, color: "text-[#c4a882]",   bg: "bg-[#896558]/10 border-[#896558]/20" },
                { label: "New (Last 7 Days)",  value: stats.recentSignups7d,   icon: TrendingUp,  color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className={`rounded-2xl border p-5 ${s.bg}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white/50 text-xs font-medium">{s.label}</p>
                      <Icon size={15} className={s.color} />
                    </div>
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Unverified warning */}
            {(stats.totalWorkers - stats.verifiedWorkers + stats.totalCompanies - stats.verifiedCompanies) > 0 && (
              <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <Clock size={15} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-400 text-sm">
                  <span className="font-semibold">{stats.totalWorkers - stats.verifiedWorkers + stats.totalCompanies - stats.verifiedCompanies}</span> accounts pending email verification.
                </p>
              </div>
            )}
          </>
        )}

        {/* Users Table */}
        <div className="bg-[#1a1210] border border-white/10 rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-b border-white/10">
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="flex items-center gap-2 text-white font-semibold text-sm"
            >
              Registered Users ({filtered.length})
              {showUsers ? <ChevronUp size={15} className="text-white/50" /> : <ChevronDown size={15} className="text-white/50" />}
            </button>
            <div className="flex gap-1.5">
              {(["all", "worker", "company"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    filter === f
                      ? "bg-[#896558] text-white"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {showUsers && (
            <div className="overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-white/30 text-sm">No users found.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-6 py-3 text-white/30 font-medium text-xs uppercase tracking-wider">Name</th>
                      <th className="text-left px-6 py-3 text-white/30 font-medium text-xs uppercase tracking-wider">Email</th>
                      <th className="text-left px-6 py-3 text-white/30 font-medium text-xs uppercase tracking-wider">Role</th>
                      <th className="text-left px-6 py-3 text-white/30 font-medium text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left px-6 py-3 text-white/30 font-medium text-xs uppercase tracking-wider">Points</th>
                      <th className="text-left px-6 py-3 text-white/30 font-medium text-xs uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => (
                      <tr key={u.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#896558]/20 flex items-center justify-center text-[#896558] text-xs font-bold flex-shrink-0">
                              {u.firstName?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <span className="text-white font-medium">
                              {u.firstName} {u.lastName}
                              {u.companyName && <span className="text-white/40 ml-1.5 text-xs">({u.companyName})</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-white/60">{u.email}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.role === "worker"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-[#896558]/15 text-[#c4a882] border border-[#896558]/25"
                          }`}>
                            {u.role === "worker" ? "Student" : "Company"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          {u.isVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle size={11} /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                              <Clock size={11} /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-white/60">{u.points}</td>
                        <td className="px-6 py-3.5 text-white/40 text-xs">
                          {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-8">
          SkillO Admin Panel · Passwords, OTPs and sensitive credentials are never shown here.
        </p>
      </div>
    </div>
  );
}
