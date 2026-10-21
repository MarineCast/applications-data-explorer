import {useCallback,useEffect,useState} from "react";
import {orcaCategoryLabels,orcaCaveat,loadOrcaDetails,orcaPodSummary} from "../data/orca";
import type {OrcaData,OrcaDetails,OrcaSighting} from "../data/orca";

function SourceRecord({data,record,autoLoad=false}:{data:OrcaData;record:OrcaSighting;autoLoad?:boolean}){
 const [details,setDetails]=useState<OrcaDetails>(),[error,setError]=useState(false);
 const load=useCallback(()=>loadOrcaDetails(data,record).then(value=>{setDetails(value);setError(false);}).catch(()=>setError(true)),[data,record]);
 useEffect(()=>{if(autoLoad)void load();},[autoLoad,load]);
 const description=record.source_description!==undefined?record.source_description:details?.source_description;
 return <article><h4>{orcaCategoryLabels[record.category]} · {record.source}</h4>
  <dl>
   <div><dt>Reported pods / groups</dt><dd>{record.pod_group_assignments.length?<ul>{record.pod_group_assignments.map((a,i)=><li key={i}><strong>{a.label}</strong> · {a.group_type.replaceAll("_"," ")}{a.conflicting?" · conflicting source evidence":""}</li>)}</ul>:"Unknown pod/group"}<small>{record.pod_group_status.replaceAll("_"," ")}</small></dd></div>
   <div><dt>Reported date / time</dt><dd>{record.observed_at_raw??record.observed_date_raw??record.native_date??"Unknown"}</dd></div>
   <div><dt>Source description</dt><dd className="orca-source-description">{description===undefined?error?"Unable to load description. Open source details to retry.":autoLoad?"Loading source description…":"Open source details to load the original description.":description??"No description supplied by source."}</dd></div>
   <div><dt>Record ID</dt><dd><code>{record.event_id}</code></dd></div>
   <div><dt>Source record</dt><dd>{record.source_record_id}</dd></div>
   <div><dt>Source dataset / native ID</dt><dd>{record.source_dataset_id??"Not supplied"} / {record.source_native_id??"Not supplied"}</dd></div>
   <div><dt>Classification</dt><dd>{record.classification_status} · {record.ecotype_detail}</dd></div>
   <div><dt>Native classification</dt><dd>{record.native_classification??"Not supplied"}</dd></div>
   <div><dt>Reported time (UTC)</dt><dd>{record.observed_at_utc??"No precise UTC instant supplied"} · {record.time_precision} source-text precision</dd></div>
   <div><dt>Native date / time zone</dt><dd>{record.native_date??"Unknown"} / {record.source_timezone}</dd></div>
   <div><dt>UTC bounds</dt><dd>{record.time_start_utc&&record.time_end_utc?`[${record.time_start_utc}, ${record.time_end_utc})`:"Unknown; included only in All time"}</dd></div>
   <div><dt>Reported coordinates</dt><dd>{record.latitude===null?"Not supplied":`${record.latitude}, ${record.longitude}`}</dd></div>
   <div><dt>Raw coordinates</dt><dd>{record.latitude_raw??"Not supplied"}, {record.longitude_raw??"Not supplied"}</dd></div>
   <div><dt>Transform / role</dt><dd>{record.coordinate_transform} / {record.coordinate_role??"Not supplied"}</dd></div>
   <div><dt>Coordinate uncertainty</dt><dd>{record.coordinate_uncertainty_m===null?"Not supplied":`${record.coordinate_uncertainty_m} m`}</dd></div>
   <div><dt>H3 support</dt><dd>{record.h3_r6??"Unavailable"} · {record.h3_precision_status}</dd></div>
   <div><dt>Source retrieved (UTC)</dt><dd>{record.source_retrieved_at_utc??"Unknown"}</dd></div>
   <div><dt>Source use / license</dt><dd>{record.source_use_class} / {record.source_license}</dd></div>
  </dl>
  <details onToggle={event=>{if(event.currentTarget.open)void load();}}><summary>Source lineage and qualifications</summary>
   <p>{record.source_occurrence_count} underlying source occurrences: {record.source_occurrence_ids?.join(", ")||"IDs not supplied"}. This is not an individual whale count.</p>
   <p>{record.classification_evidence_json??details?.classification_evidence_json??(error?"Unable to load source evidence; close and reopen to retry.":"Loading original classification evidence…")}</p>
   {record.pod_group_assignments.map((a,i)=><p key={i}>{a.label} · {a.source_term??"Native term not supplied"} · {a.evidence_field} · {a.confidence} · {a.evidence_text??"No evidence text supplied"}</p>)}
   <p>{record.qc_flags.join(" · ")||"No additional QC flags"}</p>
  </details>
 </article>;
}

