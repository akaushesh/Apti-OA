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
  const filteredSets = sets.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "my-sets" ? (currentUser && s.userId === currentUser._id) : true;
    return matchesSearch && matchesTab;
  });

  const filteredAttempts = attempts.filter(a => {
    const setName = a.questionSetId?.name || "";
    return setName.toLowerCase().includes(searchTerm.toLowerCase());
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {confirmModal.type === 'set' ? 'Delete Question Set?' : 'Delete Attempt History?'}
            </h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              {confirmModal.type === 'set' 
                ? "Are you sure you want to delete this question set? This will permanently remove the set and all associated practice attempt history."
                : "Are you sure you want to permanently delete this attempt history record?"}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, type: null, id: null })}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
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
            Track your aptitude test performance, attempt available practice sets, or upload custom question banks.
          </p>
        </div>
        <Link 
          to="/upload" 
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Upload Practice Set
        </Link>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Sets</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{sets.length}</span>
            <span className="text-xs font-medium text-slate-500">question banks</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Attempts</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{attempts.length}</span>
            <span className="text-xs font-medium text-slate-500">tests taken</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">{completedAttempts.length}</span>
            <span className="text-xs font-medium text-slate-500">submits</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Accuracy</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-600">{totalScorePercent}%</span>
            <span className="text-xs font-medium text-slate-500">avg score</span>
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
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xs"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl shrink-0">
          <button 
            onClick={() => setActiveTab("all")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Question Sets ({sets.length})
          </button>
          <button 
            onClick={() => setActiveTab("my-sets")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "my-sets" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
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
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              Available Practice Sets
            </h2>
            <span className="text-xs font-semibold text-slate-400">{filteredSets.length} sets</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 animate-pulse h-20" />
              ))}
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-600 font-semibold text-sm">No practice sets found</p>
              <p className="text-slate-400 text-xs mt-1">Try tweaking your search term or upload a new set.</p>
              <Link to="/upload" className="inline-block mt-4 text-xs font-bold text-blue-600 hover:underline">
                + Upload a new set now
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSets.map(s => {
                const isOwner = currentUser && currentUser._id === s.userId;
                return (
                  <div 
                    key={s._id} 
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {s.name}
                        </h3>
                        {isOwner && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-md border border-blue-200/50 shrink-0">
                            Mine
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-2">
                        <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && (
                        <button 
                          onClick={() => navigate(`/edit-set/${s._id}`)} 
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Your Attempt History
            </h2>
            <span className="text-xs font-semibold text-slate-400">{filteredAttempts.length} history items</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 animate-pulse h-20" />
              ))}
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-600 font-semibold text-sm">No test attempts yet</p>
              <p className="text-slate-400 text-xs mt-1">Select a practice set on the left to start your first assessment!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAttempts.map(a => {
                const isCompleted = a.status === 'completed';
                const scorePercent = Math.round((a.scoreAtTimeUp / (a.totalQuestions || 1)) * 100);

                return (
                  <div 
                    key={a._id} 
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 truncate">
                        {a.questionSetId?.name || "Deleted Set"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider ${
                          isCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {a.status}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          Score: {a.scoreAtTimeUp} / {a.totalQuestions} ({scorePercent}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmModal({ isOpen: true, type: 'attempt', id: a._id })}
                        className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                        title="Delete attempt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      {isCompleted ? (
                        <Link 
                          to={`/review/${a._id}`} 
                          className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
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
