import { cellToLatLng, getResolution, isValidCell } from "h3-js";
import type { Asset, SeascapeCatalog, SeascapeFeature, SeascapeLayer } from "./seascape";

export const orcaCategories = ["srkw", "transient", "other"] as const;
export type OrcaCategory = typeof orcaCategories[number];
export const orcaCategoryLabels: Record<OrcaCategory,string> = {srkw:"SRKW",transient:"Transient",other:"Other"};
export const orcaCategoryColors: Record<OrcaCategory,string> = {srkw:"#167c9c",transient:"#b26843",other:"#766494"};
export type OrcaGranularity = "daily" | "weekly" | "monthly" | "yearly" | "all";
export type OrcaRepresentation = "counts" | "points";
export interface OrcaState { categories: readonly OrcaCategory[]; granularity: OrcaGranularity; anchor: string | null; representation: OrcaRepresentation; whaleMarkers: boolean; }
export const defaultOrcaState: OrcaState = {categories:orcaCategories,granularity:"monthly",anchor:null,representation:"counts",whaleMarkers:false};
export const orcaCaveat = "Source-deduplicated sighting records; reports from different providers may describe the same encounter. No sightings does not mean no whales or complete survey effort.";
export interface OrcaPodAssignment {label:string;group_type:string;source_term:string|null;evidence_field:string;evidence_text:string|null;confidence:string;conflicting:boolean;}
export interface OrcaSighting {
  source_description?:string|null; observed_at_raw:string|null; observed_date_raw:string|null; pod_group_status:string; pod_group_assignments:readonly OrcaPodAssignment[];
  event_id:string; source:string; source_record_id:string; source_native_id:string|null; source_event_id:string|null; source_dataset_id:string|null;
  source_occurrence_ids:readonly (string|null)[]|null; source_occurrence_count:number;
  category:OrcaCategory; ecotype_detail:string; classification_status:"source_supported"|"unknown"|"mixed";
  native_classification:string|null; classification_evidence_json:string|undefined;
  observed_at_utc:string|null; time_start_utc:string|null; time_end_utc:string|null; time_precision:"subsecond"|"second"|"minute"|"day"|"unknown";
  native_date:string|null; source_timezone:string; utc_date:string|null;
  latitude:number|null; longitude:number|null; latitude_raw:string|null; longitude_raw:string|null;
  coordinate_uncertainty_m:number|null; coordinate_transform:string; coordinate_role:string|null; h3_r6:string|null; h3_precision_status:string;
  source_license:string; source_use_class:string; source_retrieved_at_utc:string|null; qc_flags:readonly (string|null)[];
}
export interface OrcaDemography {rows:readonly {census_year:number;j_pod:number;k_pod:number;l_pod:number;all_pods:number;verification_status:string;census_date:string|null}[];sourceCatalogSha256:string;sourceParquetSha256:string;sourceUrl:string;limitations:string;}
export interface OrcaCatalog {
  demography?:OrcaDemography|null;
  version:1; status:"validated_local_snapshot"|"synthetic_fixture"; snapshot:string; rows:number; events:Asset; details?:Record<string,Asset>;
  source:{ providers?:readonly {source:string;status:string;retrieved_at_utc:string|null;actual_latest_study_sighting_native_date:string|null;scope:string;availability_caveat:string}[];dailyCoverage?:{daily_included:number;daily_unbinned:number;total_records:number}|null;rootCatalogSha256?:string|null;catalogSha256:string; parquetSha256:string; schemaVersion:string; limitations:string; publishedAt:string; };
}
export interface OrcaData { catalog:OrcaCatalog; records:readonly OrcaSighting[]; grid:readonly string[]; }
export interface OrcaPeriod {key:string;label:string;start:string|null;end:string|null;}
export interface OrcaFrame {
  period:OrcaPeriod; records:readonly OrcaSighting[]; points:readonly OrcaSighting[]; counts:ReadonlyMap<string,number>;
  undatedIncluded:number; unassignedTime:number; unlocated:number; unbinned:number; categoryCounts:Record<OrcaCategory,number>;
}
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==="string"&&v.trim().length>0;
const error=(reason:string):never=>{throw new Error(`Invalid Orca sightings: ${reason}.`);};
const timeKey=(value:string)=>value.slice(0,19)+"."+(value.split(".")[1]?.slice(0,-1)??"").padEnd(6,"0")+"Z";
function utc(value:unknown):value is string {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value))return false;
  const parsed=Date.parse(value);return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,19)===value.slice(0,19);
}
export function decodeOrcaSightings(payload:unknown,catalog:OrcaCatalog,allowFixture=false):OrcaData {
  if(catalog.version!==1||!((allowFixture&&catalog.status==="synthetic_fixture")||catalog.status==="validated_local_snapshot")||!/^[a-f0-9]{64}$/.test(catalog.snapshot)||!Number.isSafeInteger(catalog.rows)||catalog.rows<0)
    return error("unsupported catalog");
  if(object(payload)&&object(payload.columns)){
    const columns=payload.columns;
    payload={...payload,records:Array.from({length:catalog.rows},(_,i)=>Object.fromEntries(Object.entries(columns).map(([k,v])=>{
      if(Array.isArray(v)&&v.length===catalog.rows)return[k,v[i]];
      if(object(v)&&Array.isArray(v.dictionary)&&Array.isArray(v.indices)&&v.indices.length===catalog.rows&&Number.isInteger(v.indices[i])&&v.indices[i]>=0&&v.indices[i]<v.dictionary.length)return[k,v.dictionary[v.indices[i]]];
      return error("column encoding");
    })))};
  }
  if(!object(payload)||payload.kind!=="orca-sightings"||payload.version!==1||payload.snapshot!==catalog.snapshot||!Array.isArray(payload.records)||payload.records.length!==catalog.rows||!Array.isArray(payload.grid)||
    payload.grid.some(id=>typeof id!=="string"||!isValidCell(id)||getResolution(id)!==6)||new Set(payload.grid).size!==payload.grid.length) return error("native payload/support binding");
  if(catalog.demography&&catalog.demography.rows.some(r=>r.verification_status!=="primary_web_confirmed"||![2024,2025].includes(r.census_year)||![r.j_pod,r.k_pod,r.l_pod,r.all_pods].every(v=>Number.isSafeInteger(v)&&v>=0)||r.j_pod+r.k_pod+r.l_pod!==r.all_pods))return error("unverified annual demography");
  const grid=new Set(payload.grid as string[]),records=new Map<string,OrcaSighting>();
  for(const raw of payload.records){
    if(!object(raw)||!["event_id","source","source_record_id","h3_precision_status","ecotype_detail","source_timezone","source_license","source_use_class","coordinate_transform","pod_group_status"].every(key=>text(raw[key]))||!orcaCategories.includes(raw.category as OrcaCategory)||
      !["source_supported","unknown","mixed"].includes(String(raw.classification_status))||!["subsecond","second","minute","day","unknown"].includes(String(raw.time_precision)))return error("identity/category/precision");
    for(const key of ["source_native_id","source_event_id","source_dataset_id","ecotype_detail","native_classification","native_date","source_timezone","utc_date","latitude_raw","longitude_raw","source_license","source_use_class","coordinate_role","observed_at_raw","observed_date_raw"])
      if(raw[key]!==null&&typeof raw[key]!=="string")return error("source descriptors");
    if(raw.source_occurrence_ids!==null&&(!Array.isArray(raw.source_occurrence_ids)||!raw.source_occurrence_ids.every(v=>v===null||text(v))))return error("source occurrence lineage");
    if(!Array.isArray(raw.qc_flags)||!raw.qc_flags.every(v=>v===null||typeof v==="string"))return error("QC flags");
    if(raw.classification_evidence_json===undefined&&!catalog.details)return error("missing classification evidence binding");
    try {if(raw.classification_evidence_json!==undefined&&!Array.isArray(JSON.parse(raw.classification_evidence_json as string)))return error("classification evidence");}catch{return error("classification evidence JSON");}
    if(raw.source_description!==undefined&&raw.source_description!==null&&typeof raw.source_description!=="string")return error("source description");
    if(!["unknown","reported","multiple_reported","conflicting_source_evidence"].includes(raw.pod_group_status as string)||!Array.isArray(raw.pod_group_assignments)||raw.pod_group_assignments.some(v=>!object(v)||!["label","group_type","evidence_field","confidence"].every(k=>text(v[k]))||typeof v.conflicting!=="boolean"||["source_term","evidence_text"].some(k=>v[k]!==null&&typeof v[k]!=="string")))return error("source pod/group assignments");
    if(!Number.isSafeInteger(raw.source_occurrence_count)||(raw.source_occurrence_count as number)<1)return error("source occurrence count");
    if((raw.time_start_utc===null)!==(raw.time_end_utc===null))return error("partial time bounds");
    if(raw.time_start_utc!==null&&(!utc(raw.time_start_utc)||!utc(raw.time_end_utc)||timeKey(raw.time_end_utc)<=timeKey(raw.time_start_utc)||raw.time_precision==="unknown"))return error("UTC interval");
    if(raw.time_precision!=="unknown"&&raw.time_start_utc===null&&!(raw.qc_flags as (string|null)[]).some(flag=>flag==="UNKNOWN_SOURCE_TIMEZONE"||flag==="UNPARSED_OR_AMBIGUOUS_SOURCE_CLOCK"))return error("missing declared time support");
    if(raw.observed_at_utc!==null&&(!utc(raw.observed_at_utc)||raw.time_start_utc===null||timeKey(raw.observed_at_utc)<timeKey(raw.time_start_utc as string)||timeKey(raw.observed_at_utc)>=timeKey(raw.time_end_utc as string)))return error("reported timestamp outside support");
    if(raw.source_retrieved_at_utc!==null&&!utc(raw.source_retrieved_at_utc))return error("source receipt time");
    if((raw.latitude===null)!==(raw.longitude===null))return error("partial coordinate pair");
    if(raw.latitude!==null&&(typeof raw.latitude!=="number"||!Number.isFinite(raw.latitude)||Math.abs(raw.latitude)>90||typeof raw.longitude!=="number"||!Number.isFinite(raw.longitude)||Math.abs(raw.longitude)>180))return error("reported coordinates");
    if(raw.coordinate_uncertainty_m!==null&&(typeof raw.coordinate_uncertainty_m!=="number"||!Number.isFinite(raw.coordinate_uncertainty_m)||raw.coordinate_uncertainty_m<0))return error("coordinate uncertainty");
    if(raw.h3_r6!==null&&(typeof raw.h3_r6!=="string"||!grid.has(raw.h3_r6)))return error("unregistered native cell");
    if(raw.classification_status!=="source_supported"&&raw.category!=="other")return error("unknown/mixed classification outside Other");
    const record=Object.freeze({...raw,source_occurrence_ids:raw.source_occurrence_ids===null?null:Object.freeze([...(raw.source_occurrence_ids as string[])]),qc_flags:Object.freeze([...(raw.qc_flags as string[])])}) as unknown as OrcaSighting;
    const prior=records.get(record.event_id);
    if(prior&&JSON.stringify(prior)!==JSON.stringify(record))return error("conflicting duplicate event identity");
    records.set(record.event_id,record);
  }
  return {catalog,records:Object.freeze([...records.values()]),grid:Object.freeze([...grid])};
}
export async function loadOrcaData(allowFixture=false):Promise<OrcaData|undefined>{
  const response=await fetch("/local-data/orca/catalog.json",{cache:"no-store"});
  if (response.status >= 500) { const detail = await response.json() as {error?: string}; throw new Error(detail.error || "Current Orca files could not be read."); }
  if(!response.ok||!response.headers.get("content-type")?.includes("json"))return undefined;
  const catalog=await response.json() as OrcaCatalog;
  if(!catalog.events?.url?.startsWith("/local-data/orca/")||!/^[a-f0-9]{64}$/.test(catalog.events.sha256))return error("event asset binding");
  const asset=await fetch(catalog.events.url);if(!asset.ok)return error("event asset unavailable");
  const bytes=await asset.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");
  if(sha!==catalog.events.sha256)return error("event checksum mismatch");
  return decodeOrcaSightings(JSON.parse(new TextDecoder().decode(bytes)),catalog,allowFixture);
}
const date=(n:number)=>new Date(n).toISOString();
const dayFormatter=new Intl.DateTimeFormat("en",{timeZone:"UTC",year:"numeric",month:"short",day:"numeric"});
const monthFormatter=new Intl.DateTimeFormat("en",{timeZone:"UTC",year:"numeric",month:"long"});
const dayLabel=(n:number)=>dayFormatter.format(n);
function floor(n:number,g:OrcaGranularity){const d=new Date(n);d.setUTCHours(0,0,0,0);if(g==="weekly")d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));if(g==="monthly"||g==="yearly")d.setUTCDate(1);if(g==="yearly")d.setUTCMonth(0);return d.getTime();}
function next(n:number,g:OrcaGranularity){const d=new Date(n);if(g==="yearly")d.setUTCFullYear(d.getUTCFullYear()+1);else if(g==="monthly")d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCDate(d.getUTCDate()+(g==="weekly"?7:1));return d.getTime();}
export function isoWeekLabel(n:number){const d=new Date(floor(n,"weekly"));d.setUTCDate(d.getUTCDate()+3);const year=d.getUTCFullYear(),start=Date.UTC(year,0,1);return `${year}-W${String(Math.ceil(((d.getTime()-start)/86400000+1)/7)).padStart(2,"0")}`;}
export function orcaPeriods(data:OrcaData,g:OrcaGranularity):OrcaPeriod[]{
  // Category filters never move the calendar or replace an empty selected frame.
  const dated=data.records.filter(r=>r.time_start_utc!==null);
  const extent=dated.reduce(([lo,hi],r)=>[Math.min(lo,Date.parse(r.time_start_utc!)),Math.max(hi,Date.parse(r.time_end_utc!)+(Number(r.time_end_utc!.slice(20,-1).slice(3))>0?1:0))], [Infinity,-Infinity]);
  const start=dated.length?extent[0]:null,end=dated.length?extent[1]:null;
  if(g==="all")return [{key:"all",label:start===null?"All retained records":`All time · ${dayLabel(start)} – ${dayLabel(end!-1)}`,start:start===null?null:date(start),end:end===null?null:date(end)}];
  if(start===null||end===null)return [];
  const periods:OrcaPeriod[]=[];
  for(let n=floor(start,g);n<end;n=next(n,g)){
    const key=date(n),until=next(n,g);
    periods.push({key,start:key,end:date(until),label:g==="weekly"?`${isoWeekLabel(n)} · ${dayLabel(n)}`:g==="monthly"?monthFormatter.format(n):g==="yearly"?String(new Date(n).getUTCFullYear()):dayLabel(n)});
  }
  return periods;
}
export function currentOrcaPeriod(periods:readonly OrcaPeriod[],anchor:string|null):OrcaPeriod{
  if(!periods.length)return {key:"unavailable",label:"No assignable UTC periods",start:null,end:null};
  if(periods[0].key==="all")return periods[0];
  const n=anchor===null?Infinity:Date.parse(anchor);
  return periods.find(p=>Date.parse(p.start!)<=n&&n<Date.parse(p.end!))??(n<Date.parse(periods[0].start!)?periods[0]:periods.at(-1)!);
}
export function filterOrcaFrame(data:OrcaData,state:Pick<OrcaState,"categories"|"granularity"|"anchor">,period=currentOrcaPeriod(orcaPeriods(data,state.granularity),state.anchor)):OrcaFrame{
  const counts=new Map(data.grid.map(id=>[id,0])),categoryCounts:Record<OrcaCategory,number>={srkw:0,transient:0,other:0};
  const records:OrcaSighting[]=[],seen=new Set<string>();let undatedIncluded=0,unassignedTime=0;
  for(const record of data.records){
    if(seen.has(record.event_id)||!state.categories.includes(record.category))continue;seen.add(record.event_id);
    const start=record.time_start_utc===null?null:timeKey(record.time_start_utc),end=record.time_end_utc===null?null:timeKey(record.time_end_utc);
    const included=state.granularity==="all"||(start!==null&&period.start!==null&&start>=timeKey(period.start)&&end!<=timeKey(period.end!));
    if(!included){if(start===null||(period.start!==null&&start<timeKey(period.end!)&&end!>timeKey(period.start)))unassignedTime++;continue;}
    records.push(record);categoryCounts[record.category]++;if(start===null)undatedIncluded++;
    if(record.h3_r6!==null)counts.set(record.h3_r6,(counts.get(record.h3_r6)??0)+1);
  }
  const points=records.filter(r=>r.latitude!==null&&r.longitude!==null);
  return {period,records,points,counts,categoryCounts,undatedIncluded,unassignedTime,unlocated:records.length-points.length,unbinned:records.filter(r=>r.h3_r6===null).length};
}
export function withOrca(catalog:SeascapeCatalog,data:OrcaData):SeascapeCatalog{
  const field:SeascapeFeature={id:"ORCA__reported_sightings",dataset:"marine-mammals",family:"Orca",name:"Reported sightings",resolution:6,unit:"records",range:[0,data.records.length],available:data.records.length,rows:data.grid.length,kind:"numeric",role:"source_deduplicated_sighting_records",qualifiers:[],sourceRelease:data.catalog.source.publishedAt,sourcePath:"Orca/Sightings/sightings.parquet",sourceSha256:data.catalog.source.parquetSha256,definition:orcaCaveat,modelingEligibility:"research observations; survey effort not established",arrowType:"source_deduplicated_records"};
  return {...catalog,orca:data,datasets:{...catalog.datasets,"marine-mammals":{name:"Marine mammals",release:"Orca sightings",status:data.catalog.status,publishedAt:data.catalog.source.publishedAt,manifestSha256:data.catalog.source.catalogSha256,limitations:orcaCaveat}},features:[...catalog.features,field]};
}
export function orcaCountLayer(catalog:SeascapeCatalog,field:SeascapeFeature,frame:OrcaFrame):SeascapeLayer{
  const values=new Map([...frame.counts].map(([id,count])=>[id,count>0?count:null]));
  const cells=[...frame.counts.keys()].map(id=>{const[lat,lon]=cellToLatLng(id);return{id,lat,lon,boundary:[],zone:"north" as const};});
  return {id:field.id,name:field.name,unit:"records",range:[0,Math.max(0,...frame.counts.values())],resolution:6,cells,values,rawValues:values,index:new Map(cells.map((c,i)=>[c.id,i])),qualifiers:{},field,catalog,sourceLabel:"Reported sightings · source-deduplicated · effort unknown",slice:{axis:"UTC period",value:frame.period.key,label:frame.period.label}};
}

