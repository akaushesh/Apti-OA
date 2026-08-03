import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function AttemptScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [qs, setQs] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currIdx, setCurrIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [timeUp, setTimeUp] = useState(false);
  const [untimedMode, setUntimedMode] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMobileGrid, setShowMobileGrid] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    API.get(`/mcq/attempts/${id}`)
      .then(res => {
        const a = res.data.data;
        setAttempt(a);
        setTimeLeft(a.timerDurationSec || 600);
        
        const savedAns = {};
        if (a.answers) {
          a.answers.forEach(ans => {
            savedAns[ans.questionId] = { 
              option: ans.selectedOption, 
              isUntimed: ans.isUntimed || false 
            };
          });
        }
        setAnswers(savedAns);

        const setId = a.questionSetId?._id || a.questionSetId;
        return API.get(`/mcq/question-sets/${setId}`);
      })
      .then(res2 => {
        setQs(res2.data.data);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load test attempt");
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (timeLeft > 0 && !timeUp && !untimedMode) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && attempt && !timeUp && !untimedMode) {
      handleTimeUp();
    }
  }, [timeLeft, timeUp, attempt, untimedMode]);

  const handleTimeUp = async () => {
    setTimeUp(true);
    toast.error("Time is up! Your timed attempt has concluded.", { duration: 5000 });
    await saveProgress(true);
  };

  const saveProgress = async (isSubmit = false) => {
    if (!qs || !attempt) return;
    setSaving(true);

    let score = 0;
    const ansArray = Object.keys(answers).map(qId => {
      const q = qs.questions.find(x => x._id === qId);
      const selected = answers[qId].option;
      if (q && q.correctAnswer === selected) score++;
      return { questionId: qId, selectedOption: selected, isUntimed: answers[qId].isUntimed };
    });

    try {
      await API.patch(`/mcq/attempts/${id}`, {
        answers: ansArray,
        scoreAtTimeUp: !untimedMode ? score : attempt.scoreAtTimeUp,
        finalScoreIfUntimed: score,
        status: isSubmit ? 'completed' : 'in-progress'
      });
      if (!isSubmit) {
        toast.success("Progress saved", { duration: 1500 });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save progress");
    } finally {
      setSaving(false);
    }
  };

  const handleOptionSelect = (opt) => {
    if (!qs || !qs.questions[currIdx]) return;
    const qId = qs.questions[currIdx]._id;
    setAnswers(prev => ({
      ...prev, 
      [qId]: { option: opt, isUntimed: untimedMode }
    }));
  };

  const toggleMarkForReview = () => {
    if (!qs || !qs.questions[currIdx]) return;
    const qId = qs.questions[currIdx]._id;
    setMarkedForReview(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleKeyDown = useCallback((e) => {
    if (showSubmitModal || timeUp) return;
    
    if (e.key === 'ArrowRight') {
      if (qs && currIdx < qs.questions.length - 1) setCurrIdx(prev => prev + 1);
    } else if (e.key === 'ArrowLeft') {
      if (currIdx > 0) setCurrIdx(prev => prev - 1);
    } else if (['a', 'A', '1'].includes(e.key)) {
      handleOptionSelect('A');
    } else if (['b', 'B', '2'].includes(e.key)) {
      handleOptionSelect('B');
    } else if (['c', 'C', '3'].includes(e.key)) {
      handleOptionSelect('C');
    } else if (['d', 'D', '4'].includes(e.key)) {
      handleOptionSelect('D');
    } else if (['m', 'M'].includes(e.key)) {
      toggleMarkForReview();
    }
  }, [qs, currIdx, showSubmitModal, timeUp, answers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading || !qs || !attempt) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-semibold text-slate-300">Loading exam interface...</p>
      </div>
    );
  }

  const currentQ = qs.questions[currIdx];
  const totalQuestions = qs.questions.length;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isLowTime = timeLeft < 120 && !untimedMode;

  const answeredCount = Object.values(answers).filter(v => v.option).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">
      
      {/* Top Examination Header */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-md shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => setShowMobileGrid(!showMobileGrid)}
            className="md:hidden p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg"
            title="Question Map"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
              {qs.name}
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Question {currIdx + 1} of {totalQuestions}
            </span>
          </div>
        </div>

        {/* Timer Display */}
        <div className="flex items-center gap-3">
          {!untimedMode ? (
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-black text-sm sm:text-base transition-all ${
              isLowTime ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse' : 'bg-slate-800 text-blue-400 border border-slate-700'
            }`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-extrabold uppercase tracking-wider">
              Untimed Practice Mode
            </div>
          )}

          <button
            onClick={() => saveProgress(false)}
            disabled={saving}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Progress"}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar Question Palette */}
        <div className={`w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-between overflow-y-auto shrink-0 transition-transform ${
          showMobileGrid ? 'absolute inset-y-0 left-0 z-40 shadow-2xl' : 'hidden md:flex'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Question Palette
              </h2>
              {showMobileGrid && (
                <button onClick={() => setShowMobileGrid(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  ✕
                </button>
              )}
            </div>

            {/* Question Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {qs.questions.map((q, idx) => {
                const isSelected = currIdx === idx;
                const isAnswered = !!answers[q._id]?.option;
                const isMarked = !!markedForReview[q._id];

                let bgClass = "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border-slate-200 dark:border-slate-600";
                if (isAnswered) bgClass = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold";
                if (isMarked) bgClass = "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-700 font-bold";

                return (
                  <button
                    key={q._id}
                    onClick={() => { setCurrIdx(idx); setShowMobileGrid(false); }}
                    className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center transition-all relative ${bgClass} ${
                      isSelected ? 'ring-2 ring-blue-600 dark:ring-blue-400 ring-offset-1 scale-105 z-10' : ''
                    }`}
                  >
                    {idx + 1}
                    {isMarked && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white dark:border-slate-800" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Palette Legend & Stats */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-700" />
                Answered
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{answeredCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950 border border-amber-400 dark:border-amber-700" />
                Marked
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{markedCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600" />
                Unanswered
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{unansweredCount}</span>
            </div>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all text-xs"
            >
              Submit Exam
            </button>
          </div>
        </div>

        {/* Center Question Canvas */}
        <div className="flex-1 p-4 sm:p-8 overflow-y-auto flex flex-col justify-between relative bg-slate-50 dark:bg-slate-900">
          
          {/* Time Up Overlay Modal */}
          {timeUp && !untimedMode && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">Time Expired!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  You answered <span className="font-bold text-slate-900 dark:text-white">{answeredCount}</span> out of <span className="font-bold text-slate-900 dark:text-white">{totalQuestions}</span> questions.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => navigate('/')} 
                    className="flex-1 py-3 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    Go to Dashboard
                  </button>
                  <button 
                    onClick={() => setUntimedMode(true)} 
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    Continue Untimed
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Question Card */}
          <div className="max-w-3xl mx-auto w-full bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-6">
            
            {/* Question Top Header */}
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-lg">
                Question {currIdx + 1} / {totalQuestions}
              </span>
              
              <button
                type="button"
                onClick={toggleMarkForReview}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  markedForReview[currentQ._id]
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <svg className="w-4 h-4" fill={markedForReview[currentQ._id] ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>{markedForReview[currentQ._id] ? 'Marked for Review' : 'Mark for Review'}</span>
              </button>
            </div>

            {/* Question Text */}
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-8 leading-relaxed">
              {currentQ.questionText}
            </h2>

            {/* Options Grid */}
            <div className="space-y-3">
              {['A', 'B', 'C', 'D'].map((opt) => {
                const isSelected = answers[currentQ._id]?.option === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleOptionSelect(opt)}
                    className={`w-full text-left p-4 rounded-2xl border font-medium text-sm sm:text-base flex items-center justify-between transition-all group ${
                      isSelected 
                        ? 'bg-blue-50/90 dark:bg-blue-950/80 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30 text-blue-950 dark:text-blue-100 font-semibold' 
                        : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-4">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-600'
                      }`}>
                        {opt}
                      </span>
                      <span className="break-words">{currentQ[`option${opt}`]}</span>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-400 text-white' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Keyboard shortcut tip */}
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-6 text-right hidden sm:block">
              Tip: Press keys <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">1-4</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">A-D</kbd> to select option
            </p>

          </div>

          {/* Bottom Controls Bar */}
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
            <button 
              disabled={currIdx === 0} 
              onClick={() => setCurrIdx(prev => prev - 1)}
              className="px-6 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm disabled:opacity-40 transition-colors"
            >
              ← Previous
            </button>

            {currIdx === totalQuestions - 1 ? (
              <button 
                onClick={() => setShowSubmitModal(true)} 
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/20 transition-all"
              >
                Submit Test
              </button>
            ) : (
              <button 
                onClick={() => setCurrIdx(prev => prev + 1)} 
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-600/20 transition-all"
              >
                Next →
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Final Submission Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Submit Practice Test?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to conclude and submit your test? Here is your summary:
            </p>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 mb-6 space-y-2 text-xs font-semibold">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total Questions:</span>
                <span className="font-bold text-slate-900 dark:text-white">{totalQuestions}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Answered:</span>
                <span className="font-bold">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-amber-800 dark:text-amber-300">
                <span>Marked for Review:</span>
                <span className="font-bold">{markedCount}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Unanswered:</span>
                <span className="font-bold text-slate-900 dark:text-white">{unansweredCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Continue Test
              </button>
              <button 
                onClick={async () => {
                  setShowSubmitModal(false);
                  await saveProgress(true);
                  toast.success("Test submitted successfully!");
                  navigate('/');
                }}
                className="px-5 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-md shadow-emerald-600/20 transition-all"
              >
                Confirm Submission
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
