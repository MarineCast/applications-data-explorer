import {cellToLatLng,getResolution,isValidCell} from "h3-js";
import type {Asset,SeascapeCatalog,SeascapeFeature,SeascapeLayer} from "./seascape";
export type InfluenceMetric="relative_flow"|"discharge";
export interface DistanceProfile {id:string;label:string;kind:"exponential"|"gaussian";scale_km:number;peak_km:number;cutoff_km:number;}
export interface LagProfile {id:string;label:string;weights:{days:number;weight:number}[];}
export interface InfluenceSettings {date:string;distance:string;lag:string;}
export interface InfluenceRiver {id:string;name:string;outlet_id:string;gain:number;binding:{modeled_outlet_point_wgs84:[number,number];binding_status:string;physical_delta_branches_qualified:boolean;};}
export interface InfluenceRecipe {version:1;method:string;model_eligible:false;retrospective:true;temporal_basis:"provider_daily";qualification:string;distance_support:string;hydrology_catalog_sha256:string;study_sha256:string;cells:string[];dates:string[];rivers:InfluenceRiver[];signals:Record<string,{name:string;unit:string}>;display_ranges:Record<string,Record<InfluenceMetric,[number,number]>>;definitions:Record<string,{interpolated_days:number;threshold_p90_m3_s:number|null;reference_start:string;reference_end:string}>;config:{distance_profiles:DistanceProfile[];lag_profiles:LagProfile[];defaults:{distance:string;lag:string};};}
export interface RiverInfluenceData {version:1;snapshot:string;recipe:InfluenceRecipe;weights:Record<string,Record<string,(number|null)[]>>;distances:Record<string,(number|null)[]>;daily:Record<string,Record<string,Record<string,(number|null)[]>>>;sourceSha256?:string;}
export interface InfluenceContribution {river:string;name:string;distanceM:number|null;weight:number|null;signal:number|null;value:number|null;share:number|null;interpolatedInputWeight:number|null;}
export interface InfluenceFrame {settings:InfluenceSettings;recipe:InfluenceRecipe;metric:InfluenceMetric;contributions:Map<string,InfluenceContribution[]>;}
interface InfluenceCatalog {version:1;snapshot:string;source_sha256:string;data:Asset;}
const hash=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const bad=():never=>{throw new Error("Invalid river influence product: identities, support or factor arrays.");};
const numeric=(a:unknown,n:number,nonnegative=false):a is (number|null)[]=>Array.isArray(a)&&a.length===n&&a.every(v=>v===null||typeof v==="number"&&Number.isFinite(v)&&(!nonnegative||v>=0));
export function decodeRiverInfluence(payload:unknown,snapshot:string):RiverInfluenceData{
 if(!payload||typeof payload!=="object")return bad();
 const d=payload as RiverInfluenceData,r=d.recipe;
 if(d.version!==1||!hash(snapshot)||d.snapshot!==snapshot||!r||r.version!==1||r.method!=="river-influence-water-r8-min-child-lag-v2"||r.model_eligible!==false||r.retrospective!==true||r.temporal_basis!=="provider_daily"||!hash(r.hydrology_catalog_sha256)||!hash(r.study_sha256)||typeof r.qualification!=="string"||!Array.isArray(r.cells)||!r.cells.length||new Set(r.cells).size!==r.cells.length||r.cells.some(c=>!isValidCell(c)||getResolution(c)!==6)||!Array.isArray(r.dates)||!r.dates.length||r.dates.some((v,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v||i>0&&Date.parse(v)-Date.parse(r.dates[i-1])!==86400000)||!Array.isArray(r.rivers)||!r.rivers.length||new Set(r.rivers.map(v=>v.id)).size!==r.rivers.length||!r.config||!Array.isArray(r.config.distance_profiles)||!r.config.distance_profiles.length||!Array.isArray(r.config.lag_profiles)||!r.config.lag_profiles.length)return bad();
 if(!r.signals||Object.keys(r.signals).sort().join(",")!=="discharge,relative_flow")return bad();
 for(const profiles of [r.config.distance_profiles,r.config.lag_profiles])if(new Set(profiles.map(p=>p.id)).size!==profiles.length||profiles.some(p=>!p.id||!p.label))return bad();
 if(!r.config.distance_profiles.some(p=>p.id===r.config.defaults.distance)||!r.config.lag_profiles.some(p=>p.id===r.config.defaults.lag))return bad();
 for(const p of r.config.distance_profiles)if(!["exponential","gaussian"].includes(p.kind)||![p.scale_km,p.peak_km,p.cutoff_km].every(Number.isFinite)||p.scale_km<=0||p.peak_km<0||p.cutoff_km<=p.peak_km)return bad();
 for(const p of r.config.lag_profiles)if(!Array.isArray(p.weights)||!p.weights.length||new Set(p.weights.map(v=>v.days)).size!==p.weights.length||p.weights.some(v=>!Number.isInteger(v.days)||v.days<0||v.days>366||!Number.isFinite(v.weight)||v.weight<0)||p.weights.reduce((a,v)=>a+v.weight,0)<=0)return bad();
 for(const distance of r.config.distance_profiles)for(const lag of r.config.lag_profiles)for(const metric of ["discharge","relative_flow"] as const){const bounds=r.display_ranges?.[`${distance.id}:${lag.id}`]?.[metric];if(!Array.isArray(bounds)||bounds.length!==2||!bounds.every(Number.isFinite)||bounds[0]>bounds[1])return bad();}
 for(const river of r.rivers){
  const rid=river.id;
  if(!rid||!river.name||!river.outlet_id||!Number.isFinite(river.gain)||river.gain<0||!river.binding||!Array.isArray(river.binding.modeled_outlet_point_wgs84)||river.binding.modeled_outlet_point_wgs84.length!==2||!river.binding.modeled_outlet_point_wgs84.every(Number.isFinite)||!numeric(d.distances?.[rid],r.cells.length,true))return bad();
  for(const p of r.config.distance_profiles)if(!numeric(d.weights?.[rid]?.[p.id],r.cells.length,true)||d.weights[rid][p.id].some((v,i)=>(v===null)!==(d.distances[rid][i]===null)))return bad();
  for(const p of r.config.lag_profiles)for(const metric of ["discharge","relative_flow","interpolated_input_weight"])if(!numeric(d.daily?.[rid]?.[p.id]?.[metric],r.dates.length,metric==="interpolated_input_weight"))return bad();
 }
 return d;
}
export async function loadRiverInfluence():Promise<RiverInfluenceData|undefined>{
 const response=await fetch("/local-data/river-influence/catalog.json",{cache:"no-store"});
 if(response.status===404)return undefined;
 if(!response.ok){const detail=await response.json() as {error?:string};throw new Error(detail.error??"River influence unavailable");}
 const c=await response.json() as InfluenceCatalog;
 if(c.version!==1||!hash(c.snapshot)||!hash(c.source_sha256)||!hash(c.data?.sha256)||c.data.url!==`/local-data/river-influence/${c.snapshot}.json`)return bad();
 const asset=await fetch(c.data.url);if(!asset.ok)return bad();const bytes=await asset.arrayBuffer();
 const sum=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");if(sum!==c.data.sha256)return bad();
 return {...decodeRiverInfluence(JSON.parse(new TextDecoder().decode(bytes)),c.snapshot),sourceSha256:c.source_sha256};
}
export const defaultInfluenceSettings=(d:RiverInfluenceData):InfluenceSettings=>({date:d.recipe.dates.at(-1)!,...d.recipe.config.defaults});
const metrics:{id:InfluenceMetric;name:string;unit:string;definition:string}[]=[
 {id:"relative_flow",name:"Relative flow influence",unit:"index",definition:"Sum of water-distance weights × lagged gauge flow divided by each river’s historical P90. Supported subtotal."},
 {id:"discharge",name:"Discharge influence",unit:"weighted gauge m³/s",definition:"Sum of water-distance weights × lagged upstream gauge discharge. Proxy index; not discharge measured at marine cells or conserved freshwater volume."},
];
export const isRiverInfluenceFeature=(field:SeascapeFeature|undefined)=>field?.role==="exploratory_supported_river_influence";
export function withRiverInfluence(catalog:SeascapeCatalog,data:RiverInfluenceData):SeascapeCatalog{
 const features:SeascapeFeature[]=metrics.map(m=>({id:`RIVER_INFLUENCE__${m.id}`,column:m.id,dataset:"hydrology",resolution:6,family:"River influence",name:m.name,unit:m.unit,range:[0,data.recipe.rivers.length],available:data.recipe.cells.length,rows:data.recipe.cells.length,kind:"numeric",role:"exploratory_supported_river_influence",qualifiers:[],sourceRelease:data.snapshot,sourcePath:"Hydrology/influence.parquet",sourceSha256:data.sourceSha256??data.snapshot,definition:m.definition,modelingEligibility:"Retrospective exploratory scenario; model_eligible=false",arrowType:"double"}));
 return {...catalog,riverInfluence:data,features:[...catalog.features,...features],datasets:{...catalog.datasets,hydrology:catalog.datasets?.hydrology??{name:"Hydrology",release:data.snapshot,status:"Exploratory river influence scenarios",limitations:data.recipe.qualification,manifestSha256:data.sourceSha256}}};
}
export function riverInfluenceLayer(catalog:SeascapeCatalog,field:SeascapeFeature,selection?:InfluenceSettings):SeascapeLayer{
 const data=catalog.riverInfluence!,recipe=data.recipe,settings=selection??defaultInfluenceSettings(data);
 const t=recipe.dates.indexOf(settings.date),metric=field.column as InfluenceMetric;
 if(t<0||!recipe.config.distance_profiles.some(p=>p.id===settings.distance)||!recipe.config.lag_profiles.some(p=>p.id===settings.lag)||!metrics.some(m=>m.id===metric))throw new Error("Unknown river influence date or scenario.");
 const cells=recipe.cells.map(id=>{const[lat,lon]=cellToLatLng(id);return{id,lat,lon,boundary:[],zone:"north" as const};});
 const values=new Map<string,number|null>(),contributions=new Map<string,InfluenceContribution[]>(),coverage:number[]=[],active:number[]=[],statuses:string[]=[];
 cells.forEach((cell,i)=>{
  const parts=recipe.rivers.map(r=>{const weight=data.weights[r.id][settings.distance][i],signal=data.daily[r.id][settings.lag][metric][t];return{river:r.id,name:r.name,distanceM:data.distances[r.id][i],weight,signal,value:weight===null?null:weight===0?0:signal===null?null:weight*signal,share:null as number|null,interpolatedInputWeight:data.daily[r.id][settings.lag].interpolated_input_weight[t]};});
  const known=parts.filter(p=>p.weight!==null),participating=known.filter(p=>(p.weight??0)>0),unknownTemporal=participating.some(p=>p.signal===null);
  const value=!known.length||unknownTemporal?null:known.reduce((sum,p)=>sum+(p.value??0),0);
  const positive=parts.reduce((s,p)=>s+Math.max(0,p.value??0),0);parts.forEach(p=>{p.share=p.value!==null&&p.value>0&&positive>0?p.value/positive:null;});
  values.set(cell.id,value);contributions.set(cell.id,parts);coverage.push(known.length/parts.length);active.push(participating.length);statuses.push(value===null?"unavailable":known.length<parts.length?"partial spatial support":"supported");
 });
 const range=recipe.display_ranges[`${settings.distance}:${settings.lag}`][metric];
 return{id:field.id,name:field.name,unit:field.unit,resolution:6,range,cells,values,rawValues:values,index:new Map(cells.map((c,i)=>[c.id,i])),field,catalog,qualifiers:{"Route coverage":coverage,"Active rivers":active,"Support":statuses},riverInfluence:{settings,recipe,metric,contributions},sourceLabel:recipe.qualification,slice:{axis:"Provider-date scenario",value:JSON.stringify(settings),label:settings.date}};
}

export function riverInfluenceDatasetInfo(layer:SeascapeLayer|undefined):NonNullable<SeascapeCatalog["datasets"]>[string]|undefined{
 if(!layer?.riverInfluence)return undefined;
 return {name:"Hydrology",release:layer.riverInfluence.recipe.method,status:"Retrospective river influence",limitations:layer.riverInfluence.recipe.qualification,manifestSha256:layer.field.sourceSha256,publishedAt:undefined};
}
