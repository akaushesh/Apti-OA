import { useEffect, useState } from "react";
import API from "../api/axios";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [questionSets, setQuestionSets] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("users"); // 'users' | 'sets' | 'attempts'
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, id: null, title: "" });
  const [detailModal, setDetailModal] = useState({ isOpen: false, loading: false, data: null });

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [usersRes, analyticsRes, setsRes, attemptsRes] = await Promise.all([
        API.get("/users/admin/users"),
        API.get("/users/admin/analytics"),
        API.get("/mcq/question-sets"),
        API.get("/mcq/attempts")
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

  const handleToggleRole = async (userId, currentRole) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      await API.patch(`/users/admin/users/${userId}/role`, { role: newRole });
      toast.success(`User role updated to ${newRole.toUpperCase()}`);
      loadAdminData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update user role");
    }
  };

  const handleOpenUserDetails = async (userId) => {
    setDetailModal({ isOpen: true, loading: true, data: null });
    try {
      const res = await API.get(`/users/admin/users/${userId}/details`);
      setDetailModal({ isOpen: true, loading: false, data: res.data.data });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to fetch user details");
      setDetailModal({ isOpen: false, loading: false, data: null });
    }
  };

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

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.username || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" ? true : u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Filter sets
  const filteredSets = questionSets.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter attempts
  const filteredAttempts = attempts.filter(a => 
    (a.questionSetId?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* User Full Detail Modal */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-3xl w-full border border-slate-100 dark:border-slate-700 max-h-[90vh] flex flex-col my-auto animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md">
                  {(detailModal.data?.user?.fullName || detailModal.data?.user?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    {detailModal.data?.user?.fullName || detailModal.data?.user?.username || 'Loading User...'}
                    {detailModal.data?.user?.role && (
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md ${
                        detailModal.data.user.role === 'admin' 
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' 
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {detailModal.data.user.role}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    @{detailModal.data?.user?.username} • ID: {detailModal.data?.user?._id}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDetailModal({ isOpen: false, loading: false, data: null })}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {detailModal.loading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <span>Fetching complete user records...</span>
              </div>
            ) : detailModal.data ? (
              <div className="py-6 overflow-y-auto space-y-6 flex-1 pr-1 custom-scrollbar-hide">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Question Sets</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {detailModal.data.stats?.totalSets || 0}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Attempts</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                      {detailModal.data.stats?.totalAttempts || 0}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed</span>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {detailModal.data.stats?.completedAttempts || 0}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Avg Accuracy</span>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                      {detailModal.data.stats?.avgScorePercent || 0}%
                    </p>
                  </div>
                </div>

                {/* Account Details Box */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5 font-medium text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Account Registered:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {new Date(detailModal.data.user.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Profile Update:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {new Date(detailModal.data.user.updatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Uploaded Question Sets Section */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                    Uploaded Question Sets ({detailModal.data.questionSets?.length || 0})
                  </h4>
                  {detailModal.data.questionSets?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No question sets uploaded by this user.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailModal.data.questionSets.map(s => (
                        <div key={s._id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{s.name}</span>
                            <p className="text-slate-400 text-[11px] mt-0.5">{s.questions?.length || 0} questions • Added {new Date(s.createdAt).toLocaleDateString()}</p>
                          </div>
                          <Link 
                            to={`/edit-set/${s._id}`} 
                            onClick={() => setDetailModal({ isOpen: false, loading: false, data: null })}
                            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg font-bold hover:underline"
                          >
                            View / Edit
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Practice Attempt History Section */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                    Test Attempt History ({detailModal.data.attempts?.length || 0})
                  </h4>
                  {detailModal.data.attempts?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No practice attempts taken by this user.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailModal.data.attempts.map(a => {
                        const isCompleted = a.status === 'completed';
                        return (
                          <div key={a._id} className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {a.questionSetId?.name || "Deleted Set"}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded ${
                                  isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {a.status}
                                </span>
                                <span className="text-slate-500 font-semibold">
                                  Score: {a.scoreAtTimeUp}/{a.totalQuestions}
                                </span>
                                <span className="text-slate-400 text-[11px]">
                                  • {new Date(a.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            {isCompleted && (
                              <Link 
                                to={`/review/${a._id}`} 
                                onClick={() => setDetailModal({ isOpen: false, loading: false, data: null })}
                                className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg font-bold hover:underline"
                              >
                                Review
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
              <button
                onClick={() => setDetailModal({ isOpen: false, loading: false, data: null })}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs rounded-xl hover:bg-slate-800"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

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
        <div className="flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl shrink-0">
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
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="user">Users Only</option>
              <option value="admin">Admins Only</option>
            </select>
          )}
        </div>

      </div>

      {/* Tab Content Sections */}

      {/* 1. Users Tab */}
      {activeTab === "users" && (
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
                            <button
                              onClick={() => handleOpenUserDetails(u._id)}
                              className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 dark:from-purple-600 dark:to-indigo-600 text-white font-bold flex items-center justify-center text-xs hover:scale-105 transition-transform"
                              title="Click to view user details"
                            >
                              {(u.fullName || u.username).charAt(0).toUpperCase()}
                            </button>
                            <div>
                              <button 
                                onClick={() => handleOpenUserDetails(u._id)}
                                className="font-bold text-slate-900 dark:text-white text-sm hover:text-purple-600 dark:hover:text-purple-400 text-left transition-colors"
                              >
                                {u.fullName || u.username}
                              </button>
                              <div className="text-slate-400 font-mono text-[11px]">
                                @{u.username}
                              </div>
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
                            <button
                              onClick={() => handleOpenUserDetails(u._id)}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                            >
                              View Details
                            </button>

                            <button
                              onClick={() => handleToggleRole(u._id, u.role)}
                              className="px-3 py-1 rounded-lg text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
                            >
                              {isAdmin ? "Demote" : "Promote"}
                            </button>

                            <button
                              onClick={() => setConfirmModal({ 
                                isOpen: true, 
                                type: "user", 
                                id: u._id, 
                                title: u.fullName || u.username 
                              })}
                              className="p-1.5 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
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
