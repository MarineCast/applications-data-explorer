import { useId } from "react";
export default function PalettePicker<T extends string>({ options, value, onChange }: {
  options: Record<T, { name: string; colors: readonly string[] }>; value: string; onChange: (value: T) => void;
}) {
  const name = useId();
  return <div className="legend-palettes legend-palettes--cards" role="radiogroup" aria-label="Color palette">
    {(Object.keys(options) as T[]).map(id => <label className="legend-palette-row" key={id}>
      <input type="radio" name={name} aria-label={options[id].name} value={id} checked={value === id} onChange={() => onChange(id)} />
      <span className="legend-palette-name">{options[id].name}</span>
      <span className="legend-palette-swatch" aria-hidden="true">{options[id].colors.map((color, i) => <i key={i} style={{ background: color }} />)}</span>
    </label>)}
  </div>;
}
