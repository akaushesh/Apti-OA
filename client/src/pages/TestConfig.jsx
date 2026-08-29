import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";

const PRESETS = [5, 10, 15, 20, 30, 45];

function DurationPicker({ value, onChange }) {
  return (
    <div>
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {PRESETS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
              value === p
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
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
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-900 dark:text-white p-2.5 rounded-xl text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
          value={value}
          onChange={e => onChange(Math.max(1, Number(e.target.value)))}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">min</span>
      </div>
    </div>
  );
}

export default function TestConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qs, setQs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Mode: "single" | "mock"
  const [mode, setMode] = useState("single");

  // Single section mode
  const [selectedSection, setSelectedSection] = useState("");
  const [singleDuration, setSingleDuration] = useState(15);

  // Mock test mode
  // timerMode: "global" | "per-section"
  const [timerMode, setTimerMode] = useState("global");
  const [globalDuration, setGlobalDuration] = useState(60);
  // {[section]: durationMinutes}
  const [perSectionDurations, setPerSectionDurations] = useState({});
  // freeNav: all questions open simultaneously, section timers run in parallel and lock independently
  const [freeNav, setFreeNav] = useState(false);

  useEffect(() => {
    setLoading(true);
    API.get(`/mcq/question-sets/${id}`)
      .then(res => {
        const data = res.data.data;
        setQs(data);
        // Seed timer defaults from uploader's intended durations
        const def = data.defaultDurationMin || 15;
        setSingleDuration(def);
        // Init per-section durations — use per-section default if set, else global default
        const secs = [...new Set((data.questions || []).map(q => q.section).filter(Boolean))].sort();
        const secDefaults = data.defaultSectionDurationsMin || {};
        const init = {};
        secs.forEach(s => { init[s] = secDefaults[s] ?? def; });
        setPerSectionDurations(init);
        // Global mock duration = sum of per-section defaults
        const totalMock = secs.length > 0
          ? secs.reduce((acc, s) => acc + (secDefaults[s] ?? def), 0)
          : def;
        setGlobalDuration(totalMock);
      })
      .catch(err => {
        const msg = err.response?.data?.message || "Question set not found";
        setErrorMsg(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const sections = useMemo(() => {
    if (!qs?.questions) return [];
    return [...new Set(qs.questions.map(q => q.section).filter(Boolean))].sort();
  }, [qs]);

  const hasSections = sections.length > 0;

  const filteredCount = useMemo(() => {
    if (!qs?.questions) return 0;
    if (mode === "mock" || !selectedSection) return qs.questions.length;
    return qs.questions.filter(q => q.section === selectedSection).length;
  }, [qs, selectedSection, mode]);

  const handleStart = async () => {
    if (!qs?.questions?.length) return toast.error("Question set contains no questions");

    if (mode === "single" && filteredCount === 0) return toast.error("No questions in this section");
    if (mode === "mock" && !hasSections) return toast.error("This set has no sections — use single mode");

    setStarting(true);
    try {
      let body;
      if (mode === "single") {
        body = {
          questionSetId: id,
          section: selectedSection,
          mockMode: false,
          timerDurationSec: Math.round(singleDuration * 60),
          totalQuestions: filteredCount,
        };
      } else {
        // mock mode — no section filter, all questions
        const sectionTimers = timerMode === "per-section"
          ? sections.map(s => ({ section: s, durationSec: Math.round((perSectionDurations[s] || 15) * 60) }))
          : sections.map(s => {
              // distribute global time proportionally by question count
              const count = qs.questions.filter(q => q.section === s).length;
              const frac = count / qs.questions.length;
              return { section: s, durationSec: Math.round(globalDuration * 60 * frac) };
            });

        const totalSec = timerMode === "per-section"
          ? sections.reduce((acc, s) => acc + Math.round((perSectionDurations[s] || 15) * 60), 0)
          : Math.round(globalDuration * 60);

        body = {
          questionSetId: id,
          section: '',
          mockMode: true,
          freeNav: timerMode === "per-section" && freeNav,
          sectionTimers,
          timerDurationSec: totalSec,
          totalQuestions: qs.questions.length,
        };
      }

      const res = await API.post("/mcq/attempts", body);
      toast.success("Test started!");
      navigate(`/attempt/${res.data.data._id}`);
    } catch(err) {
      toast.error(err.response?.data?.message || "Failed to start test");
      setStarting(false);
    }
  };

  if (loading) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-slate-500 dark:text-slate-400">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="font-semibold text-sm">Loading test details...</p>
    </div>
  );

  if (errorMsg || !qs) return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-md">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Set Not Found</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{errorMsg}</p>
      <Link to="/" className="inline-block bg-slate-900 dark:bg-slate-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">Return to Dashboard</Link>
    </div>
  );

  const timePerQ = filteredCount > 0 ? (singleDuration * 60 / filteredCount).toFixed(0) : 0;

  return (
    <div className="max-w-lg mx-auto my-8 sm:my-16 px-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl shadow-xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Configure Practice Test</h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">Set your preferences before starting</p>
          </div>
        </div>

        {/* Question Set Info */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 mb-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Selected Question Bank</span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{qs.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="bg-blue-100/80 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-md">
              {qs.questions.length} Questions
            </span>
            {hasSections && (
              <span className="bg-violet-100/80 dark:bg-violet-950 text-violet-700 dark:text-violet-300 px-2.5 py-0.5 rounded-md">
                {sections.length} Sections
              </span>
            )}
          </div>
        </div>

        {/* Mode Toggle — only shown if sections exist */}
        {hasSections && (
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Attempt Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`py-3 px-4 rounded-2xl border text-sm font-bold transition-all text-left ${
                  mode === "single"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                }`}
              >
                <div className="font-extrabold">Single Section</div>
                <div className={`text-[11px] mt-0.5 ${mode === "single" ? "text-blue-100" : "text-slate-400 dark:text-slate-500"}`}>
                  Pick one section to attempt
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("mock")}
                className={`py-3 px-4 rounded-2xl border text-sm font-bold transition-all text-left ${
                  mode === "mock"
                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                }`}
              >
                <div className="font-extrabold">Full Mock Test</div>
                <div className={`text-[11px] mt-0.5 ${mode === "mock" ? "text-violet-100" : "text-slate-400 dark:text-slate-500"}`}>
                  All sections, one by one
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── SINGLE MODE ── */}
        {mode === "single" && (
          <>
            {hasSections && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Section</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSection("")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      selectedSection === "" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                    }`}
                  >
                    All ({qs.questions.length})
                  </button>
                  {sections.map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        selectedSection === sec ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                      }`}
                    >
                      {sec} ({qs.questions.filter(q => q.section === sec).length})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Timer Duration
                <span className="ml-2 normal-case font-semibold text-slate-400">~{timePerQ}s per question</span>
              </label>
              <DurationPicker value={singleDuration} onChange={setSingleDuration} />
            </div>
          </>
        )}

        {/* ── MOCK MODE ── */}
        {mode === "mock" && (
          <>
            {/* Timer mode toggle */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Timer Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTimerMode("global")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left ${
                    timerMode === "global" ? "bg-violet-600 text-white border-violet-600" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                  }`}
                >
                  <div>Global Timer</div>
                  <div className={`text-[10px] mt-0.5 ${timerMode === "global" ? "text-violet-200" : "text-slate-400"}`}>One timer for the whole test</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTimerMode("per-section")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left ${
                    timerMode === "per-section" ? "bg-violet-600 text-white border-violet-600" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                  }`}
                >
                  <div>Per-Section Timer</div>
                  <div className={`text-[10px] mt-0.5 ${timerMode === "per-section" ? "text-violet-200" : "text-slate-400"}`}>Each section has its own time</div>
                </button>
              </div>
            </div>

            {timerMode === "global" ? (
              <div className="mb-8">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Total Test Duration
                </label>
                <DurationPicker value={globalDuration} onChange={setGlobalDuration} />
                {/* Show how it distributes */}
                <div className="mt-3 space-y-1.5">
                  {sections.map(sec => {
                    const count = qs.questions.filter(q => q.section === sec).length;
                    const frac = count / qs.questions.length;
                    const mins = (globalDuration * frac).toFixed(1);
                    return (
                      <div key={sec} className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>{sec}</span>
                        <span className="text-slate-700 dark:text-slate-300">~{mins} min ({count}q)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mb-8 space-y-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Duration per Section
                </label>
                {sections.map(sec => {
                  const count = qs.questions.filter(q => q.section === sec).length;
                  return (
                    <div key={sec}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{sec}</span>
                        <span className="text-[11px] font-semibold text-slate-400">{count} questions</span>
                      </div>
                      <DurationPicker
                        value={perSectionDurations[sec] ?? 15}
                        onChange={val => setPerSectionDurations(prev => ({ ...prev, [sec]: val }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Free Nav toggle — only makes sense with per-section timers */}
            {timerMode === "per-section" && (
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Navigation Style</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFreeNav(false)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left ${
                      !freeNav ? "bg-violet-600 text-white border-violet-600" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                    }`}
                  >
                    <div>Sequential</div>
                    <div className={`text-[10px] mt-0.5 ${!freeNav ? "text-violet-200" : "text-slate-400"}`}>Submit section to unlock next</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFreeNav(true)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left ${
                      freeNav ? "bg-violet-600 text-white border-violet-600" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                    }`}
                  >
                    <div>Free Navigation</div>
                    <div className={`text-[10px] mt-0.5 ${freeNav ? "text-violet-200" : "text-slate-400"}`}>All sections open, timers run in parallel</div>
                  </button>
                </div>
                {freeNav && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-2 flex items-center gap-1">
                    <span>⚠</span> When a section&apos;s timer expires, its questions lock — you can&apos;t borrow unused time from another section.
                  </p>
                )}
              </div>
            )}

            {/* Section overview */}
            <div className="mb-6 bg-violet-50 dark:bg-violet-950/30 rounded-2xl p-4 border border-violet-200/60 dark:border-violet-800/40">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-2">Mock Test Flow</p>
              <div className="flex items-center gap-1 flex-wrap">
                {sections.map((sec, i) => (
                  <div key={sec} className="flex items-center gap-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      {i + 1}. {sec}
                    </span>
                    {i < sections.length - 1 && <span className="text-slate-400 dark:text-slate-600">{freeNav && timerMode === "per-section" ? "||" : "→"}</span>}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                {freeNav && timerMode === "per-section"
                  ? "All sections open simultaneously. Each section has its own independent countdown — time cannot be shared."
                  : "Each section must be submitted before the next unlocks."}
              </p>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className={`flex-2 py-3 text-white text-sm font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 ${
              mode === "mock"
                ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-violet-600/25"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/25"
            }`}
          >
            {starting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Initializing...</span>
              </>
            ) : (
              <span>
                {mode === "mock"
                  ? `Start Full Mock Test`
                  : `Start Test${selectedSection ? ` · ${selectedSection}` : ""}`}
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
