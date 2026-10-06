import type { FeatureId, Region } from "../data/demo";
import { features } from "../data/demo";
export function FeatureSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FeatureId;
  onChange: (v: FeatureId) => void;
}) {
  return (
    <label className="field">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FeatureId)}
      >
        {features.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function RegionSelect({
  value,
  onChange,
}: {
  value: Region;
  onChange: (v: Region) => void;
}) {
  return (
    <label className="field">
      Region
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Region)}
      >
        <option value="all">Salish Sea</option>
        <option value="north">Northern waters</option>
        <option value="south">Southern waters</option>
      </select>
    </label>
  );
}
export function SeasonSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      Season
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All seasons</option>
        <option value="winter">Winter</option>
        <option value="spring">Spring</option>
        <option value="summer">Summer</option>
        <option value="autumn">Autumn</option>
      </select>
    </label>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty" role="status">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