/** Evidence stays local and checksum-bound; load at most four lineage shards per snapshot. */
export interface OrcaDetails {classification_evidence_json:string;source_description:string|null;}
const evidenceCaches=new WeakMap<OrcaData,Map<string,Promise<Record<string,OrcaDetails>>>>();
export async function loadOrcaDetails(data:OrcaData,record:OrcaSighting):Promise<OrcaDetails>{
 if(record.classification_evidence_json!==undefined&&record.source_description!==undefined)return {classification_evidence_json:record.classification_evidence_json,source_description:record.source_description};
 const key=record.event_id.split(":").at(-1)!.slice(0,2),asset=data.catalog.details?.[key];
 if(!asset||!asset.url.startsWith(`/local-data/orca/${data.catalog.snapshot}.evidence-`)||!/^[a-f0-9]{64}$/.test(asset.sha256))return error("lineage asset binding");
 let cache=evidenceCaches.get(data);if(!cache){cache=new Map();evidenceCaches.set(data,cache);}
 let pending=cache.get(key);
 if(!pending){pending=(async()=>{const response=await fetch(asset.url);if(!response.ok)return error("lineage unavailable");const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");if(hash!==asset.sha256)return error("lineage checksum");return JSON.parse(new TextDecoder().decode(bytes)) as Record<string,OrcaDetails>;})();cache.set(key,pending);if(cache.size>4)cache.delete(cache.keys().next().value!);}
 const evidence=(await pending)[record.event_id];if(!evidence||typeof evidence.classification_evidence_json!=="string"||!Array.isArray(JSON.parse(evidence.classification_evidence_json))||(evidence.source_description!==null&&typeof evidence.source_description!=="string"))return error("native evidence");return evidence;
}

/** Each record contributes once per explicit typed label; untyped identifiers never infer pods. */
export function orcaPodSummary(records:readonly OrcaSighting[]){
 const groups=new Map<string,{label:string;groupType:string;records:number}>(),seen=new Set<string>();
 for(const record of records){if(seen.has(record.event_id))continue;seen.add(record.event_id);
  const assignments=new Map(record.pod_group_assignments.filter(a=>["pod","source_named_group","source_named_pod","source_named_matriline"].includes(a.group_type)).map(a=>[`${a.group_type}:${a.label}`,a]));
  if(!assignments.size){const prior=groups.get("unknown")??{label:"Unknown pod/group",groupType:"unknown",records:0};prior.records++;groups.set("unknown",prior);}
  for(const[key,a]of assignments){const prior=groups.get(key)??{label:a.label,groupType:a.group_type,records:0};prior.records++;groups.set(key,prior);}
 }
 return {distinctRecords:seen.size,groups:[...groups.values()].sort((a,b)=>a.label.localeCompare(b.label))};
}
