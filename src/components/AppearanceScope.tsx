export interface AppearanceLink { linked: boolean; onChange: (linked: boolean) => void }
export default function AppearanceScope({ scope, side }: { scope?: AppearanceLink; side?: string }) {
  if (!scope) return null;
  return <div className="legend-appearance-scope">
    <label><input type="checkbox" checked={scope.linked} onChange={event => scope.onChange(event.target.checked)} />Link appearance between maps</label>
    <p>{scope.linked ? "Applies to both maps" : `Applies to the ${side?.toLowerCase() ?? "left"} map only`}</p>
    {!scope.linked && <small>Linking uses the left map’s appearance.</small>}
  </div>;
}
