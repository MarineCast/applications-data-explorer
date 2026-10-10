import { featureById, histogram } from "../data/demo";
import type { FeatureId } from "../data/demo";
export function Scatter({
  rows,
  x,
  y,
  highlight = false,
}: {
  rows: { x: number; y: number }[];
  x: FeatureId;
  y: FeatureId;
  highlight?: boolean;
}) {
  const fx = featureById(x),
    fy = featureById(y);
  const px = (v: number) =>
    60 + ((v - fx.range[0]) / (fx.range[1] - fx.range[0])) * 500;
  const py = (v: number) =>
    290 - ((v - fy.range[0]) / (fy.range[1] - fy.range[0])) * 250;
  return (
    <svg
      className="scatter"
      viewBox="0 0 600 345"
      role="img"
      aria-label={`${fx.short} versus ${fy.short}, ${rows.length} synthetic observations`}
    >
      <g>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="60"
              y1={40 + i * 62.5}
              x2="560"
              y2={40 + i * 62.5}
              stroke="#e8ede8"
            />
            <text x="48" y={44 + i * 62.5} textAnchor="end">
              {(fy.range[1] - ((fy.range[1] - fy.range[0]) * i) / 4).toFixed(1)}
            </text>
            <text x={60 + i * 125} y="313" textAnchor="middle">
              {(fx.range[0] + ((fx.range[1] - fx.range[0]) * i) / 4).toFixed(1)}
            </text>
          </g>
        ))}
        {rows
          .filter((_, i) => i % Math.max(1, Math.ceil(rows.length / 650)) === 0)
          .map((r, i) => (
            <circle
              key={i}
              cx={px(r.x)}
              cy={py(r.y)}
              r={highlight ? 4 : 2.6}
              fill={highlight ? "#c77d54" : "#4d9289"}
              opacity={highlight ? 0.7 : 0.32}
            />
          ))}
        <text x="310" y="339" textAnchor="middle">
          {fx.short} ({fx.unit})
        </text>
        <text x="15" y="168" transform="rotate(-90 15 168)" textAnchor="middle">
          {fy.short} ({fy.unit})
        </text>
      </g>
    </svg>
  );
}
export function Histogram({
  values,
  feature,
  color = "#6b9d8a",
}: {
  values: number[];
  feature: FeatureId;
  color?: string;
}) {
  const f = featureById(feature);
  const bins = histogram(values, f.range);
  const max = Math.max(1, ...bins);
  return (
    <svg
      className="histogram"
      viewBox="0 0 520 180"
      role="img"
      aria-label={`${f.short} distribution, ${values.length} synthetic values`}
    >
      {bins.map((n, i) => (
        <rect
          key={i}
          x={24 + i * 39}
          y={140 - (n / max) * 115}
          width="31"
          height={(n / max) * 115}
          rx="3"
          fill={color}
        >
          <title>{n} samples</title>
        </rect>
      ))}
      <text x="24" y="163">
        {f.range[0]} {f.unit}
      </text>
      <text x="492" y="163" textAnchor="end">
        {f.range[1]} {f.unit}
      </text>
    </svg>
  );
}
