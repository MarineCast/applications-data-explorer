import {useState} from "react";
import AtlasDialog from "./AtlasDialog";
import type {StationTemperature} from "../data/stationTemperature";
export default function StationTemperaturePanel({data,stationId,day,onDate,onClose}:{data:StationTemperature;stationId:string;day:string;onDate:(day:string)=>void;onClose:()=>void}){
 const s=data.stations[stationId];
 const [selection,setSelection]=useState({stationId,statistic:"daily_mean"});
 const statistic=selection.stationId===stationId&&s.statistics.includes(selection.statistic)?selection.statistic:"daily_mean";
 const label=statistic==="daily_min"?"daily minimum":statistic==="daily_max"?"daily maximum":"daily mean";
 const stationRows=data.rows.filter(r=>r.station_id===stationId),rows=stationRows.filter(r=>r.statistic===statistic),row=rows.find(r=>r.date===day);
 const flags=row?JSON.parse(row.quality_flags):undefined;
 const unchecked=rows.filter(r=>JSON.parse(r.quality_flags).checked===false).length;
 const first=rows[0].date,last=rows.at(-1)!.date,min=Math.min(...rows.map(r=>r.value)),max=Math.max(...rows.map(r=>r.value));
 const ordinal=(d:string)=>Date.parse(d+"T00:00:00Z")/86400000; // Display spacing only; no UTC aggregation or joining.
 const x=(d:string)=>45+510*(ordinal(d)-ordinal(first))/Math.max(1,ordinal(last)-ordinal(first));
 const y=(v:number)=>155-120*(v-min)/Math.max(1,max-min);
 return <AtlasDialog title="Station water temperature" onClose={onClose}><div className="station-temperature-panel">
  <h3>{s.provider_station_name}</h3><p>{s.station_id} · {s.provider} · {s.river_id} river association</p>
  <p><strong>Measured station location:</strong> {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)} · Coordinate datum: {s.coordinate_crs}. {s.relationship}</p>
  <p>{s.day_definition}. {s.timezone??"Timezone not supplied"}. Dates are retained as reported; no UTC or daylight-saving conversion.</p>
  {s.statistics.length>1&&<label>Statistic<select aria-label="Station temperature statistic" value={statistic} onChange={e=>setSelection({stationId,statistic:e.target.value})}>{s.statistics.map(v=><option key={v} value={v}>{v==="daily_min"?"Daily minimum":v==="daily_max"?"Daily maximum":"Daily mean"}</option>)}</select></label>}
  <label>Selected native provider date<input aria-label="Station temperature date" type="date" value={day} onChange={e=>onDate(e.target.value)}/></label>
  <p role="status"><strong>{row?`${row.value} °C · reported ${label}`:"Unavailable on this date"}</strong></p>
  {flags&&<p aria-label="Selected observation quality"><strong>{flags.checked===false?"Unchecked · ":""}{flags.provisional===true?"Provisional · ":""}</strong>{flags.provider_quality_label??s.quality}{flags.edited===true?" · edited":""}. Approval: {flags.approval??"not supplied"}. Parser acceptance is not provider approval.</p>}
  {unchecked>0&&<p>{unchecked} reported readings have not yet been checked by the provider.</p>}
  <button type="button" onClick={()=>onDate(last)}>Latest reported observation · {last}</button>
  <p>{rows.length} reported dates for {label} · {first}–{last}. Dots show observations only; absent intervals are not connected or filled.</p>
  {s.statistics.length>1&&<p>{stationRows.length} observations across {s.statistics.length} statistics; {new Set(stationRows.map(r=>r.date)).size} distinct dates. Map markers use daily mean.</p>}
  <svg viewBox="0 0 600 190" role="img" aria-label={`${s.provider_station_name} sparse ${label} temperature observations`}>
   <text x="8" y="25">°C</text><text x="4" y="45">{max}</text><text x="4" y="157">{min}</text>
   <line x1="45" x2="555" y1="158" y2="158" stroke="#bccbd2"/>
   {rows.map(r=><circle key={r.date} cx={x(r.date)} cy={y(r.value)} r={r.date===day?5:3} fill={r.date===day?"#173e5c":"#bf6127"} role="button" tabIndex={0} aria-label={`${r.date}: ${r.value} °C`} onClick={()=>onDate(r.date)} onKeyDown={e=>{if(e.key==="Enter")onDate(r.date);}}><title>{r.date}: {r.value} °C</title></circle>)}
   <text x="45" y="181">{first}</text><text x="555" y="181" textAnchor="end">{last}</text>
  </svg>
  <p>{s.day_definition}. {s.quality}. {s.availability}. Research only; model-ineligible.</p>
  {row&&<details><summary>Selected observation source</summary><p><a href={row.source_url} target="_blank" rel="noreferrer">{row.source_title}</a> · report {row.report_date} · retrieved {row.retrieved_at}</p><p>Quality flags: {row.quality_flags}</p></details>}
  <details><summary>Location and source qualifications</summary><p>{s.identity_note}. {s.coordinate_precision??s.coordinate_accuracy??"Coordinate precision not supplied"}. {s.coordinate_conversion&&`Source ${s.source_coordinate_crs}; transformation: ${s.coordinate_conversion}; stated accuracy ${s.coordinate_conversion_accuracy_metres} m.`} <a href={s.coordinate_source} target="_blank" rel="noreferrer">{s.coordinate_source_detail??"Provider station coordinates"}</a></p><p>{s.cadence}. {data.missingness}.</p><p>{s.author??s.provider}. {s.rights??"See provider rights information"}. <a href={s.rights_url} target="_blank" rel="noreferrer">Provider rights</a></p></details>
 </div></AtlasDialog>;
}
