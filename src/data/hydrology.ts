import {cellToLatLng,getResolution,isValidCell,latLngToCell} from "h3-js";
import type {Asset,SeascapeCatalog,SeascapeFeature,SeascapeLayer} from "./seascape";
export const hydrologyMetricIds=["discharge_mean","discharge_mean_7d","discharge_mean_30d","discharge_change_7d","low_flow_duration","high_flow_duration","days_since_flow_pulse","temperature_mean","temperature_max","temperature_7dadm"] as const;
export type HydrologyMetricId=typeof hydrologyMetricIds[number];
export interface HydrologyMetric {id:HydrologyMetricId;name:string;family:string;unit:string;definition:string;range:[number,number];available:number;}
export interface HydrologyMouth {mouth_id:string;latitude:number;longitude:number;source:string;cell:string;inStudyGrid:boolean;geometry_role:string;accuracy:string;}
export interface HydrologySeries {values:readonly(number|null)[];statuses:readonly string[];reasons:readonly(string|null)[];contributorSeries:readonly(string|null)[];dayDefinition?:readonly(string|null)[];flags?:readonly(string|null)[];retrievedAt?:readonly(string|null)[];sourceRelease?:readonly(string|null)[];coverage?:readonly(number|null)[];}
export interface LowFlowDefinition {method:"historical-p10-linear-interior-v1";quantile:.1;threshold_m3_s:number|null;reference_start:string;reference_end:string;observed_days:number;interpolated_days:number;unfilled_days:number;retrospective:true;model_eligible:false;qualification:string;identity:string;}
export interface FlowPulseDefinition extends Omit<LowFlowDefinition,"method"|"quantile"> {method:"historical-p90-linear-interior-v1";quantile:.9;}
export interface HighFlowDefinition extends Omit<LowFlowDefinition,"method"|"quantile"> {method:"historical-p90-high-duration-linear-interior-v1";quantile:.9;}
export interface HydrologyRiver {id:string;name:string;stationId:string;stationName:string;provider:string;gaugeCoordinates:[number,number];gaugeRationale:string;mouths:readonly HydrologyMouth[];mouthStatus:string;representation:string;manifestSha256:string;metadataSha256:string;availability:string;temperatureMissingness:string;thresholds:{high_flow_threshold_m3_s?:number|null;low_flow_threshold_m3_s:number|null;pulse_threshold_m3_s:number|null;qualification:string};highFlowDefinition?:HighFlowDefinition;lowFlowDefinition?:LowFlowDefinition;flowPulseDefinition?:FlowPulseDefinition;sourceOutcomes:Record<string,string>;series:Record<HydrologyMetricId,HydrologySeries>;}
export interface HydrologyCatalog {version:1;status:"qualified_local_product";snapshot:string;rows:number;data:Asset;source:{catalogSha256:string;studySha256:string;registrySha256:string;productIdentity:string;temporalBasis:"provider_daily";sourcePath:string;};}
export interface HydrologyData {catalog:HydrologyCatalog;dates:readonly string[];grid:readonly string[];rivers:readonly HydrologyRiver[];metrics:readonly HydrologyMetric[];}
export const hydrologyCaveat="Upstream gauge measurements associated with each river. Bubbles mark approximate mouth references, not measurements at the mouth or a spatial influence surface. Distributary allocation is unknown.";
export const hydrologyBackground="#cbd4d6",hydrologyMissing="#b86c61",hydrologyShared="#626b8b";
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const string=(v:unknown):v is string=>typeof v==="string";
const sha=(v:unknown):v is string=>string(v)&&/^[a-f0-9]{64}$/.test(v);
const fail=(why:string):never=>{throw new Error(`Invalid Hydrology cache: ${why}.`);};
function unpack(raw:unknown,length:number):unknown[]{
 if(Array.isArray(raw)&&raw.length===length)return raw;
 if(object(raw)&&Array.isArray(raw.dictionary)&&Array.isArray(raw.indices)&&raw.indices.length===length){const dictionary=raw.dictionary;return raw.indices.map(i=>Number.isInteger(i)&&i>=0&&i<dictionary.length?dictionary[i]:fail("dictionary index"));}
 return fail("calendar column length");
}
const realDate=(v:unknown):v is string=>string(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function decodeHydrology(payload:unknown,catalog:HydrologyCatalog):HydrologyData{
 if(catalog.version!==1||catalog.status!=="qualified_local_product"||!sha(catalog.snapshot)||!sha(catalog.source?.catalogSha256)||catalog.source.temporalBasis!=="provider_daily")return fail("source contract");
 if(!object(payload)||payload.kind!=="hydrology-mouths"||payload.version!==1||payload.snapshot!==catalog.snapshot||!Array.isArray(payload.dates)||!payload.dates.length||!payload.dates.every(realDate))return fail("dated payload");
 const dates=payload.dates as string[];
 if(dates.some((d,i)=>i>0&&Date.parse(d)-Date.parse(dates[i-1])!==86400000))return fail("daily calendar gap/duplicate");
 if(!Array.isArray(payload.grid)||payload.grid.some(c=>!string(c)||!isValidCell(c)||getResolution(c)!==6)||new Set(payload.grid).size!==payload.grid.length)return fail("study R6 registry");
 const grid=payload.grid as string[],support=new Set(grid);
 if(!Array.isArray(payload.metrics)||!payload.metrics.length||payload.metrics.some(m=>!object(m)||!hydrologyMetricIds.includes(m.id as HydrologyMetricId)||!string(m.name)||!string(m.unit)||!string(m.family)||!string(m.definition)||!Number.isSafeInteger(m.available)||(m.available as number)<1||!Array.isArray(m.range)||m.range.length!==2||m.range.some(v=>typeof v!=="number"||!Number.isFinite(v))||m.range[0]>m.range[1]))return fail("available metric contract");
 if(new Set(payload.metrics.map(m=>(m as HydrologyMetric).id)).size!==payload.metrics.length)return fail("duplicate metric");
 if(!Array.isArray(payload.rivers)||!payload.rivers.length)return fail("river roster");
 const rivers=payload.rivers.map(raw=>{
  if(!object(raw)||!["id","name","stationId","stationName","provider","gaugeRationale","mouthStatus","representation","availability","temperatureMissingness"].every(k=>string(raw[k]))||!sha(raw.manifestSha256)||!sha(raw.metadataSha256)||!object(raw.series)||!object(raw.thresholds)||!object(raw.sourceOutcomes))return fail("river identity");
  for(const [key,method,quantile,thresholdKey,label] of [["highFlowDefinition","historical-p90-high-duration-linear-interior-v1",.9,"high_flow_threshold_m3_s","high-flow"],["lowFlowDefinition","historical-p10-linear-interior-v1",.1,"low_flow_threshold_m3_s","low-flow"],["flowPulseDefinition","historical-p90-linear-interior-v1",.9,"pulse_threshold_m3_s","flow-pulse"]] as const){const d=raw[key];if(d!==undefined&&(!object(d)||d.method!==method||d.quantile!==quantile||!sha(d.identity)||d.retrospective!==true||d.model_eligible!==false||d.reference_start!==dates[0]||d.reference_end!==dates.at(-1)||!string(d.qualification)||(d.threshold_m3_s!==null&&(typeof d.threshold_m3_s!=="number"||!Number.isFinite(d.threshold_m3_s)))||d.threshold_m3_s!==raw.thresholds[thresholdKey]||["observed_days","interpolated_days","unfilled_days"].some(k=>!Number.isSafeInteger(d[k])||(d[k] as number)<0)||(d.observed_days as number)+(d.interpolated_days as number)+(d.unfilled_days as number)!==dates.length))return fail(`relative ${label} definition`);}

  if(!Array.isArray(raw.gaugeCoordinates)||raw.gaugeCoordinates.length!==2||raw.gaugeCoordinates.some(v=>typeof v!=="number"||!Number.isFinite(v)))return fail("gauge coordinates");
  if(!Array.isArray(raw.mouths)||!raw.mouths.length||raw.mouths.some(m=>!object(m)||!["mouth_id","source","geometry_role","accuracy"].every(k=>string(m[k])&&Boolean(m[k]))||typeof m.latitude!=="number"||typeof m.longitude!=="number"||!Number.isFinite(m.latitude)||!Number.isFinite(m.longitude)||Math.abs(m.latitude)>90||Math.abs(m.longitude)>180||m.cell!==latLngToCell(m.latitude,m.longitude,6)||m.inStudyGrid!==support.has(m.cell as string)))return fail("exact unsnapped mouth reference");
  if(new Set(raw.mouths.map(m=>(m as HydrologyMouth).mouth_id)).size!==raw.mouths.length)return fail("duplicate mouth identity");
  const series={} as Record<HydrologyMetricId,HydrologySeries>;
  for(const metric of hydrologyMetricIds){
   const packed=raw.series[metric];if(!object(packed))return fail("missing metric calendar");
   const columns=Object.fromEntries(Object.entries(packed).map(([key,value])=>[key,unpack(value,dates.length)]));
   if(!columns.values||!columns.statuses||!columns.reasons||!columns.contributorSeries||columns.values.some(v=>v!==null&&(typeof v!=="number"||!Number.isFinite(v)))||columns.statuses.some(v=>!string(v))||["reasons","contributorSeries","flags","retrievedAt","sourceRelease","dayDefinition"].some(k=>columns[k]?.some(v=>v!==null&&!string(v)))||columns.coverage?.some(v=>v!==null&&(typeof v!=="number"||!Number.isFinite(v)||v<0||v>1)))return fail("metric values/status/provenance");
   if(columns.values.some((v,i)=>v!==null&&columns.statuses[i]!=="valid"))return fail("non-null unsupported value");
   series[metric]=columns as unknown as HydrologySeries;
  }
  return {...raw,series} as unknown as HydrologyRiver;
 });
 if(new Set(rivers.map(r=>r.id)).size!==rivers.length)return fail("duplicate river");
 if(rivers.some(r=>!r.highFlowDefinition))return fail("missing relative high-flow definition");
 for(const key of ["lowFlowDefinition","flowPulseDefinition","highFlowDefinition"] as const)if(rivers.some(r=>r[key])&&rivers.some(r=>!r[key]))return fail("mixed relative flow methods");
 return {catalog,dates,grid,rivers,metrics:payload.metrics as HydrologyMetric[]};
}
export async function loadHydrologyData():Promise<HydrologyData|undefined>{
 const response=await fetch("/local-data/hydrology/catalog.json",{cache:"no-store"});
  if (response.status >= 500) { const detail = await response.json() as {error?: string}; throw new Error(detail.error || "Current Hydrology files could not be read."); }if(!response.ok||!response.headers.get("content-type")?.includes("json"))return undefined;
 const catalog=await response.json() as HydrologyCatalog;
 if(!sha(catalog.snapshot)||catalog.data?.url!==`/local-data/hydrology/${catalog.snapshot}.json`||!sha(catalog.data.sha256))return fail("asset binding");
 const asset=await fetch(catalog.data.url);if(!asset.ok)return fail("asset unavailable");const bytes=await asset.arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");if(hash!==catalog.data.sha256)return fail("asset checksum");
 return decodeHydrology(JSON.parse(new TextDecoder().decode(bytes)),catalog);
}
export function hydrologyRiversAtCell(data:HydrologyData,cell?:string){return cell?data.rivers.filter(r=>r.mouths.some(m=>m.cell===cell)):[];}
export const hydrologyDateLabel=(day:string)=>new Intl.DateTimeFormat("en",{timeZone:"UTC",year:"numeric",month:"short",day:"numeric"}).format(new Date(day+"T00:00:00Z"));
export const hydrologyUnit=(unit:string)=>unit==="m3/s"?"m³/s":unit==="degC"?"°C":unit==="day"?"days":unit;
export function hydrologyReason(reason:string|null|undefined,status?:string){return reason==="not_requested"?"Not collected / no qualified source in this product":reason==="interpolated_flow_input"?"Estimated from linearly interpolated flow":reason==="streak_includes_interpolated_flow"?"Streak includes interpolated flow":reason==="pulse_history_includes_interpolated_flow"?"Pulse history includes interpolated flow":reason?.replaceAll("_"," ")??(status==="valid"?"Available":"Unavailable");}
export function withHydrology(catalog:SeascapeCatalog,data:HydrologyData):SeascapeCatalog{
 const features:SeascapeFeature[]=data.metrics.map(m=>({id:`HYDROLOGY__${m.id}`,column:m.id,dataset:"hydrology",resolution:6,family:m.family,name:m.name,unit:hydrologyUnit(m.unit),range:m.range,available:m.available,rows:data.rivers.length,kind:"numeric",role:"upstream_gauge_proxy_at_mouth_reference",qualifiers:[],sourceRelease:data.catalog.source.productIdentity,sourcePath:"Hydrology/*/conditions.parquet + features.parquet",sourceSha256:data.catalog.source.catalogSha256,definition:m.definition,modelingEligibility:"Research gauge proxy; mouth allocation and ecological thresholds unvalidated",arrowType:"double"}));
 return {...catalog,hydrology:data,datasets:{...catalog.datasets,hydrology:{name:"Hydrology",release:"Native daily river gauges",status:"qualified per-river products",manifestSha256:data.catalog.source.catalogSha256,limitations:hydrologyCaveat}},features:[...catalog.features,...features]};
}
export function hydrologyLayer(catalog:SeascapeCatalog,field:SeascapeFeature,day:string):SeascapeLayer{
 const data=catalog.hydrology!,metric=field.column as HydrologyMetricId,index=data.dates.indexOf(day);if(index<0)throw new Error("Hydrology date outside retained calendar.");
 const ids=[...new Set([...data.grid,...data.rivers.flatMap(r=>r.mouths.map(m=>m.cell))])];
 const cells=ids.map(id=>{const[lat,lon]=cellToLatLng(id);return{id,lat,lon,boundary:[],zone:"north" as const};});
 const values=new Map<string,number|null>(),appearance=new Map<string,{color?:string;opacity:number;kind:string}>(),support:string[]=[],status:string[]=[],reason:string[]=[];
 for(const cell of ids){const rivers=hydrologyRiversAtCell(data,cell);const value=rivers.length===1?rivers[0].series[metric].values[index]:null;values.set(cell,value);
  const kind=rivers.length>1?"multiple rivers":rivers.length?value===null?"missing river-day":"upstream gauge proxy":"not evaluated";support.push(kind);status.push(rivers.length===1?rivers[0].series[metric].statuses[index]:kind);reason.push(rivers.length===1?hydrologyReason(rivers[0].series[metric].reasons[index],status.at(-1)):kind);
  appearance.set(cell,{kind,opacity:rivers.length?1:.22,color:!rivers.length?hydrologyBackground:rivers.length>1?hydrologyShared:value===null?hydrologyMissing:undefined});
 }
 return {id:field.id,name:field.name,unit:field.unit,resolution:6,range:field.range,cells,values,rawValues:values,missingColor:hydrologyMissing,cellAppearance:appearance,index:new Map(ids.map((id,i)=>[id,i])),field,catalog,qualifiers:{"Map support":support,"Source status":status,"Source reason":reason},sourceLabel:hydrologyCaveat,slice:{axis:"Native provider date",value:day,label:hydrologyDateLabel(day)}};
}
/** Paths explicitly restart after every missing day; no interpolation or gap bridge. */
export function hydrologyChartPath(values:readonly(number|null)[],width=242,height=110,range?:readonly[number,number],baseline=132){
 const available=values.filter((v):v is number=>v!==null);if(!available.length)return "";const [min,max]=range??[Math.min(...available),Math.max(...available)];
 return values.map((v,i)=>v===null?"":`${i>0&&values[i-1]!==null?"L":"M"}${(48+i/Math.max(1,values.length-1)*width).toFixed(2)},${(baseline-(max===min?.5:(v-min)/(max-min))*height).toFixed(2)}`).join(" ");
}
