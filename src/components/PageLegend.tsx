import LegendDropdown from "./LegendDropdown";

export default function PageLegend({ name, entries, note }: {
  name: string; entries: { color: string; label: string }[]; note: string;
}) {
  return <LegendDropdown className="page-legend" label={`${name} legend`} buttonLabel="Legend"
    popupLabel={`${name} legend key`} heading="Legend" closeLabel="Close legend"
    preview={<><div className="map-legend-colors" aria-hidden="true">
      {entries.map(entry => <span key={entry.label} style={{ background: entry.color }} />)}
    </div><div className="map-legend-ticks"><span>{name}</span><span>Legend</span></div></>}>
    <div className="legend-category-key">{entries.map(entry => <div key={entry.label}>
      <i style={{ background: entry.color }} />{entry.label}
    </div>)}</div>
    <p className="legend-scale-note">{note}</p>
  </LegendDropdown>;
}
