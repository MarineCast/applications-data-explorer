import { useEffect, useRef } from 'react';
import type { RelationshipField, RelationshipResult } from '../data/relationships';
import { relationshipName } from '../data/relationships';

const unit = (f: RelationshipField) => !f.unit || /unavailable|source units/i.test(f.unit) ? 'unit not declared' : f.unit;
const format = (v: number) => new Intl.NumberFormat('en', { maximumSignificantDigits: 3 }).format(v);

/** Marks are drawn from server summaries; the accessible table/readout shares those exact values. */
function NumericPlot({ result, x, y }: { result: RelationshipResult; x: RelationshipField; y: RelationshipField }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !result.pair.ranges) return;
    const render = () => {
      const w = canvas.clientWidth, h = 220, ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * ratio; canvas.height = h * ratio;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.scale(ratio, ratio);
      const dark = document.documentElement.dataset.appTheme === 'dark';
      const ink = dark ? '#a4bdc9' : '#4a6b82', line = dark ? '#385464' : '#d8e3e8';
      const [xmin, xmax] = result.pair.ranges!.x, [ymin, ymax] = result.pair.ranges!.y;
      const px = (v: number) => 48 + (v - xmin) / (xmax - xmin || 1) * (w - 65);
      const py = (v: number) => (h - 35) - (v - ymin) / (ymax - ymin || 1) * (h - 52);
      ctx.font = '10px Arial'; ctx.strokeStyle = line; ctx.fillStyle = ink;
      for (let i = 0; i < 5; i++) {
        const yy = ymin + (ymax - ymin) * i / 4, xx = xmin + (xmax - xmin) * i / 4;
        ctx.beginPath(); ctx.moveTo(48, py(yy)); ctx.lineTo(w - 17, py(yy)); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillText(format(yy), 41, py(yy) + 3);
        ctx.textAlign = 'center'; ctx.fillText(format(xx), px(xx), h - 16);
      }
      const density = result.pair.density;
      if (density) {
        const max = Math.max(...density.counts.flat());
        density.counts.forEach((column, i) => column.forEach((count, j) => {
          if (!count) return;
          ctx.fillStyle = `rgba(42,138,183,${.15 + .85 * Math.log1p(count) / Math.log1p(max)})`;
          ctx.fillRect(px(density.xEdges[i]), py(density.yEdges[j + 1]), (w - 65) / column.length + .4, (h - 52) / column.length + .4);
        }));
      } else {
        ctx.fillStyle = '#3c9acd99';
        for (const point of result.pair.points) { ctx.beginPath(); ctx.arc(px(point.x), py(point.y), 2.3, 0, Math.PI * 2); ctx.fill(); }
      }
    };
    render(); const observer = new ResizeObserver(render); observer.observe(canvas);
    const mutation = new MutationObserver(render); mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['data-app-theme'] });
    return () => { observer.disconnect(); mutation.disconnect(); };
  }, [result]);
  return <div className="rel-numeric-plot"><p className="rel-axis-title">{relationshipName(y)} · {unit(y)}</p><canvas ref={ref} role="img" aria-label={`${result.pair.plot} of ${relationshipName(x)} and ${relationshipName(y)}, ${result.pair.diagnostics.complete} complete pairs. Statistics below.`} /><p className="rel-axis-title rel-x-title">{relationshipName(x)} · {unit(x)}</p></div>;
}

export default function RelationshipsPlots({ result }: { result: RelationshipResult }) {
  const x = result.variables.find(f => f.key === result.pair.x), y = result.variables.find(f => f.key === result.pair.y);
  if (result.pair.reason) return <div className="rel-empty" role="status">{result.pair.reason}</div>;
  if (!x || !y) return null;
  if (result.pair.ranges) return <NumericPlot result={result} x={x} y={y} />;
  if (result.pair.groups.length) {
    const groups = result.pair.groups, min = Math.min(...groups.map(g => g.min)), max = Math.max(...groups.map(g => g.max));
    const percent = (n: number) => (n - min) / (max - min || 1) * 100;
    return <div className="rel-groups"><p>Median, IQR; whiskers to most extreme observations within 1.5 × IQR. Outliers remain in statistics.</p>{groups.map(g => <div className="rel-group" key={g.label}>
      <span title={g.label}>{g.label}</span><div className="rel-box-track" role="img" aria-label={`${g.label}: n ${g.n}, median ${format(g.median)}, Q1 ${format(g.q1)}, Q3 ${format(g.q3)}`}>
        <span className="rel-whisker" style={{ left: `${percent(g.low)}%`, width: `${percent(g.high) - percent(g.low)}%` }} />
        <span className="rel-box" style={{ left: `${percent(g.q1)}%`, width: `${Math.max(.3, percent(g.q3) - percent(g.q1))}%` }} />
        <span className="rel-median" style={{ left: `${percent(g.median)}%` }} />
        {g.points?.map((v, i) => <i key={i} className="rel-strip-point" style={{ left: `${percent(v)}%`, top: `${8 + (i * 17 % 28)}px` }} />)}
      </div><small>n = {g.n.toLocaleString()} · median {format(g.median)}</small>
    </div>)}<p>{relationshipName(result.pair.numericAxis === 'x' ? x : y)} · {(result.pair.numericAxis === 'x' ? x : y).unit}</p><p>Range {format(min)} – {format(max)}{result.pair.plot === 'strip' && ' · up to 100 deterministic sampled marks per group'}</p></div>;
  }
  const t = result.pair.contingency;
  return t && <div className="rel-table-scroll"><table className="rel-contingency"><caption>Complete-pair counts · category IDs are labels · n = {t.n.toLocaleString()}</caption><thead><tr><th>{relationshipName(x)} / {relationshipName(y)}</th>{t.y.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{t.x.map((label, i) => <tr key={label}><th>{label}</th>{t.counts[i].map((n, j) => <td key={j}>{n.toLocaleString()} <small>({(100 * n / t.n).toFixed(1)}%)</small></td>)}</tr>)}</tbody></table></div>;
}
