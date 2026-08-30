import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import toast from "react-hot-toast";

export default function ReviewScreen() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [selectedSection, setSelectedSection] = useState("all");
  const [filter, setFilter] = useState("all");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
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

  const formatSec = (sec) => {
    if (!sec || sec <= 0) return "0s";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const qs = attempt.questionSetId || {};
  const totalQuestions = attempt.totalQuestions || qs.questions?.length || 0;

  const ansMap = {};
  if (attempt.answers) {
    attempt.answers.forEach(a => {
      ansMap[a.questionId] = { option: a.selectedOption, isUntimed: a.isUntimed, timeSpentSec: a.timeSpentSec || 0 };
    });
  }

  let countCorrect = 0;
  let countIncorrect = 0;
  let countSkipped = 0;
  let countUntimed = 0;
  let totalTimeSec = 0;

  const processedQuestions = qs.questions?.map((q) => {
    const ans = ansMap[q._id] || {};
    const selected = ans.option;
    const isCorrect = selected === q.correctAnswer;
    const isSkipped = !selected;
    const isUntimed = ans.isUntimed;
    const timeSpentSec = ans.timeSpentSec || 0;

    if (isSkipped) countSkipped++;
    else if (isCorrect) countCorrect++;
    else countIncorrect++;

    if (isUntimed && !isSkipped) countUntimed++;
    totalTimeSec += timeSpentSec;

    return { ...q, selected, isCorrect, isSkipped, isUntimed, timeSpentSec };
  }) || [];

  const sectionStats = {};
  processedQuestions.forEach(q => {
    const secName = q.section || "General";
    if (!sectionStats[secName]) {
      sectionStats[secName] = { total: 0, correct: 0, incorrect: 0, skipped: 0, totalTimeSec: 0 };
    }
    sectionStats[secName].total += 1;
    if (q.isSkipped) sectionStats[secName].skipped += 1;
    else if (q.isCorrect) sectionStats[secName].correct += 1;
    else sectionStats[secName].incorrect += 1;
    sectionStats[secName].totalTimeSec += q.timeSpentSec;
  });

  const sectionFilteredQuestions = processedQuestions.filter(q => {
    if (selectedSection === "all") return true;
    return (q.section || "General") === selectedSection;
  });

  let secCorrect = 0;
  let secIncorrect = 0;
  let secSkipped = 0;
  let secUntimed = 0;

  sectionFilteredQuestions.forEach(q => {
    if (q.isSkipped) secSkipped++;
    else if (q.isCorrect) secCorrect++;
    else secIncorrect++;
    if (q.isUntimed && !q.isSkipped) secUntimed++;
  });

  const filteredQuestions = sectionFilteredQuestions.filter(q => {
    if (filter === "all") return true;
    if (filter === "correct") return q.isCorrect && !q.isSkipped;
    if (filter === "incorrect") return !q.isCorrect && !q.isSkipped;
    if (filter === "skipped") return q.isSkipped;
    if (filter === "untimed") return q.isUntimed && !q.isSkipped;
    return true;
  });

  const accuracyPercent = totalQuestions > 0 ? Math.round((countCorrect / totalQuestions) * 100) : 0;

  const generateSummarizedReport = () => {
    let report = `# Test Attempt Summary: ${qs.name || "Question Set"}\n`;
    report += `- **Date**: ${new Date(attempt.createdAt).toLocaleString()}\n`;
    report += `- **Score**: ${attempt.scoreAtTimeUp} / ${totalQuestions} (${accuracyPercent}% Accuracy)\n`;
    report += `- **Total Time Taken**: ${formatSec(totalTimeSec)}\n`;
    report += `- **Breakdown**: ${countCorrect} Correct, ${countIncorrect} Incorrect, ${countSkipped} Skipped, ${countUntimed} Untimed\n\n`;

    if (Object.keys(sectionStats).length > 0) {
      report += `## Section Breakdown\n`;
      Object.entries(sectionStats).forEach(([secName, stat]) => {
        const secAcc = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
        report += `- **${secName}**: ${stat.correct}/${stat.total} Correct (${secAcc}%) | Time: ${formatSec(stat.totalTimeSec)} | Correct: ${stat.correct}, Incorrect: ${stat.incorrect}, Skipped: ${stat.skipped}\n`;
      });
    }
    return report;
  };

  const generateDetailedLLMReport = () => {
    let report = `# Comprehensive Test Performance & Error Analysis Report\n\n`;
    report += `## Attempt Overview\n`;
    report += `- **Question Set**: ${qs.name || "Question Set"}\n`;
    report += `- **Date**: ${new Date(attempt.createdAt).toLocaleString()}\n`;
    report += `- **Overall Score**: ${attempt.scoreAtTimeUp} / ${totalQuestions}\n`;
    report += `- **Accuracy Rate**: ${accuracyPercent}%\n`;
    report += `- **Total Time Spent**: ${formatSec(totalTimeSec)}\n`;
    report += `- **Total Correct**: ${countCorrect}\n`;
    report += `- **Total Incorrect**: ${countIncorrect}\n`;
    report += `- **Total Skipped**: ${countSkipped}\n\n`;

    if (Object.keys(sectionStats).length > 0) {
      report += `## Section Summary\n`;
      Object.entries(sectionStats).forEach(([secName, stat]) => {
        const secAcc = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
        report += `- **${secName}**: ${stat.correct}/${stat.total} Correct (${secAcc}%) | Time Spent: ${formatSec(stat.totalTimeSec)}\n`;
      });
      report += `\n`;
    }

    report += `## Detailed Question Logs\n\n`;
    processedQuestions.forEach((q, idx) => {
      const statusStr = q.isSkipped ? "SKIPPED" : q.isCorrect ? "CORRECT" : "INCORRECT";
      report += `### Q${idx + 1}. [Section: ${q.section || "General"}] [Status: ${statusStr}]\n`;
      report += `- **Question**: ${q.questionText}\n`;
      report += `- **Options**: A) ${q.optionA} | B) ${q.optionB} | C) ${q.optionC} | D) ${q.optionD}\n`;
      report += `- **Selected Answer**: ${q.selected || "None (Skipped)"}\n`;
      report += `- **Correct Answer**: ${q.correctAnswer}\n`;
      report += `- **Time Spent**: ${formatSec(q.timeSpentSec)} (${q.timeSpentSec || 0}s)\n`;
      if (q.isUntimed) report += `- **Mode**: Untimed\n`;
      report += `\n`;
    });

    return report;
  };

  const handleCopyReport = (type) => {
    const text = type === "summary" ? generateSummarizedReport() : generateDetailedLLMReport();
    navigator.clipboard.writeText(text)
      .then(() => toast.success(type === "summary" ? "Summarized report copied!" : "Detailed LLM report copied!"))
      .catch(() => toast.error("Failed to copy report"));
  };

  const handleDownloadReport = (type) => {
    const text = type === "summary" ? generateSummarizedReport() : generateDetailedLLMReport();
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(qs.name || "test").replace(/\s+/g, "_")}_report_${type}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Export Report Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-lg w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Export Performance Report</h3>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">
              Choose a report format below. The detailed report includes complete question logs, options, selected answers, and time spent, formatted for LLM analysis.
            </p>

            <div className="space-y-4">
              {/* Option 1: Summarized Report */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">📊 Summarized Report</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">Compact</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Scores, overall accuracy, total time, and section-by-section breakdown.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyReport("summary")}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    📋 Copy Summary
                  </button>
                  <button
                    onClick={() => handleDownloadReport("summary")}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl transition-all active:scale-95"
                  >
                    💾 Download .md
                  </button>
                </div>
              </div>

              {/* Option 2: Detailed LLM Report */}
              <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">🤖 Detailed LLM Analysis Report</span>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md">LLM Optimized</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Full attempt details including every question, option choices, user answers, correct answers, and exact time spent per question. Ready to paste into ChatGPT/Claude.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyReport("detailed")}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    📋 Copy Detailed Report
                  </button>
                  <button
                    onClick={() => handleDownloadReport("detailed")}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-xl transition-all active:scale-95"
                  >
                    💾 Download .md
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
            onClick={() => setShowExportModal(true)} 
            className="px-3.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span>📥 Export Report</span>
          </button>
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
            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
              <span>⏱️ Total Time: {formatSec(totalTimeSec)}</span>
            </div>
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

      {/* Section-wise Performance & Time Breakdown Cards */}
      {Object.keys(sectionStats).length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Section Breakdown & Time Spent (Click card to filter)
            </h3>
            {selectedSection !== "all" && (
              <button 
                onClick={() => setSelectedSection("all")} 
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear Section Filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(sectionStats).map(([secName, stat]) => {
              const secAccuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
              const isSelected = selectedSection === secName;
              return (
                <button
                  key={secName}
                  onClick={() => setSelectedSection(isSelected ? "all" : secName)}
                  className={`text-left bg-white dark:bg-slate-800 p-5 rounded-2xl border transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
                    isSelected 
                      ? 'border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-400 bg-blue-50/20 dark:bg-blue-950/20' 
                      : 'border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                        {secName}
                      </span>
                      <span className="px-2.5 py-1 text-[11px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                        ⏱️ {formatSec(stat.totalTimeSec)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-3">
                      <span>{stat.correct} / {stat.total} Correct</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{secAccuracy}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                      ✓ {stat.correct}
                    </span>
                    <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md">
                      ✗ {stat.incorrect}
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                      - {stat.skipped} skipped
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs (Section & Status Filter Controls) */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 mb-6 space-y-4 shadow-xs">
        
        {/* Section Tabs */}
        {Object.keys(sectionStats).length > 0 && (
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 block">
              Section:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar-hide">
              <button
                onClick={() => setSelectedSection("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedSection === "all"
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                All Sections ({processedQuestions.length})
              </button>
              {Object.entries(sectionStats).map(([secName, stat]) => (
                <button
                  key={secName}
                  onClick={() => setSelectedSection(secName)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedSection === secName
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  <span>{secName}</span>
                  <span className="opacity-75 font-mono text-[10px]">({stat.total})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Tabs */}
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 block">
            Status {selectedSection !== "all" ? `(${selectedSection})` : "(All Sections)"}:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar-hide">
            {[
              { key: 'all', label: `All (${sectionFilteredQuestions.length})` },
              { key: 'correct', label: `Correct (${secCorrect})` },
              { key: 'incorrect', label: `Incorrect (${secIncorrect})` },
              { key: 'skipped', label: `Skipped (${secSkipped})` },
              { key: 'untimed', label: `Untimed (${secUntimed})` },
            ].map(f => (
              <button 
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filter === f.key 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
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
                <div className="shrink-0 flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 text-[11px] font-mono font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200/50 dark:border-blue-800/50">
                    ⏱️ {formatSec(q.timeSpentSec)}
                  </span>
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
