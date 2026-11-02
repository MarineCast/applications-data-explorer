import {RankedBars,InsightMetrics} from "./InsightCharts";
import PalettePicker from "./PalettePicker";
import AppearanceScope from "./AppearanceScope";
import type { AppearanceLink } from "./AppearanceScope";
import LegendInfo from "./LegendInfo";
import LegendDropdown from "./LegendDropdown";
import { palettes } from "../data/colorScale";
import type { HydrologyAppearance } from "../data/hydrologyOverlay";
import { defaultHydrologyAppearance, hydrologyPaletteColors, hydrologyRiverColor } from "../data/hydrologyOverlay";
import {hydrologyCaveat,hydrologyDateLabel,hydrologyMetricUnit,hydrologyReason,causalTiming} from "../data/hydrology";
import type {HydrologyData,HydrologyMetricId} from "../data/hydrology";
import "./Hydrology.css";
export function HydrologyLegend({data,metric,day,onInspect,side,appearance,onAppearanceChange,open,onOpenChange,appearanceScope}:{
 data:HydrologyData;metric:HydrologyMetricId;day:string;onInspect:(id:string)=>void;side?:string;
 appearanceScope?:AppearanceLink;appearance:HydrologyAppearance;onAppearanceChange:(value:HydrologyAppearance)=>void;open?:boolean;onOpenChange?:(value:boolean)=>void;
}){
 const index=data.dates.indexOf(day),definition=data.metrics.find(m=>m.id===metric)!;
 const buttonLabel=side?`${side} map color options`:"Color options";
 const options={river:{name:"MarineCast rivers",colors:data.rivers.map(r=>hydrologyRiverColor(r.id))},...palettes};
 return <LegendDropdown className="hydrology-legend" label={side?`${side} river legend`:"River legend"}
  buttonLabel={buttonLabel} popupLabel={side?`${side} map color options`:"Map color options"} heading="River appearance"
  title="Open river colors and Advanced settings" open={open} onOpenChange={onOpenChange}
  info={<LegendInfo label="Legend information"><p>Colors identify rivers and match the history lines. Bubbles mark locations; size does not encode the measurement.</p><p>Hollow bubble: unavailable or not collected on the selected provider date. A supported zero remains a filled bubble.</p><p>{hydrologyCaveat}</p><p>{data.rivers.reduce((n,r)=>n+r.mouths.length,0)} retained reference points represent {data.rivers.length} rivers, indexed without snapping. Skagit’s two bubbles link to the same upstream gauge; they do not split or double its flow.</p>
  <p>Colors identify rivers. Hollow bubbles have no supported value on the selected day. Bubble size does not encode flow. Native provider dates do not represent common UTC averaging intervals.</p><p>Multiple mouths share one river series. Use Inspect in the appearance popup to open a river's gauge details.</p></LegendInfo>}
  preview={<><span className="hydrology-legend-heading"><strong>{side?`${side} · `:""}River gauges</strong><small>{definition.name} · {hydrologyMetricUnit(definition)}</small></span>
   <span className="hydrology-river-key">{data.rivers.map(r=>{const v=r.series[metric].values[index];return <span key={r.id}><i className={v==null?"is-missing":""} style={{color:hydrologyRiverColor(r.id,appearance),background:v==null?"transparent":hydrologyRiverColor(r.id,appearance)}}/><span>{r.name}<small>{v==null?"Unavailable":v.toLocaleString(undefined,{maximumSignificantDigits:4})}</small></span></span>;})}</span>
   <span className="hydrology-legend-foot">{data.stationTemperature?"Orange = independent temperature station · ":""}Hollow = unavailable · color = river · Edit colors ›</span></>}>
  <AppearanceScope scope={appearanceScope} side={side}/>
  <PalettePicker options={options} value={appearance.palette} onChange={id=>onAppearanceChange({...appearance,palette:id,colors:hydrologyPaletteColors(data,id)})}/>
  <p className="legend-scale-note">River colors apply to the bubbles, legend and history lines.</p>
  <details className="legend-advanced"><summary>Advanced</summary>
   <div className="hydrology-custom-colors">{data.rivers.map(r=><div key={r.id}>
    <label>{r.name}<input type="color" aria-label={`${r.name} river color`} value={hydrologyRiverColor(r.id,appearance)} onChange={e=>onAppearanceChange({...appearance,palette:"custom",colors:{...appearance.colors,[r.id]:e.target.value}})}/></label>
    <button type="button" aria-label={`Inspect ${r.name} river`} onClick={()=>onInspect(r.id)}>Inspect</button>
   </div>)}</div>
   <label className="hydrology-appearance-control">Bubble opacity <output>{Math.round(appearance.opacity*100)}%</output><input type="range" aria-label="Bubble opacity" min={.15} max={1} step={.01} value={appearance.opacity} onChange={e=>onAppearanceChange({...appearance,opacity:Number(e.target.value)})}/></label>
   <label className="hydrology-appearance-control">Bubble size <output>{appearance.radius} px</output><input type="range" aria-label="Bubble size" min={5} max={14} step={1} value={appearance.radius} onChange={e=>onAppearanceChange({...appearance,radius:Number(e.target.value)})}/></label>
   <button type="button" className="button" onClick={()=>onAppearanceChange(defaultHydrologyAppearance)}>Restore defaults</button>
  </details>
 </LegendDropdown>;
}

export function HydrologyOverview({data,metric,day,onInspect}:{data:HydrologyData;metric:HydrologyMetricId;day:string;onInspect:(id:string)=>void}){
 const index=data.dates.indexOf(day),definition=data.metrics.find(m=>m.id===metric)!;
 const available=data.rivers.filter(r=>r.series[metric].values[index]!=null);
 return <section className="hydrology-overview" aria-label="Hydrology gauge overview">
 {data.causalUnavailable&&<p role="alert" className="insights-note">{data.causalUnavailable}</p>}
 {definition.causal&&<p className="insights-note">As-of provider date: {data.causal?.asOfDates[index]}. {causalTiming}</p>}
 <InsightMetrics items={[{label:"Gauges",value:data.rivers.length},{label:"Available",value:available.length},{label:"Unavailable",value:data.rivers.length-available.length}]}/>
 <RankedBars title="River gauges" caption={`${hydrologyDateLabel(day)} · select a river for history`} unit={hydrologyMetricUnit(definition)} rows={available.map(r=>({key:r.id,label:r.name,value:r.series[metric].values[index]!,color:"#287f9d",onSelect:()=>onInspect(r.id)}))}/>
 {data.rivers.filter(r=>r.series[metric].values[index]==null).map(r=><button className="insight-unavailable-row" key={r.id} onClick={()=>onInspect(r.id)}><strong>{r.name}</strong><span>{hydrologyReason(r.series[metric].reasons[index],r.series[metric].statuses[index])}</span></button>)}
 <p className="insights-note">Upstream gauges, not river-mouth measurements. No spatial averaging or summation.</p></section>;

}
