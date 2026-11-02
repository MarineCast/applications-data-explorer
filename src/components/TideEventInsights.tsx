import type {SeascapeLayer} from '../data/seascape';
export default function TideEventInsights({layer,cell}:{layer:SeascapeLayer;cell?:string}){
 if(!cell)return <p>Select a cell to see all predicted high and low tide times.</p>;
 const mapping=layer.field.tideEvents!.mapping[cell],events=layer.tideEvents?.[cell];
 if(!mapping||!events||events.high_tide_times_utc===null)return <p>Unavailable for this cell and UTC event day. No station prediction assigned; this does not mean no tides.</p>;
 const station=layer.field.tideEvents!.stations[mapping.station];
 return <section aria-label="Tide event times"><p>{cell} · UTC event day {layer.slice?.value}</p><p>{station.name} · {station.provider.toUpperCase()} · {station.id} · {station.timezone}</p><p>Water-connected station proxy within {mapping.distance_km.toFixed(2)} km. No local interpolation. Local dates and offsets are retained; they can differ from the UTC event day.</p>
 {(['high','low'] as const).map(kind=><section key={kind}><h4>{kind==='high'?'High tides':'Low tides'}</h4>{events[`${kind}_tide_times_utc`]!.length?<table style={{width:"100%",fontSize:12,tableLayout:"fixed",overflowWrap:"anywhere"}}><thead><tr><th>UTC</th><th>Station local time</th></tr></thead><tbody>{events[`${kind}_tide_times_utc`]!.map((utc,i)=><tr key={`${utc}:${i}`}><td>{utc}</td><td>{events[`${kind}_tide_local_times`]![i]}</td></tr>)}</tbody></table>:<p>No {kind} events reported in this UTC day.</p>}</section>)}
 <p>Predicted timing, not observed water level or navigation guidance. Historical issue date unknown; not forecast eligible.</p></section>;
}
