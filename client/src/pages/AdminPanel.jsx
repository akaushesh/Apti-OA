import { useEffect, useState, useCallback } from "react";
import API from "../api/axios";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [questionSets, setQuestionSets] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [activeTab, setActiveTab] = useState("live"); // 'live' | 'users' | 'sets' | 'attempts'
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, id: null, title: "" });
  const [reevaluatingSetId, setReevaluatingSetId] = useState(null);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, analyticsRes, setsRes, attemptsRes] = await Promise.all([
        API.get("/users/admin/users"),
        API.get("/users/admin/analytics"),
        API.get("/mcq/question-sets"),
        API.get("/mcq/attempts?all=true")
      ]);
      setUsers(usersRes.data.data || []);
      setAnalytics(analyticsRes.data.data || null);
      setQuestionSets(setsRes.data.data || []);
      setAttempts(attemptsRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load admin management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const refreshAttempts = useCallback(async () => {
    setRefreshing(true);
    try {
      const attemptsRes = await API.get("/mcq/attempts?all=true");
      setAttempts(attemptsRes.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Background auto-refresh for live test monitor
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshAttempts();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAttempts]);

  const handleConfirmDelete = async () => {
    const { type, id } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, id: null, title: "" });

    try {
      if (type === "user") {
        await API.delete(`/users/admin/users/${id}`);
        toast.success("User account and data deleted");
      } else if (type === "set") {
        await API.delete(`/mcq/question-sets/${id}`);
        toast.success("Question set deleted");
      } else if (type === "attempt") {
        await API.delete(`/mcq/attempts/${id}`);
        toast.success("Attempt history deleted");
      }
      loadAdminData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to execute delete operation");
    }
  };

  const handleReevaluateSet = async (setId, setName) => {
    setReevaluatingSetId(setId);
    try {
      const res = await API.post(`/mcq/question-sets/${setId}/reevaluate`);
      toast.success(res.data?.message || `Re-evaluated attempts for ${setName}`);
      await loadAdminData();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to re-evaluate attempts");
    } finally {
      setReevaluatingSetId(null);
    }
  };

  // User category filtering
  const [selectedUserCategory, setSelectedUserCategory] = useState("all");

  const allUserCategories = Array.from(
    new Set(users.flatMap(u => u.categories || []).filter(Boolean))
  );

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.username || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" ? true : u.role === roleFilter;
    const matchesCategory = selectedUserCategory === "all" ? true : (u.categories || []).includes(selectedUserCategory);
    return matchesSearch && matchesRole && matchesCategory;
  });

  // Filter sets
  const filteredSets = questionSets.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [liveFilterMode, setLiveFilterMode] = useState("active"); // 'active' | 'all' | 'suspended' | 'stale'

  // Filter attempts
  const filteredAttempts = attempts.filter(a => 
    (a.questionSetId?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.userId?.fullName || a.userId?.username || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Live attempts (in-progress or suspended)
  const isRecentActive = (a) => {
    const timestamp = a.lastActiveAt || a.updatedAt;
    if (!timestamp) return false;
    const diffMs = Date.now() - new Date(timestamp).getTime();
    return diffMs < 5 * 60 * 1000; // active within last 5 minutes
  };

  const inProgressAttempts = attempts.filter(a => a.status === 'in-progress' && !a.suspendReason);
  const activeNowAttempts = inProgressAttempts.filter(isRecentActive);
  const staleAttempts = inProgressAttempts.filter(a => !isRecentActive(a));

  const filteredLiveAttempts = inProgressAttempts.filter(a => {
    const userMatch = (a.userId?.fullName || a.userId?.username || "").toLowerCase().includes(searchTerm.toLowerCase());
    const setMatch = (a.questionSetId?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = userMatch || setMatch;
    if (!matchesSearch) return false;

    if (liveFilterMode === "active") return isRecentActive(a);
    if (liveFilterMode === "stale") return !isRecentActive(a);
    return true;
  });

  const handleSuspendAttempt = (attemptId, title) => {
    toast((t) => (
      <div className="flex flex-col gap-2 py-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span className="font-extrabold text-sm text-white">
            Suspend Live Exam?
          </span>
        </div>
        <p className="text-xs text-slate-300">
          The candidate for <strong className="text-white">{title}</strong> will be locked out immediately.
        </p>
        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1 text-xs font-bold rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await API.post(`/mcq/attempts/${attemptId}/suspend`, { reason: "Suspended by admin via Live Monitor" });
                toast.success(`Exam suspended for ${title}`);
                refreshAttempts();
              } catch (err) {
                toast.error(err.response?.data?.message || "Failed to suspend test");
              }
            }}
            className="px-3 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors"
          >
            Suspend Now
          </button>
        </div>
      </div>
    ), { 
      duration: 8000, 
      position: "top-center",
      style: {
        background: '#0f172a',
        color: '#fff',
        borderRadius: '16px',
        padding: '14px 18px',
        maxWidth: '420px',
        border: '1px solid #334155',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
      }
    });
  };

  const formatOSBadge = (os, browser) => {
    let icon = "💻";
    if (/mac/i.test(os)) icon = "🍎";
    else if (/win/i.test(os)) icon = "🪟";
    else if (/android/i.test(os)) icon = "🤖";
    else if (/ios/i.test(os)) icon = "📱";
    else if (/linux/i.test(os)) icon = "🐧";

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-medium text-[11px] border border-slate-200/60 dark:border-slate-600/60">
        <span>{icon}</span>
        <span>{os || "Unknown OS"}</span>
        {browser && <span className="text-slate-400">• {browser}</span>}
      </span>
    );
  };

  const formatSec = (sec) => {
    if (sec === undefined || sec === null || isNaN(sec)) return "—";
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return `${m}:${remS < 10 ? '0' : ''}${remS}`;
  };

  const formatLastActive = (date) => {
    if (!date) return "Recently";
    const diffSec = Math.round((new Date() - new Date(date)) / 1000);
    if (diffSec < 20) return "Active now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const min = Math.floor(diffSec / 60);
    return `${min}m ago`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Delete Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Delete {confirmModal.type === 'user' ? 'User Account' : confirmModal.type === 'set' ? 'Question Set' : 'Attempt Record'}?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{confirmModal.title}</span>? This action is permanent and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, type: null, id: null, title: "" })}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-purple-500/10 to-transparent pointer-events-none" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest bg-purple-500/30 text-purple-300 rounded-md border border-purple-400/30">
              System Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Admin Management Console
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Monitor platform metrics, view user activity details, manage roles, audit practice question banks, and oversee test history.
          </p>
        </div>
        <Link 
          to="/" 
          className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-xl border border-white/20 backdrop-blur-md transition-all active:scale-95 shrink-0 text-sm"
        >
          Back to Main Dashboard
        </Link>
      </div>

      {/* System Analytics Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Users</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{analytics?.totalUsers || 0}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">registered</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 dark:text-purple-400">Admins</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">{analytics?.totalAdmins || 0}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">elevated</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Question Sets</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">{analytics?.totalQuestionSets || 0}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">banks</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Attempts</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{analytics?.totalAttempts || 0}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">taken</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Completion Rate</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">{analytics?.completionRatePercent || 0}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">submitted</span>
          </div>
        </div>
      </div>

      {/* Main Tab Controls & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl shrink-0 gap-1">
          <button
            onClick={() => setActiveTab("live")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "live"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeNowAttempts.length > 0 ? "bg-emerald-400 opacity-75" : "bg-slate-400 opacity-40"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${activeNowAttempts.length > 0 ? "bg-emerald-400" : "bg-slate-400"}`} />
            </span>
            <span>Live Monitor</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === "live" ? "bg-rose-700 text-white" : activeNowAttempts.length > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
            }`}>
              {activeNowAttempts.length > 0 ? activeNowAttempts.length : inProgressAttempts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "users"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            User Accounts ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("sets")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "sets"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Question Sets ({questionSets.length})
          </button>
          <button
            onClick={() => setActiveTab("attempts")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "attempts"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Attempts Audit ({attempts.length})
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-72">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search by name or title..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-900 dark:text-white"
            />
          </div>

          {activeTab === "users" && (
            <>
              <select
                value={selectedUserCategory}
                onChange={e => setSelectedUserCategory(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {allUserCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="user">Users Only</option>
                <option value="admin">Admins Only</option>
              </select>
            </>
          )}
        </div>

      </div>

      {/* Tab Content Sections */}

      {/* 0. Live Monitor Tab */}
      {activeTab === "live" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeNowAttempts.length > 0 ? "bg-emerald-400 opacity-75" : "bg-slate-400 opacity-40"}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${activeNowAttempts.length > 0 ? "bg-emerald-500" : "bg-slate-400"}`} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Real-time Candidate Monitor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activeNowAttempts.length} active right now</span>
                  {staleAttempts.length > 0 && <span> • {staleAttempts.length} abandoned/idle from earlier</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
              {/* Filter Pills */}
              <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  onClick={() => setLiveFilterMode("active")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    liveFilterMode === "active"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  Active Now ({activeNowAttempts.length})
                </button>
                <button
                  onClick={() => setLiveFilterMode("all")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    liveFilterMode === "all"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  All ({inProgressAttempts.length})
                </button>
                <button
                  onClick={() => setLiveFilterMode("stale")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    liveFilterMode === "stale"
                      ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  Idle / Stale ({staleAttempts.length})
                </button>
              </div>

              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  autoRefresh
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                {autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
              </button>

              <button
                onClick={refreshAttempts}
                disabled={refreshing}
                className="px-3.5 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
              >
                <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Live Attempts List */}
          {filteredLiveAttempts.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700/60 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                {searchTerm ? "No live tests matching search" : "No Tests In Progress"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {searchTerm 
                  ? "Try clearing your search query to see all active test attempts."
                  : "When candidates start an exam, their live time left per section, active question, answer count, and device OS will appear here in real time."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredLiveAttempts.map(a => {
                const totalQ = a.totalQuestions || 1;
                const answeredCount = a.answers?.filter(ans => ans.selectedOption)?.length || 0;
                const answeredPct = Math.round((answeredCount / totalQ) * 100);
                const currentQ = (a.currentQuestionIndex || 0) + 1;
                const curSection = a.currentSection || a.section || "General";
                const userObj = a.userId || {};
                const lastActive = formatLastActive(a.lastActiveAt || a.updatedAt);
                const isVeryActive = !a.lastActiveAt || (new Date() - new Date(a.lastActiveAt)) < 30000;

                // Section timers map
                const sectionTimersLeftMap = a.sectionTimersLeft instanceof Map
                  ? Object.fromEntries(a.sectionTimersLeft)
                  : (a.sectionTimersLeft || {});

                return (
                  <div 
                    key={a._id} 
                    className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all p-5 sm:p-6 flex flex-col justify-between gap-5"
                  >
                    {/* Header: User & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-base flex items-center justify-center shadow-md">
                            {(userObj.fullName || userObj.username || "U").charAt(0).toUpperCase()}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${
                            isVeryActive ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {userObj.fullName || userObj.username || "Candidate"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              @{userObj.username}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {formatOSBadge(a.userOS, a.userBrowser)}
                            <span className="text-[11px] text-slate-400 font-medium">
                              • {lastActive}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                        Live Test
                      </span>
                    </div>

                    {/* Test & Section Info */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Question Set:</span>
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {a.questionSetId?.name || "Untitled Set"}
                          </span>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {a.questionSetId?.category || "General"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Active Section:</span>
                          <span className="font-black text-blue-600 dark:text-blue-400">
                            {curSection}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Current Question:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            Viewing Q#{currentQ}
                          </span>
                        </div>
                      </div>

                      {/* Question Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-500 dark:text-slate-400">Answered Questions:</span>
                          <span className="text-slate-900 dark:text-white font-mono">{answeredCount} / {totalQ} ({answeredPct}%)</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(2, answeredPct))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section Timers Left Breakdown */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
                        {a.mockMode ? "Section Timers Remaining:" : "Time Remaining:"}
                      </span>

                      {a.mockMode && Array.isArray(a.sectionTimers) && a.sectionTimers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {a.sectionTimers.map((st) => {
                            const isCurrent = st.section === curSection;
                            const totalSec = st.durationSec || 1;
                            const leftSec = sectionTimersLeftMap[st.section] !== undefined
                              ? sectionTimersLeftMap[st.section]
                              : isCurrent ? (a.timeLeftSec ?? totalSec) : totalSec;
                            const isLocked = leftSec <= 0;

                            return (
                              <div
                                key={st.section}
                                className={`p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between ${
                                  isCurrent
                                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-xs"
                                    : isLocked
                                    ? "bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    {isCurrent && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />}
                                    <span className="font-bold truncate text-[11px]">{st.section}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {isCurrent ? "Active now" : isLocked ? "Completed/Locked" : "Pending"}
                                  </span>
                                </div>
                                <span className={`font-mono font-black text-xs shrink-0 ${
                                  isLocked ? "text-slate-400" : isCurrent ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"
                                }`}>
                                  {formatSec(leftSec)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Single Section Timer ({curSection}):
                          </span>
                          <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400">
                            {formatSec(a.timeLeftSec ?? a.timerDurationSec)} left
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                      <span className="text-[11px] text-slate-400">
                        Started {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {userObj._id && (
                          <Link
                            to={`/admin/evaluate/${userObj._id}`}
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 transition-colors flex items-center gap-1"
                            title="Open candidate full evaluation in new tab"
                          >
                            <span>Evaluate ↗</span>
                          </Link>
                        )}
                        <button
                          onClick={() => handleSuspendAttempt(a._id, a.questionSetId?.name || "Test")}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                          title="Suspend and finish this live exam session"
                        >
                          Suspend Test
                        </button>
                        <button
                          onClick={() => setConfirmModal({
                            open: true,
                            type: 'attempt',
                            id: a._id,
                            title: `attempt by @${userObj.username || 'unknown'}`
                          })}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          title="Delete stale or test attempt"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 1. Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading user records...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-semibold text-sm">No users match your criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Registered Date</th>
                    <th className="px-6 py-4 text-center">Sets Created</th>
                    <th className="px-6 py-4 text-center">Attempts Taken</th>
                    <th className="px-6 py-4 text-center">Avg Score</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredUsers.map(u => {
                    const isAdmin = u.role === "admin";
                    return (
                      <tr key={u._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Link
                              to={`/admin/evaluate/${u._id}`}
                              className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 dark:from-purple-600 dark:to-indigo-600 text-white font-bold flex items-center justify-center text-xs hover:scale-105 transition-transform"
                              title="Click to view candidate evaluation profile"
                            >
                              {(u.fullName || u.username).charAt(0).toUpperCase()}
                            </Link>
                            <div>
                              <Link 
                                to={`/admin/evaluate/${u._id}`}
                                className="font-bold text-slate-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors block"
                              >
                                {u.fullName || u.username}
                              </Link>
                              <div className="text-slate-400 font-mono text-[11px]">
                                @{u.username}
                              </div>
                              {u.categories && u.categories.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {u.categories.map(c => (
                                    <span key={c} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${
                            isAdmin 
                              ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" 
                              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                          }`}>
                            {u.role || "user"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">
                          {u.setsUploaded || 0}
                        </td>

                        <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">
                          {u.attemptsCount || 0}
                        </td>

                        <td className="px-6 py-4 text-center font-bold text-blue-600 dark:text-blue-400">
                          {u.avgScorePercent || 0}%
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/admin/evaluate/${u._id}`}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                              title="Open complete candidate evaluation page"
                            >
                              <span>Evaluate</span>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </Link>

                            <button
                              onClick={() => setConfirmModal({ 
                                isOpen: true, 
                                type: "user", 
                                id: u._id, 
                                title: u.fullName || u.username 
                              })}
                              className="p-1.5 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-lg"
                              title="Delete user"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* 2. Question Sets Audit Tab */}
      {activeTab === "sets" && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading question set audit records...</div>
          ) : filteredSets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-semibold text-sm">No question sets match your query.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-center">Questions</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredSets.map(s => (
                    <tr key={s._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">
                        {s.name}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600 dark:text-blue-400">
                        {s.questions?.length || 0} items
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReevaluateSet(s._id, s.name)}
                            disabled={reevaluatingSetId === s._id}
                            className="px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            title="Re-evaluate all attempts for this question set against latest answers"
                          >
                            {reevaluatingSetId === s._id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                <span>Re-evaluating...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Re-evaluate</span>
                              </>
                            )}
                          </button>
                          <Link 
                            to={`/edit-set/${s._id}`} 
                            className="px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              type: "set",
                              id: s._id,
                              title: s.name
                            })}
                            className="px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg"
                          >
                            Delete Set
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Attempts Audit Tab */}
      {activeTab === "attempts" && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading test attempt audit records...</div>
          ) : filteredAttempts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-semibold text-sm">No attempt history items match your search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Question Set</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Attempted Date</th>
                    <th className="px-6 py-4 text-center">Score</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredAttempts.map(a => {
                    const isCompleted = a.status === "completed";
                    return (
                      <tr key={a._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">
                          {a.questionSetId?.name || "Deleted Set"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md ${
                            isCompleted 
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" 
                              : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {new Date(a.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">
                          {a.scoreAtTimeUp} / {a.totalQuestions}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setConfirmModal({
                              isOpen: true,
                              type: "attempt",
                              id: a._id,
                              title: `Attempt for ${a.questionSetId?.name || 'Set'}`
                            })}
                            className="px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg"
                          >
                            Delete Record
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
