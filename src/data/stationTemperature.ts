export interface TemperatureStation {
 provider_station_id?:string;station_id:string;river_id:string;provider_station_name:string;latitude:number;longitude:number;
 identity_note?:string;provider:string;unit:"degC";statistics:readonly string[];coordinate_crs:"EPSG:4326"|"not explicitly stated by station page";
 coordinate_source:string;coordinate_source_detail?:string;coordinate_precision?:string;coordinate_accuracy?:string;coordinate_conversion?:string;coordinate_conversion_accuracy_metres?:number;source_coordinate_crs?:string;
 day_definition:string;timezone:string|null;relationship:string;quality:string;cadence:string;
 availability:string;rights?:string;rights_url:string;author?:string;model_eligible:false;
}
export interface StationTemperatureRow {station_id:string;river_id:string;date:string;statistic:"daily_mean"|"daily_min"|"daily_max";value:number;unit:"degC";status:"valid";temporal_basis:"provider_daily";quality_flags:string;source_url:string;source_sha256:string;retrieved_at:string;report_date:string;source_title:string;}
export interface StationTemperature {sha256:string;stations:Record<string,TemperatureStation>;rows:readonly StationTemperatureRow[];missingness:string;}
export function decodeStationTemperature(value:unknown):StationTemperature|undefined {
 if(value==null)return undefined;
 const fail=():never=>{throw new Error("Invalid station-temperature companion");};
 if(typeof value!=="object"||Array.isArray(value))return fail();
 const d=value as StationTemperature;
 if(!/^[a-f0-9]{64}$/.test(d.sha256)||!d.stations||typeof d.stations!=="object"||!Array.isArray(d.rows)||!d.rows.length||typeof d.missingness!=="string")return fail();
 for(const [id,s] of Object.entries(d.stations)){
  if(s.station_id!==id||!Number.isFinite(s.latitude)||Math.abs(s.latitude)>90||!Number.isFinite(s.longitude)||Math.abs(s.longitude)>180||s.unit!=="degC"||!["EPSG:4326","not explicitly stated by station page"].includes(s.coordinate_crs)||s.model_eligible!==false||!s.statistics?.includes("daily_mean")||new Set(s.statistics).size!==s.statistics.length||s.statistics.some(x=>!["daily_mean","daily_min","daily_max"].includes(x)))return fail();
  for(const k of ["river_id","provider_station_name","provider","coordinate_source","day_definition","relationship","quality","cadence","availability","rights_url"] as const)if(typeof s[k]!=="string")return fail();
 }
 const keys=new Set<string>();
 for(const r of d.rows){
  const s=d.stations[r.station_id],key=[r.station_id,r.date,r.statistic,r.temporal_basis].join(":");
  if(!s||s.river_id!==r.river_id||keys.has(key)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(r.value)||!s.statistics.includes(r.statistic)||r.unit!=="degC"||r.status!=="valid"||r.temporal_basis!=="provider_daily"||!/^https:\/\//.test(r.source_url)||!/^[a-f0-9]{64}$/.test(r.source_sha256)||r.report_date<r.date)return fail();
  try{if(!JSON.parse(r.quality_flags)||Array.isArray(JSON.parse(r.quality_flags))||typeof JSON.parse(r.quality_flags)!=="object")return fail();}catch{return fail();}keys.add(key);
 }
 return d;
}
