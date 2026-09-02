import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";
import FormattedQuestionText from "../components/FormattedQuestionText";

export default function AttemptScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [qs, setQs] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── shared state ──
  const [answers, setAnswers] = useState({});
  const [timeSpentMap, setTimeSpentMap] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [saving, setSaving] = useState(false);
  const [showMobileGrid, setShowMobileGrid] = useState(false);

  // ── single-mode state ──
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [untimedMode, setUntimedMode] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currIdx, setCurrIdx] = useState(0);

  // ── mock-mode state ──
  // sectionOrder: string[]  — ordered list of sections
  // activeSectionIdx: number — which section the user is currently on
  // submittedSections: Set<string> — sections already locked-in
  // sectionTimeLeft: number — timer for current section (or global remaining)
  // sectionTimeUp: bool
  const [sectionOrder, setSectionOrder] = useState([]);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [submittedSections, setSubmittedSections] = useState(new Set());
  const [sectionTimeLeft, setSectionTimeLeft] = useState(0);
  const [sectionTimeUp, setSectionTimeUp] = useState(false);
  const [showSectionSubmitModal, setShowSectionSubmitModal] = useState(false);
  const [mockCurrIdx, setMockCurrIdx] = useState(0); // idx within current section's questions

  // ── free-nav mode state ──
  // { [section]: secondsLeft } — all run simultaneously, 0 = locked
  const [freeNavTimers, setFreeNavTimers] = useState({});
  const [freeNavCurrIdx, setFreeNavCurrIdx] = useState(0); // idx across ALL questions (sorted by section order)

  // ── load ──
  useEffect(() => {
    setLoading(true);
    API.get(`/mcq/attempts/${id}`)
      .then(res => {
        const a = res.data.data;
        setAttempt(a);

        const savedAns = {};
        const savedTimes = {};
        if (a.answers) {
          a.answers.forEach(ans => {
            savedAns[ans.questionId] = { option: ans.selectedOption, isUntimed: ans.isUntimed || false };
            if (ans.timeSpentSec) savedTimes[ans.questionId] = ans.timeSpentSec;
          });
        }
        setAnswers(savedAns);
        setTimeSpentMap(savedTimes);

        if (!a.mockMode) setTimeLeft(a.timerDurationSec || 600);

        const setId = a.questionSetId?._id || a.questionSetId;
        return API.get(`/mcq/question-sets/${setId}`).then(res2 => ({ res2, a }));
      })
      .then(({ res2, a }) => {
        const qsData = res2.data.data;
        let questions = qsData.questions || [];

        if (a.mockMode) {
          // Preserve section order from sectionTimers (ponytail: keep consecutive question order within sections)
          const order = (a.sectionTimers || []).map(t => t.section);
          setSectionOrder(order);
          qsData.questions = order.flatMap(sec => questions.filter(q => q.section === sec));

          if (a.freeNav) {
            // Seed all section timers simultaneously
            const timers = {};
            (a.sectionTimers || []).forEach(t => { timers[t.section] = t.durationSec; });
            setFreeNavTimers(timers);
          } else {
            // Sequential mode: init timer for first section only
            const firstTimer = a.sectionTimers?.[0];
            if (firstTimer) setSectionTimeLeft(firstTimer.durationSec);
          }
        } else {
          // Single mode: filter by section if set, maintain original question order
          if (a.section) questions = questions.filter(q => q.section === a.section);
          qsData.questions = questions;
        }

        setQs(qsData);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load test attempt");
        navigate("/");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // ── single mode timer ──
  useEffect(() => {
    if (!attempt || attempt.mockMode) return;
    if (timeLeft > 0 && !timeUp && !untimedMode) {
      const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
      return () => clearTimeout(t);
    } else if (timeLeft === 0 && attempt && !timeUp && !untimedMode) {
      handleTimeUp();
    }
  }, [timeLeft, timeUp, attempt, untimedMode]);

  // ── mock mode section timer ──
  useEffect(() => {
    if (!attempt?.mockMode || attempt?.freeNav || sectionTimeUp) return;
    if (sectionTimeLeft > 0) {
      const t = setTimeout(() => setSectionTimeLeft(p => p - 1), 1000);
      return () => clearTimeout(t);
    } else if (sectionTimeLeft === 0 && qs && sectionOrder.length > 0) {
      handleSectionTimeUp();
    }
  }, [sectionTimeLeft, sectionTimeUp, attempt, qs, sectionOrder]);

  // ── free-nav mode: only the active section's timer ticks, others pause ──
  useEffect(() => {
    if (!attempt?.mockMode || !attempt?.freeNav || !qs) return;
    const activeSection = qs.questions[freeNavCurrIdx]?.section;
    if (!activeSection) return;
    const remaining = freeNavTimers[activeSection] ?? 0;
    if (remaining <= 0) return;
    const t = setTimeout(() => {
      setFreeNavTimers(prev => ({ ...prev, [activeSection]: Math.max(0, (prev[activeSection] ?? 0) - 1) }));
    }, 1000);
    return () => clearTimeout(t);
  }, [freeNavTimers, freeNavCurrIdx, attempt, qs]);

  // ── helpers ──
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Questions belonging to the current mock section
  const currentSectionName = sectionOrder[activeSectionIdx] || '';
  const currentSectionQuestions = qs
    ? qs.questions.filter(q => q.section === currentSectionName)
    : [];

  const activeQ = attempt?.freeNav
    ? qs?.questions[freeNavCurrIdx]
    : attempt?.mockMode
    ? currentSectionQuestions[mockCurrIdx]
    : qs?.questions[currIdx];
  const activeQuestionId = activeQ?._id;

  // ── per-question time tracking ticker ──
  useEffect(() => {
    if (loading || timeUp || !activeQuestionId || showSubmitModal || showSectionSubmitModal) return;

    if (attempt?.mockMode) {
      if (attempt.freeNav) {
        const sec = activeQ?.section;
        if ((freeNavTimers[sec] ?? 1) <= 0) return;
      } else {
        if (sectionTimeLeft <= 0 || sectionTimeUp) return;
      }
    } else {
      if (!untimedMode && timeLeft <= 0) return;
    }

    const t = setTimeout(() => {
      setTimeSpentMap(prev => ({
        ...prev,
        [activeQuestionId]: (prev[activeQuestionId] || 0) + 1
      }));
    }, 1000);
    return () => clearTimeout(t);
  }, [activeQuestionId, loading, timeUp, attempt, freeNavTimers, sectionTimeLeft, sectionTimeUp, untimedMode, timeLeft, activeQ, showSubmitModal, showSectionSubmitModal]);

  const saveProgress = async (isSubmit = false) => {
    if (!qs || !attempt) return;
    setSaving(true);
    let score = 0;
    const ansArray = (qs.questions || []).map(q => {
      const qId = q._id;
      const ansObj = answers[qId] || {};
      const selected = ansObj.option || null;
      if (selected && q.correctAnswer === selected) score++;
      return {
        questionId: qId,
        selectedOption: selected,
        isUntimed: ansObj.isUntimed || false,
        timeSpentSec: timeSpentMap[qId] || 0
      };
    });
    try {
      await API.patch(`/mcq/attempts/${id}`, {
        answers: ansArray,
        scoreAtTimeUp: !untimedMode ? score : attempt.scoreAtTimeUp,
        finalScoreIfUntimed: score,
        status: isSubmit ? 'completed' : 'in-progress'
      });
      if (!isSubmit) toast.success("Progress saved", { duration: 1500 });
    } catch (e) {
      toast.error("Failed to save progress");
    } finally {
      setSaving(false);
    }
  };

  // ── single mode: time up ──
  const handleTimeUp = async () => {
    setTimeUp(true);
    toast.error("Time is up!", { duration: 5000 });
    await saveProgress(true);
  };

  // ── mock mode: section time up ──
  const handleSectionTimeUp = async () => {
    setSectionTimeUp(true);
    toast.error(`Time up for ${currentSectionName}!`, { duration: 4000 });
    await saveProgress(false);
  };

  // Submit current section and advance to next
  const submitSection = async () => {
    const isLastSection = activeSectionIdx >= sectionOrder.length - 1;
    await saveProgress(isLastSection);
    setSubmittedSections(prev => new Set([...prev, currentSectionName]));
    setShowSectionSubmitModal(false);
    setSectionTimeUp(false);

    if (isLastSection) {
      toast.success("Mock test complete!");
      navigate('/');
    } else {
      const nextIdx = activeSectionIdx + 1;
      setActiveSectionIdx(nextIdx);
      setMockCurrIdx(0);
      const nextTimer = attempt.sectionTimers?.[nextIdx];
      if (nextTimer) setSectionTimeLeft(nextTimer.durationSec);
      toast.success(`Section submitted! Moving to: ${sectionOrder[nextIdx]}`, { duration: 3000 });
    }
  };

  // ── option select ──
  const handleOptionSelect = (opt) => {
    if (!qs) return;
    const isFreeNav = attempt?.freeNav;
    const questions = isFreeNav ? qs.questions : attempt?.mockMode ? currentSectionQuestions : qs.questions;
    const idx = isFreeNav ? freeNavCurrIdx : attempt?.mockMode ? mockCurrIdx : currIdx;
    const q = questions[idx];
    if (!q) return;
    // In freeNav mode, respect the per-section lock (keyboard shortcut shouldn't bypass it)
    if (isFreeNav && (freeNavTimers[q.section] ?? 1) <= 0) return;
    setAnswers(prev => ({ ...prev, [q._id]: { option: opt, isUntimed: untimedMode } }));
  };

  const toggleMarkForReview = () => {
    const isFreeNav = attempt?.freeNav;
    const questions = isFreeNav ? qs?.questions : attempt?.mockMode ? currentSectionQuestions : qs?.questions;
    const idx = isFreeNav ? freeNavCurrIdx : attempt?.mockMode ? mockCurrIdx : currIdx;
    const q = questions[idx];
    if (!q) return;
    setMarkedForReview(prev => ({ ...prev, [q._id]: !prev[q._id] }));
  };

  // ── keyboard shortcuts ──
  const handleKeyDown = useCallback((e) => {
    if (showSubmitModal || showSectionSubmitModal) return;
    const isMock = attempt?.mockMode;
    const isFreeNav = attempt?.freeNav;
    const questions = isFreeNav ? qs?.questions : isMock ? currentSectionQuestions : qs?.questions;
    const currI = isFreeNav ? freeNavCurrIdx : isMock ? mockCurrIdx : currIdx;
    const setIdx = isFreeNav ? setFreeNavCurrIdx : isMock ? setMockCurrIdx : setCurrIdx;

    if (e.key === 'ArrowRight') {
      if (questions && currI < questions.length - 1) setIdx(p => p + 1);
    } else if (e.key === 'ArrowLeft') {
      if (currI > 0) setIdx(p => p - 1);
    } else if (['a', 'A', '1'].includes(e.key)) handleOptionSelect('A');
    else if (['b', 'B', '2'].includes(e.key)) handleOptionSelect('B');
    else if (['c', 'C', '3'].includes(e.key)) handleOptionSelect('C');
    else if (['d', 'D', '4'].includes(e.key)) handleOptionSelect('D');
    else if (['m', 'M'].includes(e.key)) toggleMarkForReview();
  }, [qs, currIdx, mockCurrIdx, freeNavCurrIdx, showSubmitModal, showSectionSubmitModal, attempt, currentSectionQuestions, answers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading || !qs || !attempt) return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6">
      <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="font-semibold text-slate-300">Loading exam interface...</p>
    </div>
  );

  // ── FREE-NAV MODE render ──
  if (attempt.mockMode && attempt.freeNav) {
    const allQuestions = qs.questions; // ordered by sectionOrder while preserving question sequence
    const currentQ = allQuestions[freeNavCurrIdx];
    const currentQSection = currentQ?.section || '';
    const isSectionLocked = (sec) => (freeNavTimers[sec] ?? 1) <= 0;
    const isCurrentLocked = isSectionLocked(currentQSection);
    const answeredCount = Object.values(answers).filter(v => v.option).length;
    const allExpired = sectionOrder.length > 0 && sectionOrder.every(s => (freeNavTimers[s] ?? 1) <= 0);

    const handleFreeNavSubmit = async () => {
      await saveProgress(true);
      toast.success("Test submitted!");
      navigate('/');
    };

    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">

        {/* Header */}
        <header className="relative bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow-md shrink-0 z-30 gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-extrabold text-sm text-white tracking-tight truncate">{qs.name}</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
              {currentQSection} · Q{freeNavCurrIdx + 1}/{allQuestions.length}
            </span>
          </div>

          {/* Active section timer centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
            {(() => {
              const t = freeNavTimers[currentQSection] ?? 0;
              const locked = t <= 0;
              const lowTime = t > 0 && t < 120;
              return (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-black text-sm border transition-all ${
                  locked
                    ? 'bg-rose-500/30 text-rose-400 border-rose-500/50'
                    : lowTime
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse'
                    : 'bg-slate-800 text-violet-400 border-slate-700'
                }`}>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{locked ? '0:00' : formatTime(t)}</span>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => saveProgress(false)}
              disabled={saving}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleFreeNavSubmit}
              disabled={saving}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              Submit All
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">

          {/* Sidebar — all questions grouped by section */}
          <div className={`w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col overflow-y-auto shrink-0 transition-transform ${
            showMobileGrid ? 'absolute inset-y-0 left-0 z-40 shadow-2xl' : 'hidden md:flex'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">All Questions</h2>
              {showMobileGrid && <button onClick={() => setShowMobileGrid(false)} className="text-slate-400">✕</button>}
            </div>

            {sectionOrder.map(sec => {
              const secQs = allQuestions.filter(q => q.section === sec);
              const locked = isSectionLocked(sec);
              const startIdx = allQuestions.findIndex(q => q.section === sec);
              return (
                <div key={sec} className="mb-4">
                  <div className={`flex items-center justify-between mb-1.5 px-1 ${locked ? 'opacity-50' : ''}`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-400">{sec}</span>
                    {locked
                      ? <span className="text-[9px] font-bold text-rose-500 uppercase">Locked</span>
                      : sec === currentQSection
                      ? <span className="text-[9px] font-bold text-emerald-500 font-mono">{formatTime(freeNavTimers[sec] ?? 0)}</span>
                      : <span className="text-[9px] font-bold text-slate-400 uppercase">Paused</span>
                    }
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {secQs.map((q, i) => {
                      const globalIdx = startIdx + i;
                      const isAnswered = !!answers[q._id]?.option;
                      const isMarked = !!markedForReview[q._id];
                      const isSelected = freeNavCurrIdx === globalIdx;
                      let cls = locked
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600";
                      if (!locked && isAnswered) cls = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold";
                      if (!locked && isMarked) cls = "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-700 font-bold";
                      return (
                        <button
                          key={q._id}
                          onClick={() => { setFreeNavCurrIdx(globalIdx); setShowMobileGrid(false); }}
                          className={`h-8 rounded-lg border text-[10px] font-bold flex items-center justify-center transition-all relative ${cls} ${isSelected ? 'ring-2 ring-violet-600 ring-offset-1 scale-110 z-10' : ''}`}
                        >
                          {i + 1}
                          {isMarked && !locked && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="pt-3 mt-auto border-t border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <div className="flex justify-between mb-1">
                <span>Answered</span><span className="font-bold text-slate-900 dark:text-white">{answeredCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Total</span><span className="font-bold text-slate-900 dark:text-white">{allQuestions.length}</span>
              </div>
            </div>
          </div>

          {/* Question canvas */}
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto flex flex-col justify-between bg-slate-50 dark:bg-slate-900">
            {allExpired && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">All Sections Expired!</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">You answered {answeredCount} of {allQuestions.length} questions.</p>
                  <button onClick={handleFreeNavSubmit} disabled={saving} className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60">
                    {saving ? "Submitting..." : "Submit & See Results"}
                  </button>
                </div>
              </div>
            )}

            {currentQ ? (
              <>
                {isCurrentLocked && (
                  <div className="max-w-3xl mx-auto w-full mb-4 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <span>🔒</span> Time expired for <strong>{currentQSection}</strong> — answers locked
                  </div>
                )}

                <div className="max-w-3xl mx-auto w-full bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-6">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-wider bg-violet-50 dark:bg-violet-950/60 px-3 py-1 rounded-lg">
                      Q{freeNavCurrIdx + 1} / {allQuestions.length}
                    </span>
                    <button
                      type="button"
                      disabled={isCurrentLocked}
                      onClick={() => {
                        if (isCurrentLocked) return;
                        setMarkedForReview(prev => ({ ...prev, [currentQ._id]: !prev[currentQ._id] }));
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        markedForReview[currentQ._id]
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : isCurrentLocked ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <svg className="w-4 h-4" fill={markedForReview[currentQ._id] ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      <span>{markedForReview[currentQ._id] ? 'Marked' : 'Mark'}</span>
                    </button>
                  </div>

                  <div className="mb-8 font-bold leading-relaxed text-slate-900 dark:text-white">
                    <FormattedQuestionText text={currentQ.questionText} section={currentQ.section} />
                  </div>

                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D'].map(opt => {
                      const isSelected = answers[currentQ._id]?.option === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={isCurrentLocked}
                          onClick={() => {
                            if (isCurrentLocked) return;
                            setAnswers(prev => ({ ...prev, [currentQ._id]: { option: opt, isUntimed: false } }));
                          }}
                          className={`w-full text-left p-4 rounded-2xl border font-medium text-sm flex items-center justify-between transition-all group ${
                            isCurrentLocked
                              ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                              : isSelected
                              ? 'bg-blue-50/90 dark:bg-blue-950/80 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30 text-blue-950 dark:text-blue-100 font-semibold'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 pr-4">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>{opt}</span>
                            <span className="break-words">{currentQ[`option${opt}`]}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nav */}
                <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
                  <button
                    disabled={freeNavCurrIdx === 0}
                    onClick={() => setFreeNavCurrIdx(p => p - 1)}
                    className="px-6 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm disabled:opacity-40 transition-colors"
                  >
                    ← Previous
                  </button>
                  {freeNavCurrIdx === allQuestions.length - 1 ? (
                    <button
                      onClick={handleFreeNavSubmit}
                      disabled={saving}
                      className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-violet-600/20 transition-all disabled:opacity-60"
                    >
                      Submit All & Finish
                    </button>
                  ) : (
                    <button
                      onClick={() => setFreeNavCurrIdx(p => p + 1)}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-600/20 transition-all"
                    >
                      Next →
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-semibold">No questions found.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── MOCK MODE render ──
  if (attempt.mockMode) {
    const secQs = currentSectionQuestions;
    const currentQ = secQs[mockCurrIdx];
    const answeredInSection = secQs.filter(q => answers[q._id]?.option).length;
    const markedInSection = secQs.filter(q => markedForReview[q._id]).length;
    const isLastSection = activeSectionIdx >= sectionOrder.length - 1;
    const isLowTime = sectionTimeLeft < 120 && !sectionTimeUp;

    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">

        {/* Header */}
        <header className="relative bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-md shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowMobileGrid(!showMobileGrid)}
              className="md:hidden p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight truncate max-w-[160px] sm:max-w-sm">
                {qs.name}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                {currentSectionName} · Q{mockCurrIdx + 1}/{secQs.length}
              </span>
            </div>
          </div>

          {/* Section timer centered */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-black text-sm transition-all ${
              sectionTimeUp
                ? 'bg-rose-500/30 text-rose-400 border border-rose-500/50'
                : isLowTime
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'
                : 'bg-slate-800 text-violet-400 border border-slate-700'
            }`}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{sectionTimeUp ? "0:00" : formatTime(sectionTimeLeft)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Section progress pills */}
            <div className="hidden sm:flex items-center gap-1">
              {sectionOrder.map((sec, i) => (
                <span
                  key={sec}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                    submittedSections.has(sec)
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : i === activeSectionIdx
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {i + 1}. {sec}
                </span>
              ))}
            </div>

            <button
              onClick={() => saveProgress(false)}
              disabled={saving}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative">

          {/* Sidebar — current section palette */}
          <div className={`w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col justify-between overflow-y-auto shrink-0 transition-transform ${
            showMobileGrid ? 'absolute inset-y-0 left-0 z-40 shadow-2xl' : 'hidden md:flex'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {currentSectionName}
                </h2>
                {showMobileGrid && (
                  <button onClick={() => setShowMobileGrid(false)} className="text-slate-400">✕</button>
                )}
              </div>

              {/* Section tabs */}
              <div className="flex flex-col gap-1 mb-4">
                {sectionOrder.map((sec, i) => (
                  <div
                    key={sec}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                      submittedSections.has(sec)
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                        : i === activeSectionIdx
                        ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                        : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    <span>{i + 1}. {sec}</span>
                    {submittedSections.has(sec) && <span>✓</span>}
                    {i === activeSectionIdx && !submittedSections.has(sec) && <span className="text-violet-500">▶</span>}
                    {i > activeSectionIdx && <span>🔒</span>}
                  </div>
                ))}
              </div>

              {/* Question grid for current section */}
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Question Map</p>
              <div className="grid grid-cols-5 gap-1.5">
                {secQs.map((q, idx) => {
                  const isAnswered = !!answers[q._id]?.option;
                  const isMarked = !!markedForReview[q._id];
                  const isSelected = mockCurrIdx === idx;
                  let cls = "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600";
                  if (isAnswered) cls = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold";
                  if (isMarked) cls = "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-700 font-bold";
                  return (
                    <button
                      key={q._id}
                      onClick={() => { setMockCurrIdx(idx); setShowMobileGrid(false); }}
                      className={`h-9 rounded-xl border text-xs font-bold flex items-center justify-center transition-all relative ${cls} ${isSelected ? 'ring-2 ring-violet-600 ring-offset-1 scale-105 z-10' : ''}`}
                    >
                      {idx + 1}
                      {isMarked && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-white dark:border-slate-800" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats + submit section */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-400" />Answered</span>
                <span className="font-bold text-slate-900 dark:text-white">{answeredInSection}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400" />Marked</span>
                <span className="font-bold text-slate-900 dark:text-white">{markedInSection}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300" />Unanswered</span>
                <span className="font-bold text-slate-900 dark:text-white">{secQs.length - answeredInSection}</span>
              </div>
              <button
                onClick={() => setShowSectionSubmitModal(true)}
                className="w-full mt-3 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all"
              >
                {isLastSection ? "Submit & Finish" : "Submit Section →"}
              </button>
            </div>
          </div>

          {/* Question canvas */}
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto flex flex-col justify-between relative bg-slate-50 dark:bg-slate-900">

            {/* Section time-up overlay */}
            {sectionTimeUp && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">Section Time Up!</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">
                    <strong className="text-slate-700 dark:text-slate-200">{currentSectionName}</strong> — answered {answeredInSection} of {secQs.length}
                  </p>
                  <p className="text-xs text-slate-400 mb-6">Your answers so far are saved. Submit to continue.</p>
                  <button
                    onClick={submitSection}
                    disabled={saving}
                    className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60"
                  >
                    {isLastSection ? "Submit & See Results" : `Submit & Start: ${sectionOrder[activeSectionIdx + 1]}`}
                  </button>
                </div>
              </div>
            )}

            {currentQ ? (
              <>
                {/* Question card */}
                <div className="max-w-3xl mx-auto w-full bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-6">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-wider bg-violet-50 dark:bg-violet-950/60 px-3 py-1 rounded-lg">
                      Q{mockCurrIdx + 1} / {secQs.length}
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
                      <span>{markedForReview[currentQ._id] ? 'Marked' : 'Mark for Review'}</span>
                    </button>
                  </div>

                  <div className="mb-8 font-bold leading-relaxed text-slate-900 dark:text-white">
                    <FormattedQuestionText text={currentQ.questionText} section={currentQ.section} />
                  </div>

                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D'].map(opt => {
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
                            }`}>{opt}</span>
                            <span className="break-words">{currentQ[`option${opt}`]}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] font-semibold text-slate-400 mt-6 text-right hidden sm:block">
                    Tip: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">1-4</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">A-D</kbd> to select
                  </p>
                </div>

                {/* Nav */}
                <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
                  <button
                    disabled={mockCurrIdx === 0}
                    onClick={() => setMockCurrIdx(p => p - 1)}
                    className="px-6 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm disabled:opacity-40 transition-colors"
                  >
                    ← Previous
                  </button>
                  {mockCurrIdx === secQs.length - 1 ? (
                    <button
                      onClick={() => setShowSectionSubmitModal(true)}
                      className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-violet-600/20 transition-all"
                    >
                      {isLastSection ? "Submit & Finish" : "Submit Section →"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setMockCurrIdx(p => p + 1)}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-600/20 transition-all"
                    >
                      Next →
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-semibold">
                No questions in this section.
              </div>
            )}
          </div>
        </div>

        {/* Section submit confirmation */}
        {showSectionSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">
                Submit {currentSectionName}?
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-5 leading-relaxed">
                {isLastSection
                  ? "This is the last section. Submitting will finalize the mock test."
                  : `Next: ${sectionOrder[activeSectionIdx + 1]}`}
              </p>
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 mb-5 space-y-2 text-xs font-semibold">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Questions:</span><span className="font-bold text-slate-900 dark:text-white">{secQs.length}</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Answered:</span><span className="font-bold">{answeredInSection}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Unanswered:</span><span className="font-bold text-slate-900 dark:text-white">{secQs.length - answeredInSection}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSectionSubmitModal(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Continue Section
                </button>
                <button
                  onClick={submitSection}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-bold bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl shadow-md shadow-violet-600/20 transition-all disabled:opacity-60"
                >
                  {saving ? "Saving..." : isLastSection ? "Finish Mock" : "Submit →"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SINGLE MODE render (unchanged logic, same UI) ──
  const currentQ = qs.questions[currIdx];
  const totalQuestions = qs.questions.length;
  const isLowTime = timeLeft < 120 && !untimedMode;
  const answeredCount = Object.values(answers).filter(v => v.option).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden select-none">

      <header className="relative bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-md shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setShowMobileGrid(!showMobileGrid)}
            className="md:hidden p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg"
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
              {attempt.section ? `${attempt.section} · ` : ""}Question {currIdx + 1} of {totalQuestions}
            </span>
          </div>
        </div>

        {/* Centered Timer / Mode Badge */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
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
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => saveProgress(false)}
            disabled={saving}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Progress"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">

        <div className={`w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-between overflow-y-auto shrink-0 transition-transform ${
          showMobileGrid ? 'absolute inset-y-0 left-0 z-40 shadow-2xl' : 'hidden md:flex'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Question Palette</h2>
              {showMobileGrid && <button onClick={() => setShowMobileGrid(false)} className="text-slate-400">✕</button>}
            </div>
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
                    className={`h-10 rounded-xl border text-xs font-bold flex items-center justify-center transition-all relative ${bgClass} ${isSelected ? 'ring-2 ring-blue-600 dark:ring-blue-400 ring-offset-1 scale-105 z-10' : ''}`}
                  >
                    {idx + 1}
                    {isMarked && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white dark:border-slate-800" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-700" />Answered</span><span className="font-bold text-slate-900 dark:text-white">{answeredCount}</span></div>
            <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950 border border-amber-400 dark:border-amber-700" />Marked</span><span className="font-bold text-slate-900 dark:text-white">{markedCount}</span></div>
            <div className="flex justify-between items-center"><span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600" />Unanswered</span><span className="font-bold text-slate-900 dark:text-white">{unansweredCount}</span></div>
            <button onClick={() => setShowSubmitModal(true)} className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all text-xs">Submit Exam</button>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-8 overflow-y-auto flex flex-col justify-between relative bg-slate-50 dark:bg-slate-900">

          {timeUp && !untimedMode && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">Time Expired!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">You answered <span className="font-bold text-slate-900 dark:text-white">{answeredCount}</span> out of <span className="font-bold text-slate-900 dark:text-white">{totalQuestions}</span> questions.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => navigate('/')} className="flex-1 py-3 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors">Go to Dashboard</button>
                  <button onClick={() => setUntimedMode(true)} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors">Continue Untimed</button>
                </div>
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto w-full bg-white dark:bg-slate-800 p-6 sm:p-10 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-700/80 mb-6">
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

            <div className="mb-8 font-bold leading-relaxed text-slate-900 dark:text-white">
              <FormattedQuestionText text={currentQ.questionText} section={currentQ.section} />
            </div>

            <div className="space-y-3">
              {['A', 'B', 'C', 'D'].map(opt => {
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
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-600'}`}>{opt}</span>
                      <span className="break-words">{currentQ[`option${opt}`]}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-400 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-6 text-right hidden sm:block">
              Tip: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">1-4</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300">A-D</kbd> to select option
            </p>
          </div>

          <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
            <button disabled={currIdx === 0} onClick={() => setCurrIdx(p => p - 1)} className="px-6 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm disabled:opacity-40 transition-colors">← Previous</button>
            {currIdx === totalQuestions - 1 ? (
              <button onClick={() => setShowSubmitModal(true)} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/20 transition-all">Submit Test</button>
            ) : (
              <button onClick={() => setCurrIdx(p => p + 1)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-600/20 transition-all">Next →</button>
            )}
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Submit Practice Test?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">Are you sure you want to conclude and submit?</p>
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 mb-6 space-y-2 text-xs font-semibold">
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Total Questions:</span><span className="font-bold text-slate-900 dark:text-white">{totalQuestions}</span></div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Answered:</span><span className="font-bold">{answeredCount}</span></div>
              <div className="flex justify-between text-amber-800 dark:text-amber-300"><span>Marked for Review:</span><span className="font-bold">{markedCount}</span></div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Unanswered:</span><span className="font-bold text-slate-900 dark:text-white">{unansweredCount}</span></div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Continue Test</button>
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
