import {InsightMetrics,RankedBars} from "./InsightCharts";
import CategoryLegendItems from "./CategoryLegendItems";
import AppearanceScope from "./AppearanceScope";
import type { AppearanceLink } from "./AppearanceScope";
import { humanCategoryLabel, humanGeometryNote, humanCategoryColor, humanRecordName, filteredHumanRecords } from "../data/humanGeometry";
import type { HumanFeature, HumanGeometryData, HumanGeometryFilter, HumanGeometryView } from "../data/humanGeometry";
import LegendDropdown from "./LegendDropdown";
import "./HumanGeometryControls.css";

export function HumanGeometryLegend({view,name,side,onOpacity,onFilterChange,open,onOpenChange,appearanceScope}:{onFilterChange:(filter:HumanGeometryFilter)=>void;appearanceScope?:AppearanceLink;open?:boolean;onOpenChange?:(open:boolean)=>void;view:HumanGeometryView;name:string;side?:string;onOpacity:(value:number)=>void}){
 return <LegendDropdown open={open} onOpenChange={onOpenChange} className="human-native-legend categorical-legend" label={`${side??""} Human location legend`} buttonLabel={`${side?side+" ":""}Location legend settings`} popupLabel={`${side??""} Human location display`} heading="Display" preview={<span className="colorbar-name">{side?side+" · ":""}{name}</span>}
 items={<CategoryLegendItems identity={view.data.group} items={view.data.categories.map(category=>({key:category,label:humanCategoryLabel(category),color:humanCategoryColor(category),selected:view.filter.categories===null||view.filter.categories.includes(category)}))} onSelectionChange={categories=>onFilterChange({...view.filter,categories:categories.length===view.data.categories.length?null:categories})}/>}>
 <AppearanceScope scope={appearanceScope} side={side}/>
 <button type="button" className="human-display-toggle" aria-pressed={view.filter.showRecords} onClick={()=>onFilterChange({...view.filter,showRecords:!view.filter.showRecords})}>Markers</button>
 {view.data.footprints.length>0&&<button type="button" className="human-display-toggle" aria-pressed={view.filter.showFootprints} onClick={()=>onFilterChange({...view.filter,showFootprints:!view.filter.showFootprints})}>Park areas</button>}
 <label className="field">Opacity<input aria-label={`${side??""} Human location opacity`} type="range" min=".1" max="1" step=".05" value={view.opacity} onChange={e=>onOpacity(Number(e.target.value))}/></label>
 </LegendDropdown>;
}
function attributeValue(value:unknown){
 if(value===null||value===undefined||typeof value==="string"&&!value.trim())return "Unknown / not supplied";
 if(typeof value==="object")return JSON.stringify(value);
 return String(value);
}
function Attribute({value,name}:{value:unknown;name?:string}){
 const raw=attributeValue(value);
 const epoch=name==="DATA_VINTAGE"&&/^\d{12,13}(?:\.0)?$/.test(raw)?Number(raw):NaN;
 const text=Number.isFinite(epoch)&&epoch>=0&&epoch<4102444800000?`${new Date(epoch).toISOString().slice(0,10)} (source epoch ms: ${raw})`:raw;
 return /^https?:\/\//i.test(text)?<a href={text} target="_blank" rel="noreferrer">{text}</a>:<>{text}</>;
}
export function HumanGeometryInspector({feature,footprints=[]}:{feature?:HumanFeature;footprints?:HumanFeature[]}){
 if(!feature)return <p className="insights-empty">Select a map marker or line to inspect its source record.</p>;
 const p=feature.properties;
 const areas=footprints.filter(f=>f.properties.record_id===p.record_id);
 return <div className="human-source-inspector"><h3>{humanRecordName(feature)}</h3><dl className="insights-cell-details"><div><dt>Category</dt><dd>{humanCategoryLabel(p.category)}</dd></div><div><dt>Location method</dt><dd>{humanGeometryNote(feature)}</dd></div><div><dt>Source location</dt><dd>{p.label_point[1].toFixed(6)}, {p.label_point[0].toFixed(6)}</dd></div><div><dt>Source record identity</dt><dd><code>{p.record_id}</code></dd></div></dl><p className="insights-note">Retained source attributes describe the source snapshot. Public evidence is not a guarantee of current access, an entrance, facility operation or use. Blank attributes remain unknown.</p><details className="insights-qualifiers"><summary>Facility, access and source attributes</summary><dl className="insights-cell-details">{Object.entries(p.attributes).map(([key,value])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd><Attribute name={key} value={value}/></dd></div>)}</dl></details>{areas.map(area=><details key={area.id} className="insights-qualifiers"><summary>Source park area · {area.geometry.type}</summary><p className="insights-note">{humanGeometryNote(area)}</p><dl className="insights-cell-details"><div><dt>Original source geometry valid</dt><dd>{String(area.properties.source_geometry_valid)}</dd></div><div><dt>Original geometry WKB SHA-256</dt><dd><code>{area.properties.source_geometry_wkb_sha256}</code></dd></div>{Object.entries(area.properties.attributes).map(([key,value])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd><Attribute name={key} value={value}/></dd></div>)}</dl></details>)}</div>;
}
export function HumanGeometryPopup({feature,onClose}:{feature:HumanFeature;onClose:()=>void}){
 return <><button aria-label="Close Human location popup" className="popup-close" onClick={onClose}>×</button><strong>{humanRecordName(feature)}</strong><p>{humanCategoryLabel(feature.properties.category)}</p><p>{humanGeometryNote(feature)}</p>{feature.properties.category === "port" && <details className="human-port-attributes"><summary>Original NGA attributes</summary><dl>{Object.entries(feature.properties.attributes).map(([key,value]) => <div key={key}><dt>{key}</dt><dd><Attribute name={key} value={value}/></dd></div>)}</dl></details>}<small>Full source attributes in Insights.</small></>;
}
export function HumanGeometryOverview({data,filter}:{data:HumanGeometryData;filter:HumanGeometryFilter}){
 const records=filteredHumanRecords(data,filter);
 const counts=new Map<string,number>();for(const record of records)counts.set(record.properties.category,(counts.get(record.properties.category)??0)+1);
 return <><InsightMetrics items={[{label:"Selected records",value:records.length},{label:"Categories",value:counts.size},{label:"All records",value:data.records.length}]}/>
 <RankedBars title="Records by category" caption="Current legend selection · source records" rows={[...counts].map(([category,value])=>({key:category,label:humanCategoryLabel(category),value,color:humanCategoryColor(category)}))}/>
 <p className="insights-note">Partial inventory. Records may refer to the same physical site.</p></>;

}
