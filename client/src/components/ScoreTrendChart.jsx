import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ScoreTrendChart({ 
  completedAttempts = [], 
  selectedCategory = "All Categories", 
  onResetCategory, 
  categories = [],
  onSelectCategory,
  title,
  subtitle,
  loading = false 
}) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [viewLimit, setViewLimit] = useState("15"); // '10' | '15' | 'all'

  // Derive distinct categories if not explicitly passed
  const availableCategories = (categories && categories.length > 0)
    ? categories
    : Array.from(new Set(completedAttempts.map(a => a.questionSetId?.category).filter(Boolean)));

  const handleSelectCat = (cat) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
    } else if (onResetCategory && cat === "All Categories") {
      onResetCategory("All Categories");
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs mb-8 animate-pulse h-64 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Loading performance trends...</span>
        </div>
      </div>
    );
  }

  // Filter by category if selected
  const categoryFiltered = (selectedCategory === "All Categories" || selectedCategory === "all")
    ? completedAttempts
    : completedAttempts.filter(a => (a.questionSetId?.category || "General").toLowerCase() === selectedCategory.toLowerCase());

  // Chronological order (oldest to newest for trend left-to-right)
  const sorted = [...categoryFiltered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const displayed = viewLimit === "all" ? sorted : sorted.slice(-parseInt(viewLimit, 10));

  // If no attempts at all
  if (completedAttempts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs mb-8 text-center">
        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">No Score Data Yet</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          Complete practice test assessments to unlock your visual score progression and performance trajectory.
        </p>
      </div>
    );
  }

  // If category has no attempts but overall has some
  if (displayed.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs mb-8 text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No completed attempts found in <span className="text-blue-600 dark:text-blue-400 font-bold">&quot;{selectedCategory}&quot;</span>.
        </p>
        <div className="flex flex-wrap justify-center items-center gap-2 mt-4">
          <button
            onClick={() => handleSelectCat("All Categories")}
            className="px-4 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-xl transition-colors"
          >
            Show All Categories
          </button>
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => handleSelectCat(cat)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Calculate metrics
  const pcts = displayed.map(a => {
    const total = a.totalQuestions || 1;
    const score = a.scoreAtTimeUp || 0;
    return Math.min(100, Math.max(0, Math.round((score / total) * 100)));
  });

  const highestScore = Math.max(...pcts);
  const latestScore = pcts[pcts.length - 1];
  const avgScore = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);

  // SVG Chart Geometry
  const svgWidth = 800;
  const svgHeight = 220;
  const padLeft = 52;
  const padRight = 36;
  const padTop = 32;
  const padBottom = 42;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const points = displayed.map((a, i) => {
    const total = a.totalQuestions || 1;
    const score = a.scoreAtTimeUp || 0;
    const pct = Math.min(100, Math.max(0, Math.round((score / total) * 100)));
    const x = displayed.length === 1
      ? padLeft + plotWidth / 2
      : padLeft + (i / (displayed.length - 1)) * plotWidth;
    const y = padTop + plotHeight - (pct / 100) * plotHeight;
    const dateObj = a.createdAt ? new Date(a.createdAt) : null;
    const dateStr = dateObj ? dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : `#${i + 1}`;
    const fullDate = dateObj ? dateObj.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    const name = a.questionSetId?.name || "Practice Test";
    const category = a.questionSetId?.category || "General";

    return { id: a._id, x, y, pct, score, total, dateStr, fullDate, name, category, index: i };
  });

  const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");
  const areaD = points.length > 1
    ? `${pathD} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`
    : "";

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs mb-8 transition-all">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {title || "Score Progression & Trends"}
              </h2>
              {selectedCategory !== "All Categories" && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                  {selectedCategory}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle || `Performance trajectory across ${displayed.length} completed ${displayed.length === 1 ? "assessment" : "assessments"}`}
            </p>
          </div>

          {/* Quick Highlights + Filter Limit */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Latest:</span>
              <span className={`text-xs font-black ${latestScore >= 75 ? "text-emerald-600 dark:text-emerald-400" : latestScore >= 50 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`}>
                {latestScore}%
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Best:</span>
              <span className="text-xs font-black text-purple-600 dark:text-purple-400">{highestScore}%</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Avg:</span>
              <span className="text-xs font-black text-blue-600 dark:text-blue-400">{avgScore}%</span>
            </div>

            {sorted.length > 10 && (
              <div className="flex bg-slate-100 dark:bg-slate-900/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                {["10", "15", "all"].map(limit => (
                  <button
                    key={limit}
                    onClick={() => setViewLimit(limit)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      viewLimit === limit
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {limit === "all" ? "All" : `Last ${limit}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        {availableCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/40">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Category:
            </span>
            <button
              onClick={() => handleSelectCat("All Categories")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedCategory === "All Categories" || selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-xs font-black"
                  : "bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              All Categories
            </button>
            {availableCategories.map(cat => {
              const isCatActive = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => handleSelectCat(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    isCatActive
                      ? "bg-blue-600 text-white shadow-xs font-black"
                      : "bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full overflow-x-auto select-none pt-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[550px] h-auto block"
        >
          <defs>
            <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
              <stop offset="85%" stopColor="#3b82f6" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <filter id="pointShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3b82f6" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Grid lines & Y-Axis labels */}
          {[0, 25, 50, 75, 100].map(val => {
            const y = padTop + plotHeight - (val / 100) * plotHeight;
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotWidth}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700/60"
                  strokeDasharray={val === 0 || val === 100 ? "" : "4 4"}
                  strokeWidth={val === 0 ? "1.5" : "1"}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="font-mono text-[11px] font-semibold fill-slate-400 dark:fill-slate-500"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Fill Area underneath line */}
          {areaD && (
            <path d={areaD} fill="url(#scoreAreaGradient)" />
          )}

          {/* Connecting Line */}
          {points.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active Guide Vertical Line */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={padTop + plotHeight}
              stroke="#3b82f6"
              strokeDasharray="3 3"
              strokeWidth="1.5"
              className="opacity-75"
            />
          )}

          {/* Data Points */}
          {points.map((pt, i) => {
            const isHovered = hoveredIdx === i;
            const ptColor = pt.pct >= 75 ? "#10b981" : pt.pct >= 50 ? "#3b82f6" : "#f59e0b";

            return (
              <g
                key={pt.id}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => navigate(`/review/${pt.id}`)}
              >
                {/* Transparent hit target circle for easy hovering */}
                <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                {/* Outer halo when hovered */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="10"
                    fill={ptColor}
                    opacity="0.25"
                    className="animate-ping"
                  />
                )}

                {/* Main point dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "7" : points.length > 25 ? "4" : "5.5"}
                  fill={ptColor}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? "2.5" : "2"}
                  filter="url(#pointShadow)"
                />

                {/* X-axis date labels */}
                {(points.length <= 15 || i % Math.ceil(points.length / 10) === 0 || i === points.length - 1) && (
                  <text
                    x={pt.x}
                    y={padTop + plotHeight + 22}
                    textAnchor="middle"
                    className={`font-mono text-[10px] font-semibold transition-colors ${
                      isHovered
                        ? "fill-blue-600 dark:fill-blue-400 font-bold"
                        : "fill-slate-400 dark:fill-slate-500"
                    }`}
                  >
                    {pt.dateStr}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip card positioned below or above hovered item */}
        {activePoint && (
          <div
            onClick={() => navigate(`/review/${activePoint.id}`)}
            className="cursor-pointer mt-3 p-3.5 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
                  {activePoint.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  {activePoint.category}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Attempted {activePoint.fullDate}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-xs text-slate-400 block leading-tight">Score:</span>
                <span className="font-extrabold text-sm text-white">
                  {activePoint.score} / {activePoint.total}{" "}
                  <span className={`font-black ml-1 ${
                    activePoint.pct >= 75 ? "text-emerald-400" : activePoint.pct >= 50 ? "text-blue-400" : "text-amber-400"
                  }`}>
                    ({activePoint.pct}%)
                  </span>
                </span>
              </div>

              <span className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-950/80 border border-blue-800 px-3 py-1.5 rounded-xl">
                Review Test →
              </span>
            </div>
          </div>
        )}

        {!activePoint && points.length > 0 && (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            💡 Hover over any data point to inspect details or click to review that test attempt.
          </p>
        )}
      </div>
    </div>
  );
}
