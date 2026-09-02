import React from 'react';

/**
 * ponytail: Normal Question Renderer.
 * Removes artificial shaded box containers around text, keeping question text normal,
 * clean, and readable with natural whitespace-pre-line paragraphs, while preserving
 * SVG graphs and data tables for Data Interpretation.
 * Ceiling: SVG chart generators covering 2D bar, line, pie, and combo charts. Upgrade path: Canvas/WebGL if 3D requested.
 */

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
];

// ── SVG PIE / DONUT CHART ──
function RenderPieChart({ items, totalSum }) {
  const total = totalSum || items.reduce((acc, item) => acc + (parseFloat(item.value) || 0), 0);
  if (total <= 0) return null;

  const cx = 100;
  const cy = 100;
  const r = 80;
  const rInner = 42;

  let currentAngle = -Math.PI / 2;
  const slices = items.map((item, idx) => {
    const val = parseFloat(item.value) || 0;
    const pct = ((val / total) * 100).toFixed(1);
    const sliceAngle = (val / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const x3 = cx + rInner * Math.cos(endAngle);
    const y3 = cy + rInner * Math.sin(endAngle);
    const x4 = cx + rInner * Math.cos(startAngle);
    const y4 = cy + rInner * Math.sin(startAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    const pathData = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

    const midAngle = startAngle + sliceAngle / 2;
    const labelR = (r + rInner) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    return {
      label: item.label,
      val,
      pct,
      pathData,
      color: PALETTE[idx % PALETTE.length],
      lx,
      ly,
      sliceAngle
    };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-6 p-5 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800 my-4 select-none">
      <div className="relative w-48 h-48 shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
          {slices.map((slice, i) => (
            <g key={i}>
              <path d={slice.pathData} fill={slice.color} stroke="#0f172a" strokeWidth="2" />
              {slice.sliceAngle > 0.35 && (
                <text x={slice.lx} y={slice.ly} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                  {slice.pct}%
                </text>
              )}
            </g>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
          <span className="text-xs font-black text-white font-mono">{total.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2.5 w-full">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: s.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-200 truncate">{s.label}</div>
              <div className="text-[11px] font-mono text-slate-400 font-semibold">{s.pct}% ({s.val})</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SVG BAR CHART ──
function RenderBarChart({ title, entities, metricKeys, data }) {
  const allVals = data.flatMap(row => metricKeys.map(mk => parseFloat(row.metrics[mk]) || 0));
  const maxVal = Math.max(...allVals, 10);
  const chartHeight = 160;
  const topMargin = 30;
  const leftMargin = 45;
  const chartWidth = 440;

  const groupWidth = chartWidth / entities.length;
  const barWidth = Math.max(12, Math.min(30, (groupWidth - 16) / metricKeys.length));

  return (
    <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800 my-4 overflow-x-auto select-none">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{title || "Bar Chart"}</span>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
          {metricKeys.map((mk, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <span className="text-slate-300">{mk}</span>
            </div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${leftMargin + chartWidth + 20} ${topMargin + chartHeight + 40}`} className="w-full min-w-[360px] h-auto">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = topMargin + chartHeight - ratio * chartHeight;
          const val = Math.round(ratio * maxVal);
          return (
            <g key={i}>
              <line x1={leftMargin} y1={y} x2={leftMargin + chartWidth} y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
              <text x={leftMargin - 8} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="bold" className="font-mono">
                {val}
              </text>
            </g>
          );
        })}

        {data.map((row, groupIdx) => {
          const groupStartX = leftMargin + groupIdx * groupWidth + (groupWidth - metricKeys.length * barWidth) / 2;
          return (
            <g key={groupIdx}>
              {metricKeys.map((mk, mIdx) => {
                const val = parseFloat(row.metrics[mk]) || 0;
                const h = (val / maxVal) * chartHeight;
                const x = groupStartX + mIdx * barWidth;
                const y = topMargin + chartHeight - h;
                const color = PALETTE[mIdx % PALETTE.length];

                return (
                  <g key={mIdx}>
                    <rect x={x} y={y} width={barWidth - 3} height={h} fill={color} rx="3" />
                    {barWidth >= 16 && (
                      <text x={x + (barWidth - 3) / 2} y={y - 4} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" className="font-mono">
                        {val}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={leftMargin + groupIdx * groupWidth + groupWidth / 2} y={topMargin + chartHeight + 20} fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">
                {row.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── SVG LINE GRAPH ──
function RenderLineGraph({ title, points }) {
  const vals = points.map(p => parseFloat(p.value) || 0);
  const maxVal = Math.max(...vals, 10);
  const chartHeight = 150;
  const topMargin = 30;
  const leftMargin = 45;
  const chartWidth = 440;

  const pointCoords = points.map((p, i) => {
    const x = leftMargin + (i / Math.max(points.length - 1, 1)) * chartWidth;
    const val = parseFloat(p.value) || 0;
    const y = topMargin + chartHeight - (val / maxVal) * chartHeight;
    return { x, y, val, label: p.label };
  });

  const pathD = pointCoords.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");
  const areaD = `${pathD} L ${pointCoords[pointCoords.length - 1].x} ${topMargin + chartHeight} L ${pointCoords[0].x} ${topMargin + chartHeight} Z`;

  return (
    <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800 my-4 overflow-x-auto select-none">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{title || "Line Graph"}</span>
        <span className="text-xs font-bold text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-md border border-blue-800/60">Trend Line</span>
      </div>

      <svg viewBox={`0 0 ${leftMargin + chartWidth + 25} ${topMargin + chartHeight + 40}`} className="w-full min-w-[360px] h-auto">
        <defs>
          <linearGradient id="lineGradLocked" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = topMargin + chartHeight - ratio * chartHeight;
          const val = Math.round(ratio * maxVal);
          return (
            <g key={i}>
              <line x1={leftMargin} y1={y} x2={leftMargin + chartWidth} y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
              <text x={leftMargin - 8} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="bold" className="font-mono">
                {val}
              </text>
            </g>
          );
        })}

        <path d={areaD} fill="url(#lineGradLocked)" />
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {pointCoords.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
            <text x={pt.x} y={pt.y - 10} fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle" className="font-mono">
              {pt.val}
            </text>
            <text x={pt.x} y={topMargin + chartHeight + 20} fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">
              {pt.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── SVG COMBINATION CHART (BAR + LINE) ──
function RenderComboChart({ title, data }) {
  const prodVals = data.map(d => parseFloat(d.metrics.Production) || 0);
  const salesVals = data.map(d => parseFloat(d.metrics.Sales) || 0);
  const maxVal = Math.max(...prodVals, ...salesVals, 10);

  const chartHeight = 150;
  const topMargin = 30;
  const leftMargin = 45;
  const chartWidth = 440;

  const groupWidth = chartWidth / data.length;
  const barWidth = 32;

  const linePoints = data.map((d, i) => {
    const x = leftMargin + i * groupWidth + groupWidth / 2;
    const val = parseFloat(d.metrics.Sales) || 0;
    const y = topMargin + chartHeight - (val / maxVal) * chartHeight;
    return { x, y, val };
  });

  const linePathD = linePoints.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");

  return (
    <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800 my-4 overflow-x-auto select-none">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{title || "Combination Chart (Production & Sales)"}</span>
        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-blue-500" />
            <span className="text-slate-300">Production (Bars)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-400" />
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-slate-300">Sales (Line)</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${leftMargin + chartWidth + 25} ${topMargin + chartHeight + 40}`} className="w-full min-w-[360px] h-auto">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = topMargin + chartHeight - ratio * chartHeight;
          const val = Math.round(ratio * maxVal);
          return (
            <g key={i}>
              <line x1={leftMargin} y1={y} x2={leftMargin + chartWidth} y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
              <text x={leftMargin - 8} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="bold" className="font-mono">
                {val}
              </text>
            </g>
          );
        })}

        {data.map((row, i) => {
          const val = parseFloat(row.metrics.Production) || 0;
          const h = (val / maxVal) * chartHeight;
          const x = leftMargin + i * groupWidth + (groupWidth - barWidth) / 2;
          const y = topMargin + chartHeight - h;

          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={h} fill="#3b82f6" rx="4" />
              <text x={x + barWidth / 2} y={y - 4} fill="#60a5fa" fontSize="9" fontWeight="bold" textAnchor="middle" className="font-mono">
                {val}
              </text>
              <text x={leftMargin + i * groupWidth + groupWidth / 2} y={topMargin + chartHeight + 20} fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">
                {row.name}
              </text>
            </g>
          );
        })}

        <path d={linePathD} fill="none" stroke="#fb7185" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {linePoints.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="5" fill="#fb7185" stroke="#ffffff" strokeWidth="2" />
            <text x={pt.x} y={pt.y - 8} fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle" className="font-mono">
              {pt.val}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── MAIN QUESTION FORMATTER COMPONENT ──
export default function FormattedQuestionText({ text, section = "", className = "" }) {
  if (!text) return null;

  const lowerText = text.toLowerCase();
  const isDataInterpretationSection = 
    (section && section.toLowerCase().includes("data interpretation")) ||
    lowerText.includes("bar chart") ||
    lowerText.includes("pie chart") ||
    lowerText.includes("line graph") ||
    lowerText.includes("combination chart") ||
    lowerText.includes("histogram");

  // Markdown Pipe Table Parser
  const parseTable = (lines) => {
    const tableLines = lines.filter(l => l.trim().includes('|'));
    if (tableLines.length === 0) return null;
    
    const rows = tableLines.map(line => 
      line.split('|').map(cell => cell.trim()).filter((cell, idx, arr) => {
        if ((idx === 0 || idx === arr.length - 1) && cell === '') return false;
        return true;
      })
    ).filter(row => row.length > 0);

    const cleanRows = rows.filter(row => !row.every(c => /^[:\-\s]+$/.test(c)));
    if (cleanRows.length === 0) return null;

    const headers = cleanRows[0];
    const bodyRows = cleanRows.slice(1);

    return (
      <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2.5 font-bold uppercase tracking-wider text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-mono">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
            {bodyRows.map((r, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/50'}>
                {r.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap font-mono">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Explicit Graph Matching Parser
  const parseExplicitGraph = (lines, fullBlockText) => {
    if (!isDataInterpretationSection) return null;

    const kvLines = lines.filter(l => /^[A-Za-z0-9\s\(\)]+:\s*.+$/.test(l.trim()));

    // 1. Line Graph
    if (lowerText.includes("line graph") || (lines.length === 1 && lines[0].includes(":") && lines[0].includes(","))) {
      const lineStr = lines[0] || "";
      if (lineStr.includes(":")) {
        const items = lineStr.split(',').map(part => {
          const [lbl, val] = part.trim().split(':');
          return { label: lbl?.trim() || '', value: val?.trim() || '0' };
        }).filter(i => i.label && i.value);

        if (items.length >= 3) {
          return <RenderLineGraph title="Monthly Rainfall Recorded (mm)" points={items} />;
        }
      }
    }

    if (kvLines.length < 2) return null;

    // 2. Bar Chart
    if (lowerText.includes("bar chart") || kvLines.every(l => l.includes('-') && l.includes(','))) {
      const parsed = kvLines.map(l => {
        const [name, rest] = l.split(':');
        const metrics = Object.fromEntries(
          rest.split(',').map(m => {
            const parts = m.trim().split('-');
            return [parts[0].trim(), parts[1]?.trim() || ''];
          })
        );
        return { name: name.trim(), metrics };
      });
      const metricKeys = Array.from(new Set(parsed.flatMap(p => Object.keys(p.metrics))));
      const entities = parsed.map(p => p.name);

      return <RenderBarChart title="Units Sold (in hundreds) by Four Stores" entities={entities} metricKeys={metricKeys} data={parsed} />;
    }

    // 3. Combination Chart
    if (lowerText.includes("combination chart") || kvLines.every(l => l.includes('='))) {
      const parsed = kvLines.map(l => {
        const [name, rest] = l.split(':');
        const metrics = Object.fromEntries(
          rest.split(',').map(m => {
            const [k, v] = m.trim().split('=');
            return [k?.trim() || '', v?.trim() || ''];
          })
        );
        return { name: name.trim(), metrics };
      });

      return <RenderComboChart title="Quarterly Production vs Sales" data={parsed} />;
    }

    // 4. Pie Chart
    if (lowerText.includes("pie chart") || kvLines.every(l => l.includes(':') && (l.includes('%') || !isNaN(parseInt(l.split(':')[1]))))) {
      const items = kvLines.map(l => {
        const [k, v] = l.split(':');
        return { label: k.trim(), value: parseFloat(v) || 0 };
      });

      const totalMatch = fullBlockText.match(/Total\s*=\s*[₹$]?([\d,]+)/i);
      const totalSum = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0;

      return <RenderPieChart items={items} totalSum={totalSum} />;
    }

    return null;
  };

  const blocks = text.split(/\n\s*\n/).filter(b => b.trim());

  return (
    <div className={`space-y-4 text-slate-900 dark:text-white select-text ${className}`}>
      {blocks.map((block, bIdx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

        // Markdown Table
        if (lines.some(l => l.includes('|'))) {
          const tableNode = parseTable(lines);
          if (tableNode) return <React.Fragment key={bIdx}>{tableNode}</React.Fragment>;
        }

        // Explicit Graph Node
        if (isDataInterpretationSection) {
          const graphNode = parseExplicitGraph(lines, block);
          if (graphNode) return <React.Fragment key={bIdx}>{graphNode}</React.Fragment>;
        }

        // Normal paragraph text (clean, unboxed, whitespace-pre-line)
        return (
          <p key={bIdx} className="text-base sm:text-lg font-semibold leading-relaxed text-slate-900 dark:text-white whitespace-pre-line">
            {block}
          </p>
        );
      })}
    </div>
  );
}
