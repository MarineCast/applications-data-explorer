/** Synthetic river calendars and reference points used only by tests. */
import {latLngToCell} from "h3-js";
import type {HydrologyCatalog,HydrologyData,HydrologyMetric,HydrologyRiver,HydrologySeries} from "../data/hydrology";
import {hydrologyMetricIds} from "../data/hydrology";
export const hydroCell=latLngToCell(49.118333,-123.190833,6),hydroOtherCell=latLngToCell(48.753056,-123.636667,6),hydroBackgroundCell=latLngToCell(48.1,-124,6);
const sourceHash="a".repeat(64);
const names:Record<string,string>={discharge_mean:"Daily mean discharge",discharge_mean_7d:"7-day mean discharge",discharge_mean_30d:"30-day mean discharge",discharge_change_7d:"7-day discharge change",low_flow_duration:"Low-flow duration",high_flow_duration:"High-flow duration",days_since_flow_pulse:"Days since flow pulse",temperature_mean:"Daily mean water temperature",temperature_max:"Daily maximum water temperature",temperature_7dadm:"7-day average daily maximum temperature"};
const dates=["2026-09-24","2026-09-25","2026-09-26","2026-09-27","2026-09-28","2026-09-29","2026-09-30"];
export function hydrologyFixture(shared=false):HydrologyData{
 const metrics:HydrologyMetric[]=hydrologyMetricIds.map(id=>({id,name:names[id],family:id.startsWith("temperature")?"Water temperature":id.includes("duration")||id.includes("pulse")?"Flow indicators":"Discharge",unit:id.startsWith("temperature")?"degC":id.includes("duration")||id.includes("pulse")?"day":"m3/s",definition:"Synthetic retained metric for UI contract tests.",range:[0,20],available:7}));
 const catalog:HydrologyCatalog={version:1,status:"qualified_local_product",snapshot:sourceHash,rows:100,data:{url:`/local-data/hydrology/${sourceHash}.json`,sha256:sourceHash},source:{catalogSha256:sourceHash,studySha256:sourceHash,registrySha256:sourceHash,productIdentity:"synthetic-test-only",temporalBasis:"provider_daily",sourcePath:"SYNTHETIC_TEST_ONLY"}};
 const rivers:HydrologyRiver[]=["fraser","cowichan"].map((id,i)=>{
  const series=Object.fromEntries(hydrologyMetricIds.map(metric=>{const unavailable=i===1&&metric.startsWith("temperature"),values=unavailable?dates.map(()=>null):[2,0,null,4,5,6,7];const s:HydrologySeries={values,statuses:values.map(v=>v===null?unavailable?"not_applicable":"unavailable":"valid"),reasons:values.map(v=>v===null?unavailable?"not_requested":"no_observation":null),contributorSeries:dates.map(()=>`synthetic:${id}`),flags:dates.map(()=>"{\"approval\":\"Provisional\"}"),retrievedAt:dates.map(()=>"2026-10-16T00:00:00Z"),sourceRelease:dates.map(()=>sourceHash),coverage:dates.map(()=>1)};return[metric,s];})) as Record<typeof hydrologyMetricIds[number],HydrologySeries>;
  const latitude=i&&!shared?48.753056:49.118333,longitude=i&&!shared?-123.636667:-123.190833,cell=latLngToCell(latitude,longitude,6);
  return{id,name:i?"Cowichan":"Fraser",stationId:`TEST-GAUGE-${i}`,stationName:"Synthetic upstream gauge",provider:"TEST_ONLY",gaugeCoordinates:[-121.4,49.4],gaugeRationale:"Synthetic gauge proxy",mouths:[{mouth_id:`synthetic-mouth-${i}`,latitude,longitude,source:"https://example.invalid/synthetic-mouth",cell,inStudyGrid:true,geometry_role:"approximate gazetteer reference",accuracy:"synthetic test only"}],mouthStatus:"approximate; allocation unknown",representation:"representative_gauge_proxy",manifestSha256:sourceHash,metadataSha256:sourceHash,availability:"Synthetic test only",temperatureMissingness:"not_requested describes acquisition scope, not scientific inapplicability",thresholds:{high_flow_threshold_m3_s:6.4,low_flow_threshold_m3_s:10,pulse_threshold_m3_s:1000,qualification:"Unvalidated configured defaults; not whale-response thresholds."},highFlowDefinition:{method:"historical-p90-high-duration-linear-interior-v1",quantile:.9,threshold_m3_s:6.4,reference_start:dates[0],reference_end:dates.at(-1)!,observed_days:6,interpolated_days:1,unfilled_days:0,retrospective:true,model_eligible:false,qualification:"Synthetic retrospective fixture",identity:sourceHash},sourceOutcomes:{discharge_mean:"observed"},series};
 });
 return{catalog,dates,grid:[hydroCell,hydroOtherCell,hydroBackgroundCell],rivers,metrics};
}
export const hydrologyPayload=(data:HydrologyData)=>({kind:"hydrology-mouths",version:1,snapshot:data.catalog.snapshot,dates:data.dates,grid:data.grid,rivers:data.rivers,metrics:data.metrics});
export function relativeHydrologyFixture():HydrologyData{
 const data=hydrologyFixture();
 data.rivers=data.rivers.map((r,i)=>({...r,thresholds:{...r.thresholds,low_flow_threshold_m3_s:i?4.376:862.6},lowFlowDefinition:{method:"historical-p10-linear-interior-v1",quantile:.1,threshold_m3_s:i?4.376:862.6,reference_start:dates[0],reference_end:dates.at(-1)!,observed_days:6,interpolated_days:1,unfilled_days:0,retrospective:true,model_eligible:false,qualification:"Full retained history; uses future observations. Descriptive only, not eligible for operational backtests.",identity:sourceHash},series:{...r.series,low_flow_duration:{...r.series.low_flow_duration,values:[0,1,2,3,0,0,0],statuses:dates.map(()=>"valid"),reasons:[null,null,"interpolated_flow_input","streak_includes_interpolated_flow",null,null,null]}}}));
 return data;
}
export function relativePulseFixture():HydrologyData{
 const data=relativeHydrologyFixture();
 data.rivers=data.rivers.map((r,i)=>({...r,thresholds:{...r.thresholds,pulse_threshold_m3_s:i?120:6000},flowPulseDefinition:{...r.lowFlowDefinition!,method:"historical-p90-linear-interior-v1",quantile:.9,threshold_m3_s:i?120:6000},series:{...r.series,days_since_flow_pulse:{...r.series.days_since_flow_pulse,values:[null,0,1,2,0,1,2],statuses:["unavailable","valid","valid","valid","valid","valid","valid"],reasons:["pulse_history_unknown",null,"interpolated_flow_input","pulse_history_includes_interpolated_flow",null,null,null]}}}));
 return data;
}
export function relativeHighFlowFixture():HydrologyData{
 const data=relativePulseFixture();
 data.rivers=data.rivers.map(r=>({...r,thresholds:{...r.thresholds,high_flow_threshold_m3_s:r.flowPulseDefinition!.threshold_m3_s},highFlowDefinition:{...r.flowPulseDefinition!,method:"historical-p90-high-duration-linear-interior-v1"},series:{...r.series,high_flow_duration:{...r.series.high_flow_duration,values:[0,1,2,3,0,1,2],statuses:dates.map(()=>"valid"),reasons:[null,null,"interpolated_flow_input","streak_includes_interpolated_flow",null,null,null]}}}));
 return data;
}
