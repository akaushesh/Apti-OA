import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function TestConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qs, setQs] = useState(null);
  const [duration, setDuration] = useState(15);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    API.get(`/mcq/question-sets/${id}`)
      .then(res => {
        setQs(res.data.data);
      })
      .catch(err => {
        console.error(err);
        const msg = err.response?.data?.message || "Question set not found";
        setErrorMsg(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStart = async () => {
    if (!qs || !qs.questions?.length) {
      return toast.error("Question set contains no questions");
    }
    if (duration <= 0) {
      return toast.error("Please enter a valid test duration");
    }

    setStarting(true);
    try {
      const res = await API.post("/mcq/attempts", {
        questionSetId: id,
        timerDurationSec: Math.round(duration * 60),
        totalQuestions: qs.questions.length
      });
      toast.success("Practice test started!");
      navigate(`/attempt/${res.data.data._id}`);
    } catch(err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to initialize test attempt");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-slate-500 dark:text-slate-400">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm">Loading test details...</p>
      </div>
    );
  }

  if (errorMsg || !qs) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-md">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Set Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{errorMsg || "Unable to load the requested practice set."}</p>
        <Link to="/" className="inline-block bg-slate-900 dark:bg-slate-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const numQuestions = qs.questions.length;
  const timePerQuestion = (duration * 60 / numQuestions).toFixed(0);

  const durationPresets = [5, 10, 15, 20, 30, 45];

  return (
    <div className="max-w-lg mx-auto my-8 sm:my-16 px-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-3xl shadow-xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Configure Practice Test</h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">Set your timer preferences before starting</p>
          </div>
        </div>

        {/* Question Set Info Card */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 mb-6">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Selected Question Bank</span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{qs.name}</h2>
          <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="bg-blue-100/80 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-md">
              {numQuestions} Questions
            </span>
            <span className="text-slate-400">•</span>
            <span>~{timePerQuestion}s per question</span>
          </div>
        </div>

        {/* Duration Selection */}
        <div className="mb-8">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Timer Duration (Minutes)
          </label>
          
          {/* Preset Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            {durationPresets.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setDuration(preset)}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  duration === preset
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {preset}m
              </button>
            ))}
          </div>

          <div className="relative">
            <input 
              type="number" 
              min="1"
              max="180"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500 text-slate-900 dark:text-white p-3 rounded-xl text-sm font-semibold transition-all outline-none focus:ring-2 focus:ring-blue-500/20"
              value={duration} 
              onChange={e => setDuration(Math.max(1, Number(e.target.value)))} 
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              Minutes
            </span>
          </div>
        </div>

        {/* Action Buttons */}
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
            className="flex-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/25 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {starting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Initializing...</span>
              </>
            ) : (
              <span>Start Practice Test</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
