import { useEffect, useState } from "react";
import API from "../api/axios";
import { Link, useNavigate } from "react-router-dom";
import authService from "../services/Auth";
import toast from "react-hot-toast";

export default function Dashboard() {
  const [sets, setSets] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'my-sets'
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return localStorage.getItem("dashboardSelectedCategory") || "All Categories";
  });
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, id: null });
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [setsRes, attemptsRes, userRes] = await Promise.all([
        API.get("/mcq/question-sets"),
        API.get("/mcq/attempts"),
        authService.getCurrentUser().catch(() => null)
      ]);
      setSets(setsRes.data.data || []);
      setAttempts(attemptsRes.data.data || []);
      if (userRes) setCurrentUser(userRes);
    } catch(err) {
      console.error(err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem("dashboardSelectedCategory", selectedCategory);
  }, [selectedCategory]);

  const confirmDelete = async () => {
    const { type, id } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, id: null });
    
    if (type === 'set') {
      try {
        await API.delete(`/mcq/question-sets/${id}`);
        toast.success("Question set deleted successfully");
        loadData();
      } catch(e) {
        toast.error(e?.response?.data?.message || "Failed to delete set");
      }
    } else if (type === 'attempt') {
      try {
        await API.delete(`/mcq/attempts/${id}`);
        toast.success("Attempt history deleted");
        loadData();
      } catch(e) {
        toast.error(e?.response?.data?.message || "Failed to delete attempt");
      }
    }
  };

  // Filter logic
  const categories = ["All Categories", ...new Set(sets.map(s => s.category || "General"))];

  const filteredSets = sets.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "my-sets" ? (currentUser && s.userId === currentUser._id) : true;
    const matchesCategory = selectedCategory === "All Categories" ? true : (s.category || "General") === selectedCategory;
    return matchesSearch && matchesTab && matchesCategory;
  });

  const filteredAttempts = attempts.filter(a => {
    const setName = a.questionSetId?.name || "";
    const matchesSearch = setName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All Categories" ? true : (a.questionSetId?.category || "General") === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate statistics
  const completedAttempts = attempts.filter(a => a.status === 'completed');
  const totalScorePercent = completedAttempts.length > 0 
    ? Math.round(completedAttempts.reduce((acc, curr) => acc + ((curr.scoreAtTimeUp / (curr.totalQuestions || 1)) * 100), 0) / completedAttempts.length)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {confirmModal.type === 'set' ? 'Delete Question Set?' : 'Delete Attempt History?'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              {confirmModal.type === 'set' 
                ? "Are you sure you want to delete this question set? This will permanently remove the set and all associated practice attempt history."
                : "Are you sure you want to permanently delete this attempt history record?"}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, type: null, id: null })}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-5 py-2.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div>
          <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">Dashboard Overview</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
            Welcome back, {currentUser?.fullName || currentUser?.username || 'Learner'}! 👋
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            Track your aptitude test performance, attempt available practice sets, or manage system records via the open admin panel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link 
            to="/admin" 
            className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-3 rounded-xl shadow-lg shadow-purple-600/25 transition-all active:scale-95 text-sm"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Admin Panel
          </Link>
          <Link 
            to="/upload" 
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Upload Practice Set
          </Link>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Available Sets</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{sets.length}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">question banks</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Attempts</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{attempts.length}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">tests taken</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Completed</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{completedAttempts.length}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">submits</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Avg Accuracy</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">{totalScorePercent}%</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">avg score</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search practice sets or attempt history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
          />
        </div>

        <div className="shrink-0 flex items-center">
          <select 
            value={selectedCategory} 
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          <button 
            onClick={() => setActiveTab("all")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "all" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All Question Sets ({sets.length})
          </button>
          <button 
            onClick={() => setActiveTab("my-sets")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "my-sets" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            My Uploads ({sets.filter(s => currentUser && s.userId === currentUser._id).length})
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Practice Sets Column */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              Available Practice Sets
            </h2>
            <span className="text-xs font-semibold text-slate-400">{filteredSets.length} sets</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse h-20" />
              ))}
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm">No practice sets found</p>
              <p className="text-slate-400 text-xs mt-1">Try tweaking your search term or upload a new set.</p>
              <Link to="/upload" className="inline-block mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                + Upload a new set now
              </Link>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredSets.map(s => {
                const isOwner = currentUser && currentUser._id === s.userId;
                return (
                  <div 
                    key={s._id} 
                    className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {s.name}
                        </h3>
                        {isOwner && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200/50 dark:border-blue-800/50 shrink-0">
                            Mine
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md font-semibold text-slate-600 dark:text-slate-300">{s.category || "General"}</span>
                        <span>• Created {new Date(s.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && (
                        <button 
                          onClick={() => navigate(`/edit-set/${s._id}`)} 
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                          title="Edit set"
                        >
                          Edit
                        </button>
                      )}
                      <button 
                        onClick={() => navigate(`/test-config/${s._id}`)} 
                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs shadow-blue-600/20 transition-all"
                      >
                        Start Test
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History Column */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Your Attempt History
            </h2>
            <span className="text-xs font-semibold text-slate-400">{filteredAttempts.length} history items</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse h-20" />
              ))}
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm">No test attempts yet</p>
              <p className="text-slate-400 text-xs mt-1">Select a practice set on the left to start your first assessment!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredAttempts.map(a => {
                const isCompleted = a.status === 'completed';
                const scorePercent = Math.round((a.scoreAtTimeUp / (a.totalQuestions || 1)) * 100);

                return (
                  <div 
                    key={a._id} 
                    className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">
                        {a.questionSetId?.name || "Deleted Set"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider ${
                          isCompleted 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {a.status}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          Score: {a.scoreAtTimeUp} / {a.totalQuestions} ({scorePercent}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmModal({ isOpen: true, type: 'attempt', id: a._id })}
                        className="p-1.5 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                        title="Delete attempt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      {isCompleted ? (
                        <Link 
                          to={`/review/${a._id}`} 
                          className="px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition-colors"
                        >
                          Review Answers
                        </Link>
                      ) : (
                        <button 
                          onClick={() => navigate(`/attempt/${a._id}`)} 
                          className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 rounded-xl shadow-xs shadow-amber-500/20 transition-all"
                        >
                          Resume Test
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
