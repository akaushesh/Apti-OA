import { useEffect, useState, useMemo } from "react";
import API from "../api/axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";

const PRESETS = [5, 10, 15, 20, 30, 45];

export default function EditSet() {
  const { id } = useParams();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [defaultDurationMin, setDefaultDurationMin] = useState(15);
  const [sectionDurationsMin, setSectionDurationsMin] = useState({});
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    API.get(`/mcq/question-sets/${id}`)
      .then(res => {
        const set = res.data.data;
        setName(set.name);
        setCategory(set.category || "General");
        setDefaultDurationMin(set.defaultDurationMin || 15);
        setSectionDurationsMin(set.defaultSectionDurationsMin
          ? Object.fromEntries(Object.entries(set.defaultSectionDurationsMin))
          : {});
        
        const cleanQuestions = set.questions.map(q => {
          const { _id, ...rest } = q;
          return rest;
        });
        setText(JSON.stringify(cleanQuestions, null, 2));
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load question set");
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const parseResult = useMemo(() => {
    if (!text.trim()) return { valid: false, error: "JSON input is empty", questions: [], sections: [] };
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        return { valid: false, error: "Root element must be a JSON array [ ... ]", questions: [], sections: [] };
      }
      if (parsed.length === 0) {
        return { valid: false, error: "JSON array contains no questions", questions: [], sections: [] };
      }

      for (let i = 0; i < parsed.length; i++) {
        const q = parsed[i];
        if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
          return { 
            valid: false, 
            error: `Item #${i + 1} is missing required fields (questionText, optionA-D, correctAnswer)`, 
            questions: [], sections: []
          };
        }
        if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer?.toUpperCase())) {
          return {
            valid: false,
            error: `Item #${i + 1} has invalid correctAnswer "${q.correctAnswer}". Must be 'A', 'B', 'C', or 'D'`,
            questions: [], sections: []
          };
        }
      }

      const sections = [...new Set(parsed.map(q => q.section || '').filter(Boolean))];
      return { valid: true, error: null, questions: parsed, sections };
    } catch(err) {
      return { valid: false, error: `Syntax Error: ${err.message}`, questions: [], sections: [] };
    }
  }, [text]);

  // Sync sectionDurationsMin when sections change — preserve existing edits, seed new from default
  useEffect(() => {
    setSectionDurationsMin(prev => {
      const next = {};
      parseResult.sections.forEach(s => { next[s] = prev[s] ?? defaultDurationMin; });
      return next;
    });
  }, [parseResult.sections.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = async () => {
    if (!name.trim()) {
      return toast.error("Question set name is required");
    }
    if (!parseResult.valid) {
      return toast.error(parseResult.error || "Invalid JSON format");
    }

    setSaving(true);
    try {
      await API.put(`/mcq/question-sets/${id}`, { 
        name: name.trim(),
        category: category.trim() || "General",
        defaultDurationMin,
        defaultSectionDurationsMin: sectionDurationsMin,
        questions: parseResult.questions 
      });
      toast.success("Question set updated successfully!");
      navigate("/");
    } catch(err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to update question set");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/mcq/question-sets/${id}`);
      toast.success("Question set deleted");
      navigate("/");
    } catch(e) {
      toast.error(e?.response?.data?.message || "Failed to delete set");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center items-center p-6 text-slate-500 dark:text-slate-400">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm">Loading question set editor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Delete Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Question Set?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete this question set? This action cannot be undone and will permanently remove all associated test attempts.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-5 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all"
              >
                Delete Set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Question Management</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Edit Question Set
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowConfirm(true)} 
            className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition-colors"
          >
            Delete Set
          </button>
          <Link to="/" className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl">
            Cancel
          </Link>
        </div>
      </div>
      
      {/* Split Pane Editor & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form & Code */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Set Title
              </label>
              <input 
                type="text" 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-900 dark:text-white p-3 rounded-xl text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
                value={name} 
                onChange={e => setName(e.target.value)} 
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <input 
                type="text" 
                placeholder="e.g. Database Management" 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-900 dark:text-white p-3 rounded-xl text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
                value={category} 
                onChange={e => setCategory(e.target.value)} 
              />
            </div>

            {/* Validation Diagnostic Status */}
            <div className={`p-3.5 rounded-2xl mb-4 border text-xs font-semibold flex items-center justify-between transition-all ${
              parseResult.valid 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${parseResult.valid ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span>{parseResult.valid ? `Valid Format — ${parseResult.questions.length} questions detected${parseResult.sections.length > 0 ? `, ${parseResult.sections.length} section${parseResult.sections.length > 1 ? 's' : ''}` : ''}` : parseResult.error}</span>
              </div>
            </div>

            {/* Timer Defaults */}
            <div className="mb-5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                Default Timer
                <span className="ml-2 normal-case font-semibold text-slate-400">pre-fills TestConfig</span>
              </label>

              {parseResult.valid && parseResult.sections.length > 0 ? (
                <div className="space-y-2.5">
                  {parseResult.sections.map(sec => {
                    const qCount = parseResult.questions.filter(q => (q.section || '') === sec).length;
                    const val = sectionDurationsMin[sec] ?? defaultDurationMin;
                    return (
                      <div key={sec} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 truncate">
                            {sec}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">{qCount}q</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {[5, 10, 15, 20, 30].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setSectionDurationsMin(prev => ({ ...prev, [sec]: p }))}
                              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${
                                val === p
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                              }`}
                            >
                              {p}m
                            </button>
                          ))}
                          <div className="relative ml-1">
                            <input
                              type="number"
                              min="1"
                              max="180"
                              className="w-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 focus:border-blue-500 text-slate-900 dark:text-white p-1 pr-5 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500/20"
                              value={val}
                              onChange={e => setSectionDurationsMin(prev => ({ ...prev, [sec]: Math.max(1, Number(e.target.value)) }))}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Single-section default</span>
                      <div className="flex items-center gap-1 ml-auto">
                        {PRESETS.map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setDefaultDurationMin(p)}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${
                              defaultDurationMin === p
                                ? "bg-violet-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                            }`}
                          >
                            {p}m
                          </button>
                        ))}
                        <div className="relative ml-1">
                          <input
                            type="number"
                            min="1"
                            max="180"
                            className="w-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 focus:border-blue-500 text-slate-900 dark:text-white p-1 pr-5 rounded-lg text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500/20"
                            value={defaultDurationMin}
                            onChange={e => setDefaultDurationMin(Math.max(1, Number(e.target.value)))}
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-6 gap-1.5 mb-2">
                    {PRESETS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDefaultDurationMin(p)}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          defaultDurationMin === p
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600"
                        }`}
                      >
                        {p}m
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 focus:border-blue-500 text-slate-900 dark:text-white p-2.5 rounded-xl text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={defaultDurationMin}
                      onChange={e => setDefaultDurationMin(Math.max(1, Number(e.target.value)))}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">min</span>
                  </div>
                </>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                JSON Content Editor
              </label>
              <textarea 
                className="w-full bg-slate-900 text-emerald-400 p-4 rounded-2xl h-[420px] font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 custom-scrollbar-hide leading-relaxed" 
                value={text} 
                onChange={e => setText(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button 
              onClick={handleUpdate} 
              disabled={saving || !parseResult.valid}
              className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
            <button 
              onClick={() => navigate("/")} 
              className="py-3 px-6 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right Column: Dynamic Live Preview */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Live Question Preview
            </h2>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{parseResult.questions.length} questions</span>
          </div>

          {!parseResult.valid ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
              <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <p className="font-bold text-sm text-slate-600 dark:text-slate-400">Fix JSON format to see live question preview</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{parseResult.error}</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
              {parseResult.questions.map((q, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
                      Question {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/50">
                      Answer: Option {q.correctAnswer}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-3">{q.questionText}</h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['A', 'B', 'C', 'D'].map(opt => {
                      const isCorrect = q.correctAnswer?.toUpperCase() === opt;
                      return (
                        <div 
                          key={opt} 
                          className={`p-2.5 rounded-xl border font-medium flex items-center justify-between ${
                            isCorrect ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 font-bold' : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate"><strong className="mr-1.5 opacity-60">{opt}.</strong> {q[`option${opt}`]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