export default function OrcaInspector({data,records,eventId,cell}:{data:OrcaData;records:readonly OrcaSighting[];eventId?:string;cell?:string}){
 const key=eventId??cell??"period",[choice,setChoice]=useState({key,page:0}),page=choice.key===key?choice.page:0;
 const [showRecords,setShowRecords]=useState(false);
 const selected=eventId?records.filter(r=>r.event_id===eventId):cell?records.filter(r=>r.h3_r6===cell):records;
 const clamped=Math.min(page,Math.max(0,Math.ceil(selected.length/20)-1));
 const summary=orcaPodSummary(selected);
 const recordList=<>{selected.slice(clamped*20,clamped*20+20).map(record=><SourceRecord key={record.event_id} data={data} record={record} autoLoad={Boolean(eventId)}/>)}
  {selected.length>20&&<nav aria-label="Sighting record pages"><button disabled={!clamped} onClick={()=>setChoice({key,page:clamped-1})}>Previous records</button><span>{clamped*20+1}–{Math.min(selected.length,clamped*20+20)} of {selected.length}</span><button disabled={(clamped+1)*20>=selected.length} onClick={()=>setChoice({key,page:clamped+1})}>Next records</button></nav>}</>;
 return <section className="orca-inspector" aria-label="Reported sighting records"><h3>{eventId?"Reported sighting":"Reported pods / groups"}</h3>
  {cell&&<p>H3 R6 · <code>{cell}</code> · current period and sighting filters</p>}
  <p>{summary.distinctRecords.toLocaleString()} distinct source-deduplicated sighting records</p>
  {!selected.length&&<p>No recorded sightings in this selection. Survey effort and whale absence are not established.</p>}
  {eventId?recordList:<>
   <table className="orca-pod-table"><thead><tr><th scope="col">Reported pod / group</th><th scope="col">Records</th></tr></thead><tbody>{summary.groups.map(g=><tr key={`${g.groupType}:${g.label}`}><th scope="row">{g.label} {g.groupType!=="unknown"&&<small>{g.groupType.replaceAll("_"," ")}</small>}</th><td>{g.records.toLocaleString()}</td></tr>)}</tbody></table>
   <p className="orca-control-note">A record can report multiple pods or groups, so line totals may exceed the distinct sighting count. Untyped identifiers are retained in source details and counted as Unknown here. Pods are never inferred from sighting category or an individual identifier.</p>
   <details onToggle={event=>setShowRecords(event.currentTarget.open)}><summary>Source records ({summary.distinctRecords.toLocaleString()})</summary>{showRecords&&recordList}</details>
  </>}
  <p className="orca-control-note">{orcaCaveat}</p>
 </section>;
}

export function OrcaSourceCoverage({data}:{data:OrcaData}){
 const {providers,dailyCoverage}=data.catalog.source;
 if(!providers?.length&&!dailyCoverage)return null;
 return <details className="orca-inspector orca-source-coverage"><summary>Source coverage and freshness</summary>
  <p className="orca-control-note">Successful refreshes do not establish complete coverage through retrieval. Source-native dates remain distinct from supported UTC periods.</p>
  {providers?.map(provider=><p key={provider.source}><strong>{provider.source}</strong> · {provider.status}<br/>Latest retained native date: {provider.actual_latest_study_sighting_native_date??"Unknown"}<br/>Retrieved: {provider.retrieved_at_utc??"Not refreshed"}<br/>{provider.scope}</p>)}
  {dailyCoverage&&<p className="orca-control-note">{dailyCoverage.daily_included.toLocaleString()} of {dailyCoverage.total_records.toLocaleString()} records can enter daily UTC bins. Native-day intervals and unknown UTC support leave {dailyCoverage.daily_unbinned.toLocaleString()} unbinned daily; All time retains them.</p>}
 </details>;
}
