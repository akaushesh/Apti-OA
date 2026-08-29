import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function ReviewScreen() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    API.get(`/mcq/attempts/${id}`)
      .then(res => {
        setAttempt(res.data.data);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load attempt review");
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleDelete = async () => {
    try {
      await API.delete(`/mcq/attempts/${id}`);
      toast.success("Attempt history deleted");
      navigate("/");
    } catch(e) {
      toast.error("Failed to delete attempt history");
    }
  };

  if (loading || !attempt) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center items-center p-6 text-slate-500 dark:text-slate-400">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm">Loading test performance review...</p>
      </div>
    );
  }

  const qs = attempt.questionSetId || {};
  const totalQuestions = attempt.totalQuestions || qs.questions?.length || 0;

  const ansMap = {};
  if (attempt.answers) {
    attempt.answers.forEach(a => {
      ansMap[a.questionId] = { option: a.selectedOption, isUntimed: a.isUntimed };
    });
  }

  let countCorrect = 0;
  let countIncorrect = 0;
  let countSkipped = 0;
  let countUntimed = 0;

  const processedQuestions = qs.questions?.map((q) => {
    const ans = ansMap[q._id] || {};
    const selected = ans.option;
    const isCorrect = selected === q.correctAnswer;
    const isSkipped = !selected;
    const isUntimed = ans.isUntimed;

    if (isSkipped) countSkipped++;
    else if (isCorrect) countCorrect++;
    else countIncorrect++;

    if (isUntimed && !isSkipped) countUntimed++;

    return { ...q, selected, isCorrect, isSkipped, isUntimed };
  }) || [];

  const filteredQuestions = processedQuestions.filter(q => {
    if (filter === "all") return true;
    if (filter === "correct") return q.isCorrect && !q.isSkipped;
    if (filter === "incorrect") return !q.isCorrect && !q.isSkipped;
    if (filter === "skipped") return q.isSkipped;
    if (filter === "untimed") return q.isUntimed && !q.isSkipped;
    return true;
  });

  const accuracyPercent = totalQuestions > 0 ? Math.round((countCorrect / totalQuestions) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Delete Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Attempt Record?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to permanently delete this attempt history record?
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
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Performance Assessment</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Review Practice Results
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowConfirm(true)} 
            className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition-colors"
          >
            Delete Record
          </button>
          <Link 
            to="/" 
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded-xl shadow-sm transition-all"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
      
      {/* Top Performance Analytics Banner */}
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
        <div className="flex-1">
          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">
            Question Bank
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{qs.name || "Question Set"}</h2>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1">
            Attempted on {new Date(attempt.createdAt).toLocaleString()}
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-6 text-xs font-bold">
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Correct: {countCorrect}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-3 py-1.5 rounded-xl border border-rose-200/50 dark:border-rose-800/50">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Incorrect: {countIncorrect}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Skipped: {countSkipped}</span>
            </div>
            {countUntimed > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-200/50 dark:border-amber-800/50">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Untimed: {countUntimed}</span>
              </div>
            )}
          </div>
        </div>

        {/* Big Score Card */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-center min-w-[200px] flex flex-col items-center justify-center">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Overall Accuracy</span>
          <div className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400">
            {attempt.scoreAtTimeUp} <span className="text-xl text-slate-400 dark:text-slate-500 font-bold">/ {totalQuestions}</span>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {accuracyPercent}% Accuracy Rate
          </span>
          {attempt.finalScoreIfUntimed > attempt.scoreAtTimeUp && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-bold bg-amber-100/60 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
              Untimed Score: {attempt.finalScoreIfUntimed}
            </p>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar-hide">
        {[
          { key: 'all', label: `All (${processedQuestions.length})` },
          { key: 'correct', label: `Correct (${countCorrect})` },
          { key: 'incorrect', label: `Incorrect (${countIncorrect})` },
          { key: 'skipped', label: `Skipped (${countSkipped})` },
          { key: 'untimed', label: `Untimed (${countUntimed})` },
        ].map(f => (
          <button 
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filter === f.key 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Questions Breakdown List */}
      <div className="space-y-6">
        {filteredQuestions.map((q) => {
          const originalIdx = qs.questions?.findIndex(orig => orig._id === q._id);

          return (
            <div key={q._id} className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
              
              {/* Question Header & Status Badge */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg leading-relaxed">
                  <span className="text-slate-400 dark:text-slate-500 mr-2 font-mono">Q{originalIdx !== undefined && originalIdx >= 0 ? originalIdx + 1 : ''}.</span> 
                  {q.questionText}
                </h3>
                <div className="shrink-0 flex items-center gap-2">
                  {!q.isSkipped && q.isUntimed && (
                    <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
                      Untimed
                    </span>
                  )}
                  {q.isSkipped ? (
                    <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-600">
                      Skipped
                    </span>
                  ) : q.isCorrect ? (
                    <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Correct
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
                      Incorrect
                    </span>
                  )}
                </div>
              </div>
              
              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {['A', 'B', 'C', 'D'].map(opt => {
                  const isSelectedOpt = q.selected === opt;
                  const isCorrectOpt = q.correctAnswer === opt;
                  
                  let optStyle = "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300";
                  if (isCorrectOpt) {
                    optStyle = "bg-emerald-50/90 dark:bg-emerald-950/80 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100 font-semibold ring-1 ring-emerald-400";
                  } else if (isSelectedOpt && !isCorrectOpt) {
                    optStyle = "bg-rose-50/90 dark:bg-rose-950/80 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-100 font-semibold ring-1 ring-rose-300";
                  }

                  return (
                    <div key={opt} className={`p-4 rounded-2xl border text-sm flex items-center justify-between transition-all ${optStyle}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCorrectOpt 
                            ? 'bg-emerald-600 text-white' 
                            : isSelectedOpt 
                            ? 'bg-rose-600 text-white' 
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {opt}
                        </span>
                        <span>{q[`option${opt}`]}</span>
                      </div>

                      {isCorrectOpt && (
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                          Correct Answer
                        </span>
                      )}
                      {isSelectedOpt && !isCorrectOpt && (
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md">
                          Your Choice
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}

        {filteredQuestions.length === 0 && (
          <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-sm">
            No questions match the selected "{filter}" filter.
          </div>
        )}
      </div>

    </div>
  );
}
