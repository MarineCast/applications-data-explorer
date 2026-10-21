import {describe,it,expect} from "vitest";
import {riverInfluenceFixture} from "../test/riverInfluenceFixture";
import {decodeRiverInfluence,withRiverInfluence,riverInfluenceLayer,riverInfluenceDatasetInfo} from "./riverInfluence";
import {withHydrology} from "./hydrology";
import {hydrologyFixture} from "../test/hydrologyFixture";
import type {SeascapeCatalog} from "./seascape";
function layer(){const d=riverInfluenceFixture(),c=withRiverInfluence({features:[]} as unknown as SeascapeCatalog,d);return riverInfluenceLayer(c,c.features[0]);}
describe("river influence factors",()=>{
 it("adds overlapping rivers without normalizing away attenuation and uses stable producer bounds",()=>{const l=layer();expect(riverInfluenceDatasetInfo(l)).toMatchObject({release:l.riverInfluence!.recipe.method,limitations:l.riverInfluence!.recipe.qualification,manifestSha256:l.field.sourceSha256});expect([...l.values.values()]).toEqual([2,1]);expect(l.range).toEqual([0,8]);const parts=l.riverInfluence!.contributions.get(l.cells[0].id)!;expect(parts.map(p=>p.value)).toEqual([1,1]);expect(parts.map(p=>p.share)).toEqual([.5,.5]);});
 it("changes distance and past-day lag scenarios independently",()=>{const d=riverInfluenceFixture(),c=withRiverInfluence({features:[]} as unknown as SeascapeCatalog,d);expect([...riverInfluenceLayer(c,c.features[0],{date:d.recipe.dates[3],distance:"local",lag:"now"}).values.values()]).toEqual([4,2]);expect([...riverInfluenceLayer(c,c.features[0],{date:d.recipe.dates[0],distance:"broad",lag:"later"}).values.values()]).toEqual([null,null]);});
 it("preserves unknown mapping and unknown active lag support while retaining observed zero",()=>{const d=riverInfluenceFixture();d.weights.skagit.broad[0]=null;d.distances.skagit[0]=null;d.daily.fraser.now.relative_flow[3]=0;const c=withRiverInfluence({features:[]} as unknown as SeascapeCatalog,d),l=riverInfluenceLayer(c,c.features[0]);expect(l.values.get(l.cells[0].id)).toBe(0);expect(l.qualifiers["Route coverage"][0]).toBe(.5);d.daily.skagit.now.relative_flow[3]=null;expect([...riverInfluenceLayer(c,c.features[0]).values.values()][1]).toBeNull();});
 it("validates the two-signal product and rejects malformed arrays or provider dates",()=>{const d=riverInfluenceFixture(),c=withRiverInfluence({features:[]} as unknown as SeascapeCatalog,d);expect(c.features.map(f=>f.column)).toEqual(["relative_flow","discharge"]);expect(decodeRiverInfluence(d,d.snapshot).recipe.retrospective).toBe(true);for(const change of [(x:typeof d)=>{x.weights.fraser.broad=[1];},(x:typeof d)=>{x.recipe.dates[1]="2026-10-12";},(x:typeof d)=>{x.daily.fraser.now.relative_flow[0]=Infinity;}]){const bad=structuredClone(d);change(bad);expect(()=>decodeRiverInfluence(bad,d.snapshot)).toThrow("Invalid river influence");}});
});

it("groups influence fields under Hydrology as a separate family while preserving gauge metadata",()=>{const base=withHydrology({features:[],datasets:{}} as unknown as SeascapeCatalog,hydrologyFixture()),merged=withRiverInfluence(base,riverInfluenceFixture());expect(merged.datasets?.hydrology).toBe(base.datasets?.hydrology);expect(merged.datasets?.["river-influence"]).toBeUndefined();expect(merged.features.filter(f=>f.family==="River influence")).toHaveLength(2);expect(merged.features.filter(f=>f.family==="River influence").every(f=>f.dataset==="hydrology")).toBe(true);expect(merged.features.some(f=>f.family==="Discharge")).toBe(true);});

it("omits retired pulse metrics and rejects requests for them",()=>{
 const d=riverInfluenceFixture(),c=withRiverInfluence({features:[]} as unknown as SeascapeCatalog,d);
 for(const metric of ["pulse_excess","contributing_rivers"]){
  expect(c.features.some(f=>f.column===metric)).toBe(false);
  expect(()=>riverInfluenceLayer(c,{...c.features[0],column:metric})).toThrow("Unknown river influence");
 }
 const bad=structuredClone(d);bad.recipe.signals.pulse_excess={name:"Retired",unit:"index"};
 expect(()=>decodeRiverInfluence(bad,bad.snapshot)).toThrow("Invalid river influence");
});
