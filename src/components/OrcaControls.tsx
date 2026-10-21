import {InsightMetrics,RankedBars} from "./InsightCharts";
import CategoryLegendItems from "./CategoryLegendItems";
import LegendDropdown from "./LegendDropdown";
import { orcaCategories, orcaCategoryLabels, orcaCategoryColors } from "../data/orca";
import type { OrcaData, OrcaFrame, OrcaState, OrcaGranularity, OrcaPeriod } from "../data/orca";
import TimelineControls from "./TimelineControls";
import "./OrcaControls.css";
export function OrcaControls({data,state,onChange}:{data:OrcaData;state:OrcaState;onChange:(state:OrcaState)=>void}){
 const all=orcaCategories.every(category=>state.categories.includes(category));
 return <div className="orca-controls">
  {data.catalog.status==="synthetic_fixture"&&<p className="orca-fixture-note">Synthetic fixture · not production observations</p>}
  {state.representation!=="points"&&<fieldset><legend>Sighting types</legend>
   <label><input type="checkbox" aria-label="All sighting types" checked={all} ref={input=>{if(input)input.indeterminate=!all&&state.categories.length>0;}} onChange={()=>onChange({...state,categories:all?[]:orcaCategories})}/>All</label>
   {orcaCategories.map(category=><label key={category}><input type="checkbox" aria-label={orcaCategoryLabels[category]} checked={state.categories.includes(category)} onChange={()=>onChange({...state,categories:state.categories.includes(category)?state.categories.filter(c=>c!==category):orcaCategories.filter(c=>c===category||state.categories.includes(c))})}/><i style={{background:orcaCategoryColors[category]}}/>{orcaCategoryLabels[category]}</label>)}
  </fieldset>}

  <label className="field">Time interval<select aria-label="Sighting time granularity" value={state.granularity} onChange={e=>onChange({...state,granularity:e.target.value as OrcaGranularity})}><option value="daily">Daily</option><option value="weekly">Weekly · Monday UTC</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="all">All time</option></select></label>
  <label className="field">View<select aria-label="Orca representation" value={state.representation} onChange={e=>onChange({...state,representation:e.target.value as OrcaState["representation"]})}><option value="counts">H3 sighting record counts</option><option value="points">Reported sighting points</option></select></label>
  {state.representation==="points"&&<label><input type="checkbox" aria-label="Whale symbols" checked={state.whaleMarkers} onChange={e=>onChange({...state,whaleMarkers:e.target.checked})}/>Whale symbols<small>Symbols mark reports, not individual whales.</small></label>}

 </div>;
}
export function OrcaTimeline({state,periods,frame,onChange}:{state:OrcaState;periods:readonly OrcaPeriod[];frame:OrcaFrame;onChange:(state:OrcaState)=>void}){
 const values=periods.map(p=>p.key),format=(key:string)=>periods.find(p=>p.key===key)?.label??"Unavailable";
 const unit=state.granularity==="yearly"?"year":state.granularity==="monthly"?"month":state.granularity==="weekly"?"week":"day";
 return <TimelineControls key={`${state.granularity}:${state.categories.join()}`} label="Orca sightings timeline"
  startDate={periods[0]?.start?.slice(0,10)??""} endDate={periods.at(-1)?.start?.slice(0,10)??""} increment={{unit}}
  values={values} value={frame.period.key} onChange={key=>onChange({...state,anchor:periods.find(p=>p.key===key)?.start??null})}
  rangeLabel="Sighting period timeline" stepLabel="sighting period" playbackLabel="sightings playback" format={format} basisLabel={state.granularity==="all"?"Source time support":"UTC"}
  caption={`${frame.records.length.toLocaleString()} records${frame.unassignedTime?` · ${frame.unassignedTime} undated/boundary-spanning excluded`:""}${frame.undatedIncluded?` · ${frame.undatedIncluded} undated included`:""}`}/>;
}
export function OrcaPointLegend({state,onChange,side,open,onOpenChange}:{state:OrcaState;onChange:(state:OrcaState)=>void;side?:string;open?:boolean;onOpenChange?:(open:boolean)=>void}){
 return <LegendDropdown className="orca-point-legend categorical-legend" label={`${side?side+" ":""}Sighting point legend`} buttonLabel={`${side?side+" ":""}Sighting legend`} popupLabel={`${side?side+" ":""}Sighting display`} heading="Display" open={open} onOpenChange={onOpenChange}
 preview={<strong>{side?`${side} · `:""}Reported sightings</strong>}
 items={<CategoryLegendItems identity="orca" items={orcaCategories.map(category=>({key:category,label:orcaCategoryLabels[category],color:orcaCategoryColors[category],selected:state.categories.includes(category)}))} onSelectionChange={keys=>onChange({...state,categories:orcaCategories.filter(category=>keys.includes(category))})}/> }>
 <button type="button" aria-pressed={state.whaleMarkers} onClick={()=>onChange({...state,whaleMarkers:!state.whaleMarkers})}>Whale symbols</button>
 </LegendDropdown>;
}

export function OrcaDemography({data,state}:{data:OrcaData;state:OrcaState}){
 const series=data.catalog.demography;
 if(!series)return null;
 return <section className="orca-demography" aria-label="Verified annual SRKW census"><h3>Annual SRKW census</h3>
  {state.categories.includes("srkw")?<><p>Primary-confirmed Center for Whale Research census estimates · individual whales.</p><table className="orca-pod-table"><thead><tr><th scope="col">Year</th><th scope="col">J</th><th scope="col">K</th><th scope="col">L</th><th scope="col">Total</th></tr></thead><tbody>{series.rows.map(row=><tr key={row.census_year}><th scope="row">{row.census_year}</th><td>{row.j_pod}</td><td>{row.k_pod}</td><td>{row.l_pod}</td><td>{row.all_pods}</td></tr>)}</tbody></table><p>Annual census values are separate from sighting record counts and are not repeated across the sighting slider’s daily, weekly or monthly frames.</p></>:<p>No verified demographic series is supplied for the selected sighting types.</p>}
  <p>Only 2024 and 2025 are verified here. No 2026 census or transient/other population is inferred.</p>
  <p>{series.limitations}</p>{series.sourceUrl==="https://www.whaleresearch.com/orca-population"&&<a href={series.sourceUrl} target="_blank" rel="noreferrer">Center for Whale Research census source</a>}
 </section>;
}

export function OrcaOverview({frame}:{frame:OrcaFrame}){
 return <><InsightMetrics items={[{label:"Reports",value:frame.records.length},{label:"Located",value:frame.points.length},{label:"Without H3",value:frame.unbinned}]}/>
 <RankedBars title="Sighting types" caption={`${frame.period.label} · filtered source records`} rows={orcaCategories.map(category=>({key:category,label:orcaCategoryLabels[category],value:frame.categoryCounts[category],color:orcaCategoryColors[category]}))}/>
 <p className="insights-note">Reports are not individual whales. No reports does not establish absence.</p></>;
}
