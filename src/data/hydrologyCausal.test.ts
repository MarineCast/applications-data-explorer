import {describe,it,expect} from "vitest";
import {causalHydrologyFixture,hydrologyPayload,hydroCell} from "../test/hydrologyFixture";
import {causalMetricIds,decodeHydrology,hydrologyChartPath,hydrologyLayer,withHydrology} from "./hydrology";
import {hydrologyPointGeoJSON} from "./hydrologyOverlay";
import type {SeascapeCatalog} from "./seascape";

describe("causal native-river contract",()=>{
 it("decodes all eight typed metrics, retains nulls/zero and mouth-reference values",()=>{
  const fixture=causalHydrologyFixture(),data=decodeHydrology({...hydrologyPayload(fixture),causal:fixture.causal},fixture.catalog);
  const catalog=withHydrology({features:[]} as unknown as SeascapeCatalog,data);
  for(const id of causalMetricIds){
   const feature=catalog.features.find(f=>f.column===id)!;expect(feature.sourcePath).toBe("Hydrology/causal.parquet");expect(feature.modelingEligibility).toContain("model_eligible=false");
   const layer=hydrologyLayer(catalog,feature,data.dates[1]);expect(layer.values.get(hydroCell)).toBe(data.rivers[0].series[id].values[1]);
   const nodes=hydrologyPointGeoJSON({data,metric:id,day:data.dates[1],onSelect:()=>{}});expect(nodes.features[0].properties?.missing).toBe(false);
  }
  expect(data.rivers[0].series.causal_discharge_pulse.values[0]).toBeNull();expect(data.rivers[0].series.causal_reference_samples.values[0]).toBe(0);
 });
 it("rejects missing companion, wrong lag, units, model eligibility, status and pulse values",()=>{
  const data=causalHydrologyFixture();
  expect(()=>decodeHydrology(hydrologyPayload(data),data.catalog)).toThrow("without companion");
  for(const change of [ {asOfDates:data.dates}, {definition:{...data.causal!.definition,model_eligible:true}}, {sourceConditionsSha256:{}} ]){
   expect(()=>decodeHydrology({...hydrologyPayload(data),causal:{...data.causal,...change}},data.catalog)).toThrow();
  }
  const payload={...hydrologyPayload(data),causal:data.causal};
  expect(()=>decodeHydrology({...payload,metrics:payload.metrics.map(m=>m.id==="causal_discharge_pulse"?{...m,unit:"m3/s"}:m)},data.catalog)).toThrow("metric contract");
  for(const values of [[0,0,1,null,0,0,1],[null,0,2,null,0,0,1]]){
   expect(()=>decodeHydrology({...payload,rivers:[{...data.rivers[0],series:{...data.rivers[0].series,causal_discharge_pulse:{...data.rivers[0].series.causal_discharge_pulse,values}}},data.rivers[1]]},data.catalog)).toThrow();
  }
 });
 it("uses step paths for discrete metrics without bridging missing days",()=>{
  const path=hydrologyChartPath([0,1,null,0,1],242,110,[0,1],132,true);
  expect(path.match(/M/g)).toHaveLength(2);expect(path.match(/H/g)).toHaveLength(2);expect(path.match(/V/g)).toHaveLength(2);expect(path).not.toContain("L");
 });
});
