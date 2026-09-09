import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";
import ScoreTrendChart from "../components/ScoreTrendChart";

export default function UserEvaluation() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchAttempt, setSearchAttempt] = useState("");

  // Suspend modal state
  const [suspendModal, setSuspendModal] = useState({ open: false, attemptId: null, testName: "", reason: "" });
  const [suspending, setSuspending] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, id: null, title: "" });
  const [reevaluatingId, setReevaluatingId] = useState(null);

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get(`/users/admin/users/${userId}/details`);
      setUserData(res.data.data || null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load candidate evaluation data");
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  }, [userId, navigate]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleToggleRole = async (targetRole) => {
    const newRole = targetRole === "admin" ? "user" : "admin";
    try {
      await API.patch(`/users/admin/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      fetchUserData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleSuspendAttempt = async () => {
    if (!suspendModal.attemptId) return;
    setSuspending(true);
    try {
      await API.post(`/mcq/attempts/${suspendModal.attemptId}/suspend`, {
        reason: suspendModal.reason || "Suspended by exam administrator"
      });
      toast.success("Attempt has been suspended");
      setSuspendModal({ open: false, attemptId: null, testName: "", reason: "" });
      fetchUserData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to suspend test");
    } finally {
      setSuspending(false);
    }
  };

  const handleConfirmDelete = async () => {
    const { type, id } = deleteModal;
    setDeleteModal({ open: false, type: null, id: null, title: "" });

    try {
      if (type === "attempt") {
        await API.delete(`/mcq/attempts/${id}`);
        toast.success("Attempt history deleted");
        fetchUserData();
      } else if (type === "user") {
        await API.delete(`/users/admin/users/${id}`);
        toast.success("User account deleted");
        navigate("/admin");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to execute delete");
    }
  };

  const handleReevaluateSet = async (setId, setName) => {
    setReevaluatingId(setId);
    try {
      const res = await API.post(`/mcq/question-sets/${setId}/reevaluate`);
      toast.success(res.data?.message || `Re-evaluated attempts for ${setName}`);
      fetchUserData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to re-evaluate");
    } finally {
      setReevaluatingId(null);
    }
  };

  // Filter attempts based on category, status, and search query
  const filteredAttempts = useMemo(() => {
    if (!userData?.attempts) return [];
    return userData.attempts.filter(a => {
      const cat = a.questionSetId?.category || "General";
      const matchCat = selectedCategory === "all" || cat.toLowerCase() === selectedCategory.toLowerCase();
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      const matchSearch = !searchAttempt || 
        (a.questionSetId?.name || "").toLowerCase().includes(searchAttempt.toLowerCase()) ||
        cat.toLowerCase().includes(searchAttempt.toLowerCase());
      return matchCat && matchStatus && matchSearch;
    });
  }, [userData?.attempts, selectedCategory, statusFilter, searchAttempt]);

  if (loading || !userData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">Loading Candidate Evaluation Profile...</p>
      </div>
    );
  }

  const user = userData.user || {};
  const stats = userData.stats || {};
  const categoryBreakdown = userData.categoryBreakdown || [];
  const completedAttempts = (userData.attempts || []).filter(a => a.status === "completed");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            <Link to="/admin" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
              <span>←</span> Admin Panel
            </Link>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300">Candidate Evaluation</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-xl flex items-center justify-center shadow-md">
              {(user.fullName || user.username || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {user.fullName || user.username}
                </h1>
                <span className={`px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider rounded-md ${
                  user.role === "admin"
                    ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}>
                  {user.role || "user"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                @{user.username} • User ID: {user._id}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleToggleRole(user.role)}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            {user.role === "admin" ? "Demote to Candidate" : "Promote to Admin"}
          </button>
          <button
            onClick={() => setDeleteModal({
              open: true,
              type: "user",
              id: user._id,
              title: user.fullName || user.username
            })}
            className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800/80 transition-all"
          >
            Delete User Account
          </button>
        </div>
      </div>

      {/* Global Performance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Attempts</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {stats.totalAttempts || 0}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">
            {stats.completedAttempts || 0} completed
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Average Score</span>
          <span className={`text-2xl sm:text-3xl font-black ${
            (stats.avgScorePercent || 0) >= 70 ? "text-emerald-600 dark:text-emerald-400" :
            (stats.avgScorePercent || 0) >= 45 ? "text-blue-600 dark:text-blue-400" :
            "text-amber-600 dark:text-amber-400"
          }`}>
            {stats.avgScorePercent || 0}%
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Across all tests</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Sets Created</span>
          <span className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {userData.questionSets?.length || 0}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Uploaded sets</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Categories</span>
          <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
            {categoryBreakdown.length}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Tested areas</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Joined Date</span>
          <span className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300 block">
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">
            Active: {new Date(user.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Category-Wise Performance Evaluation Matrix */}
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>🎯</span> Category-Wise Performance Breakdown
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive evaluation of candidate aptitude across different subject domains
            </p>
          </div>
          {selectedCategory !== "all" && (
            <button
              onClick={() => setSelectedCategory("all")}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold self-start hover:bg-slate-200 transition-colors"
            >
              Reset Category Filter
            </button>
          )}
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No test attempt categories recorded yet for this candidate.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryBreakdown.map(cat => {
              const isSelected = selectedCategory.toLowerCase() === cat.category.toLowerCase();
              const scorePct = cat.avgScorePercent || 0;
              const colorClass = 
                scorePct >= 75 ? "emerald" :
                scorePct >= 50 ? "blue" :
                scorePct >= 35 ? "amber" : "rose";

              return (
                <div
                  key={cat.category}
                  onClick={() => setSelectedCategory(isSelected ? "all" : cat.category)}
                  className={`cursor-pointer p-5 rounded-2xl border transition-all ${
                    isSelected
                      ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-sm"
                      : "bg-slate-50/60 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {cat.category}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-mono font-black rounded-lg ${
                      colorClass === "emerald" ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" :
                      colorClass === "blue" ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300" :
                      colorClass === "amber" ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300" :
                      "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                    }`}>
                      {scorePct}% Avg
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${
                        colorClass === "emerald" ? "bg-emerald-500" :
                        colorClass === "blue" ? "bg-blue-500" :
                        colorClass === "amber" ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(3, scorePct))}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Attempts</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{cat.totalAttempts} ({cat.completedAttempts} done)</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Peak Score</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{cat.highestScore}%</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-slate-400">Accuracy</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{cat.accuracyPercent}%</span>
                    </div>
                  </div>

                  <div className="mt-3 text-right">
                    <span className={`text-[10px] font-bold ${
                      isSelected ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-400"
                    }`}>
                      {isSelected ? "✓ Filtered (click to reset)" : "Click to view trendline & attempts ↓"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate Score Trendline Chart */}
      <ScoreTrendChart
        completedAttempts={completedAttempts}
        selectedCategory={selectedCategory === "all" ? "All Categories" : selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat === "All Categories" ? "all" : cat)}
        onResetCategory={() => setSelectedCategory("all")}
        categories={categoryBreakdown.map(c => c.category)}
        title={`Score Trendline • ${user.fullName || user.username}`}
        subtitle={`Chronological score progression ${selectedCategory !== "all" ? `in "${selectedCategory}"` : "across all categories"}`}
      />

      {/* Candidate Question Sets Created Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-7 shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700/60 mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>📚</span> Question Sets Created ({userData.questionSets?.length || 0})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              MCQ assessment sets authored and uploaded by this user
            </p>
          </div>
        </div>

        {(!userData.questionSets || userData.questionSets.length === 0) ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No question sets authored or created by this candidate yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userData.questionSets.map(s => (
              <div
                key={s._id}
                className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1" title={s.name}>
                      {s.name}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shrink-0">
                      {s.category || "General"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>{s.questions?.length || 0} Questions</span>
                    {s.defaultDurationMin && <span>• {s.defaultDurationMin} mins</span>}
                    <span>• {new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                  <Link
                    to={`/edit-set/${s._id}`}
                    className="flex-1 text-center py-1.5 px-3 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-colors"
                  >
                    Edit / View Set
                  </Link>
                  <button
                    onClick={() => handleReevaluateSet(s._id, s.name)}
                    disabled={reevaluatingId === s._id}
                    className="py-1.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {reevaluatingId === s._id ? "Re-scoring..." : "Re-evaluate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deep-Dive Test Attempts Evaluation List */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-7 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>📋</span> All Test Attempts ({filteredAttempts.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review full test details, question-by-question responses, or moderate ongoing sessions
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <input
              type="text"
              placeholder="Search tests..."
              value={searchAttempt}
              onChange={(e) => setSearchAttempt(e.target.value)}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40 sm:w-48"
            />

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categoryBreakdown.map(c => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In-Progress (Active)</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No test attempts match the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {filteredAttempts.map(a => {
              const qs = a.questionSetId || {};
              const totalQ = a.totalQuestions || 1;
              const timedScore = a.scoreAtTimeUp || 0;
              const timedPct = Math.round((timedScore / totalQ) * 100);
              const untimedScore = a.finalScoreIfUntimed || 0;
              const untimedPct = Math.round((untimedScore / totalQ) * 100);
              const isInProgress = a.status === "in-progress";

              return (
                <div key={a._id} className="p-5 sm:p-6 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        {qs.name || "Deleted Question Set"}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {qs.category || "General"}
                      </span>
                      {a.mockMode && (
                        <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Mock OA
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md ${
                        a.suspendReason ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800" :
                        a.status === "completed" ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" :
                        "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-pulse"
                      }`}>
                        {a.suspendReason ? "Suspended (Finished)" : a.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>Started: {new Date(a.createdAt).toLocaleString()}</span>
                      {a.updatedAt && a.status === "completed" && (
                        <span>• Finished: {new Date(a.updatedAt).toLocaleTimeString()}</span>
                      )}
                      {a.userOS && (
                        <span>• Device: {a.userOS} {a.userBrowser ? `(${a.userBrowser})` : ""}</span>
                      )}
                    </div>

                    {a.suspendReason && (
                      <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50/60 dark:bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 inline-block">
                        ⚠️ Reason for suspension: {a.suspendReason}
                      </div>
                    )}
                  </div>

                  {/* Right side: Scores & Actions */}
                  <div className="flex flex-wrap items-center gap-4 justify-between md:justify-end shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-slate-400">Score:</span>
                        <span className={`text-base font-black font-mono ${
                          timedPct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                          timedPct >= 40 ? "text-blue-600 dark:text-blue-400" :
                          "text-amber-600 dark:text-amber-400"
                        }`}>
                          {timedScore} / {totalQ} ({timedPct}%)
                        </span>
                      </div>
                      {untimedScore !== timedScore && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Untimed: {untimedScore}/{totalQ} ({untimedPct}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Review Link */}
                      <Link
                        to={`/review/${a._id}`}
                        target="_blank"
                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        title="Open full question-by-question candidate evaluation in new tab"
                      >
                        <span>Full Review</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>

                      {/* Suspend Button */}
                      {isInProgress && !a.suspendReason && (
                        <button
                          onClick={() => setSuspendModal({
                            open: true,
                            attemptId: a._id,
                            testName: qs.name || "Test",
                            reason: ""
                          })}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                          title="Suspend and complete this candidate's live test attempt"
                        >
                          Suspend Test
                        </button>
                      )}

                      {/* Reevaluate Button */}
                      {qs._id && (
                        <button
                          onClick={() => handleReevaluateSet(qs._id, qs.name)}
                          disabled={reevaluatingId === qs._id}
                          className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold transition-colors"
                          title="Re-evaluate scores against answer key"
                        >
                          {reevaluatingId === qs._id ? "Re-scoring..." : "Re-evaluate"}
                        </button>
                      )}

                      {/* Delete Attempt */}
                      <button
                        onClick={() => setDeleteModal({
                          open: true,
                          type: "attempt",
                          id: a._id,
                          title: `attempt for ${qs.name || 'Test'}`
                        })}
                        className="p-1.5 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete attempt record"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suspend Modal */}
      {suspendModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/60 text-rose-600 rounded-2xl flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Suspend Ongoing Test?
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {suspendModal.testName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              The candidate will be instantly locked out of the exam session. They cannot submit further answers until resumed.
            </p>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Reason for suspension (optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Unfair means suspected, tab switching, time expired"
                value={suspendModal.reason}
                onChange={(e) => setSuspendModal(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setSuspendModal({ open: false, attemptId: null, testName: "", reason: "" })}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendAttempt}
                disabled={suspending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-60"
              >
                {suspending ? "Suspending..." : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Delete {deleteModal.type === "user" ? "Candidate Account" : "Attempt Record"}?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete <span className="font-bold text-slate-900 dark:text-white">{deleteModal.title}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModal({ open: false, type: null, id: null, title: "" })}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
