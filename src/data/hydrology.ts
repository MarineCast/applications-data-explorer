import {decodeStationTemperature} from "./stationTemperature";
import type {StationTemperature} from "./stationTemperature";
import {cellToLatLng,getResolution,isValidCell,latLngToCell} from "h3-js";
import type {Asset,SeascapeCatalog,SeascapeFeature,SeascapeLayer} from "./seascape";
export const hydrologyMetricIds=["discharge_mean","discharge_mean_7d","discharge_mean_30d","discharge_change_7d","low_flow_duration","high_flow_duration","days_since_flow_pulse","temperature_mean","temperature_max","temperature_7dadm"] as const;
export const causalMetricUnits={causal_discharge_seasonal_mean:"m3/s",causal_discharge_seasonal_p90:"m3/s",causal_discharge_seasonal_anomaly:"m3/s",causal_discharge_seasonal_percentile:"percent",causal_discharge_pulse:"1",causal_days_since_discharge_pulse:"day",causal_reference_samples:"day",causal_reference_years:"year"} as const;
export type CausalMetricId=keyof typeof causalMetricUnits;
export const causalMetricIds=Object.keys(causalMetricUnits) as CausalMetricId[];
export type HydrologyMetricId=typeof hydrologyMetricIds[number]|CausalMetricId;
export interface CausalDefinition {method:"causal-seasonal-lag1-v1"; identity:string; lag_days:1; window_days:number; min_samples:number; min_years:number; history_years:number; model_eligible:false; event_date_causal:true; operational_availability:string; temporal_support:string; leap_day:string; units:Record<CausalMetricId,string>;}
export interface HydrologyCausal {definition:CausalDefinition;sha256:string;asOfDates:readonly string[];sourceConditionsSha256:Record<string,string>;dayDefinitions:Record<string,string[]>;}
export const causalTiming="Output date t uses discharge through provider date t−1. Event-date causality only; historical operational availability is unknown. Research only; model-ineligible. No interpolation or zero filling.";
export interface HydrologyMetric {id:HydrologyMetricId;name:string;family:string;unit:string;definition:string;range:[number,number];available:number;causal?:boolean;plot?:"line"|"step";}
export interface HydrologyMouth {mouth_id:string;latitude:number;longitude:number;source:string;cell:string;inStudyGrid:boolean;geometry_role:string;accuracy:string;}
export interface HydrologySeries {values:readonly(number|null)[];statuses:readonly string[];reasons:readonly(string|null)[];contributorSeries:readonly(string|null)[];dayDefinition?:readonly(string|null)[];flags?:readonly(string|null)[];retrievedAt?:readonly(string|null)[];sourceRelease?:readonly(string|null)[];coverage?:readonly(number|null)[];}
export interface LowFlowDefinition {method:"historical-p10-linear-interior-v1";quantile:.1;threshold_m3_s:number|null;reference_start:string;reference_end:string;observed_days:number;interpolated_days:number;unfilled_days:number;retrospective:true;model_eligible:false;qualification:string;identity:string;}
export interface FlowPulseDefinition extends Omit<LowFlowDefinition,"method"|"quantile"> {method:"historical-p90-linear-interior-v1";quantile:.9;}
export interface HighFlowDefinition extends Omit<LowFlowDefinition,"method"|"quantile"> {method:"historical-p90-high-duration-linear-interior-v1";quantile:.9;}
export interface HydrologyRiver {id:string;name:string;stationId:string;stationName:string;provider:string;gaugeCoordinates:[number,number];gaugeRationale:string;mouths:readonly HydrologyMouth[];mouthStatus:string;representation:string;manifestSha256:string;metadataSha256:string;availability:string;temperatureMissingness:string;thresholds:{high_flow_threshold_m3_s?:number|null;low_flow_threshold_m3_s:number|null;pulse_threshold_m3_s:number|null;qualification:string};highFlowDefinition?:HighFlowDefinition;lowFlowDefinition?:LowFlowDefinition;flowPulseDefinition?:FlowPulseDefinition;sourceOutcomes:Record<string,string>;series:Record<HydrologyMetricId,HydrologySeries>;}
export interface HydrologyCatalog {version:1;status:"qualified_local_product";snapshot:string;rows:number;data:Asset;source:{catalogSha256:string;studySha256:string;registrySha256:string;productIdentity:string;temporalBasis:"provider_daily";sourcePath:string;};}
export interface HydrologyData {stationTemperature?:StationTemperature;stationTemperatureUnavailable?:string;causal?:HydrologyCausal;causalUnavailable?:string;catalog:HydrologyCatalog;dates:readonly string[];grid:readonly string[];rivers:readonly HydrologyRiver[];metrics:readonly HydrologyMetric[];}
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
 if(!Array.isArray(payload.metrics)||!payload.metrics.length||payload.metrics.some(m=>!object(m)||![...hydrologyMetricIds,...causalMetricIds].includes(m.id as HydrologyMetricId)||!string(m.name)||!string(m.unit)||!string(m.family)||!string(m.definition)||!Number.isSafeInteger(m.available)||(m.available as number)<(m.causal===true?0:1)||!Array.isArray(m.range)||m.range.length!==2||m.range.some(v=>typeof v!=="number"||!Number.isFinite(v))||m.range[0]>m.range[1]))return fail("available metric contract");
 if(new Set(payload.metrics.map(m=>(m as HydrologyMetric).id)).size!==payload.metrics.length)return fail("duplicate metric");
 const causal=payload.causal;
 const causalMetrics=payload.metrics.filter(m=>causalMetricIds.includes((m as HydrologyMetric).id as CausalMetricId)) as HydrologyMetric[];
 if(causal){
  if(!object(causal)||!sha(causal.sha256)||!object(causal.definition)||!object(causal.sourceConditionsSha256)||!object(causal.dayDefinitions)||!Array.isArray(causal.asOfDates)||causal.asOfDates.length!==dates.length||causal.asOfDates.some((d,i)=>!realDate(d)||Date.parse(dates[i])-Date.parse(d)!==86400000))return fail("causal dates/binding");
  const d=causal.definition;
  if(d.method!=="causal-seasonal-lag1-v1"||!sha(d.identity)||d.lag_days!==1||d.model_eligible!==false||d.event_date_causal!==true||!string(d.operational_availability)||!d.operational_availability.startsWith("unknown")||!string(d.temporal_support)||!string(d.leap_day)||!["window_days","min_samples","min_years","history_years"].every(k=>Number.isSafeInteger(d[k])&&(d[k] as number)>=0)||!object(d.units)||causalMetricIds.some(id=>(d.units as Record<string,unknown>)[id]!==causalMetricUnits[id]))return fail("causal method qualification");
  if(causalMetrics.length!==8||causalMetrics.some(m=>m.causal!==true||m.unit!==causalMetricUnits[m.id as CausalMetricId]||!["line","step"].includes(m.plot??"")))return fail("causal metric contract");
 }else if(causalMetrics.length)return fail("causal metrics without companion");
 if(payload.causalUnavailable!=null&&!string(payload.causalUnavailable))return fail("causal availability message");
 if(!Array.isArray(payload.rivers)||!payload.rivers.length)return fail("river roster");
 const rivers=payload.rivers.map(raw=>{
  if(!object(raw)||!["id","name","stationId","stationName","provider","gaugeRationale","mouthStatus","representation","availability","temperatureMissingness"].every(k=>string(raw[k]))||!sha(raw.manifestSha256)||!sha(raw.metadataSha256)||!object(raw.series)||!object(raw.thresholds)||!object(raw.sourceOutcomes))return fail("river identity");
  for(const [key,method,quantile,thresholdKey,label] of [["highFlowDefinition","historical-p90-high-duration-linear-interior-v1",.9,"high_flow_threshold_m3_s","high-flow"],["lowFlowDefinition","historical-p10-linear-interior-v1",.1,"low_flow_threshold_m3_s","low-flow"],["flowPulseDefinition","historical-p90-linear-interior-v1",.9,"pulse_threshold_m3_s","flow-pulse"]] as const){const d=raw[key];if(d!==undefined&&(!object(d)||d.method!==method||d.quantile!==quantile||!sha(d.identity)||d.retrospective!==true||d.model_eligible!==false||d.reference_start!==dates[0]||d.reference_end!==dates.at(-1)||!string(d.qualification)||(d.threshold_m3_s!==null&&(typeof d.threshold_m3_s!=="number"||!Number.isFinite(d.threshold_m3_s)))||d.threshold_m3_s!==raw.thresholds[thresholdKey]||["observed_days","interpolated_days","unfilled_days"].some(k=>!Number.isSafeInteger(d[k])||(d[k] as number)<0)||(d.observed_days as number)+(d.interpolated_days as number)+(d.unfilled_days as number)!==dates.length))return fail(`relative ${label} definition`);}

  if(!Array.isArray(raw.gaugeCoordinates)||raw.gaugeCoordinates.length!==2||raw.gaugeCoordinates.some(v=>typeof v!=="number"||!Number.isFinite(v)))return fail("gauge coordinates");
  if(!Array.isArray(raw.mouths)||!raw.mouths.length||raw.mouths.some(m=>!object(m)||!["mouth_id","source","geometry_role","accuracy"].every(k=>string(m[k])&&Boolean(m[k]))||typeof m.latitude!=="number"||typeof m.longitude!=="number"||!Number.isFinite(m.latitude)||!Number.isFinite(m.longitude)||Math.abs(m.latitude)>90||Math.abs(m.longitude)>180||m.cell!==latLngToCell(m.latitude,m.longitude,6)||m.inStudyGrid!==support.has(m.cell as string)))return fail("exact unsnapped mouth reference");
  if(new Set(raw.mouths.map(m=>(m as HydrologyMouth).mouth_id)).size!==raw.mouths.length)return fail("duplicate mouth identity");
  const series={} as Record<HydrologyMetricId,HydrologySeries>;
  for(const metric of [...hydrologyMetricIds,...(causal?causalMetricIds:[])]){
   const packed=raw.series[metric];if(!object(packed))return fail("missing metric calendar");
   const columns=Object.fromEntries(Object.entries(packed).map(([key,value])=>[key,unpack(value,dates.length)]));
   if(!columns.values||!columns.statuses||!columns.reasons||!columns.contributorSeries||columns.values.some(v=>v!==null&&(typeof v!=="number"||!Number.isFinite(v)))||columns.statuses.some(v=>!string(v))||["reasons","contributorSeries","flags","retrievedAt","sourceRelease","dayDefinition"].some(k=>columns[k]?.some(v=>v!==null&&!string(v)))||columns.coverage?.some(v=>v!==null&&(typeof v!=="number"||!Number.isFinite(v)||v<0||v>1)))return fail("metric values/status/provenance");
   if(columns.values.some((v,i)=>v!==null&&columns.statuses[i]!=="valid"))return fail("non-null unsupported value");
   if(causalMetricIds.includes(metric as CausalMetricId)){
    if(columns.values.some((v,i)=>v===null?columns.statuses[i]!=="unavailable"||!string(columns.reasons[i]):columns.reasons[i]!==null))return fail("causal support status");
    if(columns.values.some(v=>typeof v==="number"&&((metric==="causal_discharge_pulse"&&v!==0&&v!==1)||(metric==="causal_discharge_seasonal_percentile"&&(v<0||v>100))||(["causal_days_since_discharge_pulse","causal_reference_samples","causal_reference_years"].includes(metric)&&(!Number.isSafeInteger(v)||v<0)))))return fail("causal flag/count range");
   }
   series[metric]=columns as unknown as HydrologySeries;
  }
  return {...raw,series} as unknown as HydrologyRiver;
 });
 if(new Set(rivers.map(r=>r.id)).size!==rivers.length)return fail("duplicate river");
 if(rivers.some(r=>!r.highFlowDefinition))return fail("missing relative high-flow definition");
 for(const key of ["lowFlowDefinition","flowPulseDefinition","highFlowDefinition"] as const)if(rivers.some(r=>r[key])&&rivers.some(r=>!r[key]))return fail("mixed relative flow methods");
 if(causal){
  const evidence=causal as unknown as HydrologyCausal;
  if(Object.keys(evidence.sourceConditionsSha256).length!==rivers.length||rivers.some(r=>!sha(evidence.sourceConditionsSha256[r.id])||!Array.isArray(evidence.dayDefinitions[r.id])||evidence.dayDefinitions[r.id].some(v=>!string(v))))return fail("causal source roster");
  for(const metric of causalMetrics)if(rivers.reduce((n,r)=>n+r.series[metric.id].values.filter(v=>v!==null).length,0)!==metric.available)return fail("causal available count");
 }
 return {stationTemperature:decodeStationTemperature(payload.stationTemperature),stationTemperatureUnavailable:typeof payload.stationTemperatureUnavailable==="string"?payload.stationTemperatureUnavailable:undefined,catalog,dates,grid,rivers,metrics:payload.metrics as HydrologyMetric[],causal:causal?causal as unknown as HydrologyCausal:undefined,causalUnavailable:payload.causalUnavailable as string|undefined};
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
export const hydrologyUnit=(unit:string)=>unit==="m3/s"?"m³/s":unit==="degC"?"°C":unit==="day"?"days":unit==="year"?"years":unit==="percent"?"%":unit==="1"?"0/1":unit;
export const hydrologyMetricUnit=(metric:HydrologyMetric)=>metric.id==="causal_reference_samples"?"samples (provider days)":hydrologyUnit(metric.unit);
export function hydrologyReason(reason:string|null|undefined,status?:string){
 const causalReasons:Record<string,string>={insufficient_reference_support:"Warmup / insufficient seasonal reference",as_of_discharge_unavailable:"As-of discharge unavailable",previous_day_unavailable:"Previous-day discharge unavailable; crossing unknown",pulse_history_unknown:"Pulse history unknown; no witnessed crossing since reset"};
 if(reason&&causalReasons[reason])return causalReasons[reason];
 return reason==="not_requested"?"Not collected / no qualified source in this product":reason==="interpolated_flow_input"?"Estimated from linearly interpolated flow":reason==="streak_includes_interpolated_flow"?"Streak includes interpolated flow":reason==="pulse_history_includes_interpolated_flow"?"Pulse history includes interpolated flow":reason?.replaceAll("_"," ")??(status==="valid"?"Available":"Unavailable");}
export function withHydrology(catalog:SeascapeCatalog,data:HydrologyData):SeascapeCatalog{
 const features:SeascapeFeature[]=data.metrics.map(m=>({id:`HYDROLOGY__${m.id}`,column:m.id,dataset:"hydrology",resolution:6,family:m.family,name:m.name,unit:hydrologyMetricUnit(m),range:m.range,available:m.available,rows:data.rivers.length,kind:"numeric",role:"upstream_gauge_proxy_at_mouth_reference",qualifiers:[],sourceRelease:data.catalog.source.productIdentity,sourcePath:m.causal?"Hydrology/causal.parquet":"Hydrology/*/conditions.parquet + features.parquet",sourceSha256:m.causal?data.causal!.sha256:data.catalog.source.catalogSha256,definition:m.definition+(m.causal?" "+causalTiming:""),modelingEligibility:m.causal?"research_only; model_eligible=false; historical operational availability unknown":"Research gauge proxy; mouth allocation and ecological thresholds unvalidated",arrowType:"double"}));
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
export function hydrologyChartPath(values:readonly(number|null)[],width=242,height=110,range?:readonly[number,number],baseline=132,step=false){
 const available=values.filter((v):v is number=>v!==null);if(!available.length)return "";const [min,max]=range??[Math.min(...available),Math.max(...available)];
 return values.map((v,i)=>v===null?"":`${i>0&&values[i-1]!==null?(step?"H":"L"):"M"}${(48+i/Math.max(1,values.length-1)*width).toFixed(2)}${i>0&&values[i-1]!==null&&step?"V":","}${(baseline-(max===min?.5:(v-min)/(max-min))*height).toFixed(2)}`).join(" ");
}
