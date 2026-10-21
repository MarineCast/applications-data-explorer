import {expect,it} from "vitest";
import type {SeascapeFeature} from "./seascape";
import {exclusionZoneFeatures,savedExclusionZone,exclusionZoneCount,exclusionZoneAssignment} from "./exclusionZones";
const field=(column:string,resolution=6)=>({id:"GOVERNANCE__"+column,column,dataset:"governance",resolution,productId:`governance-r${resolution}`,definition:"Original source definition",unit:"count",qualifiers:[exclusionZoneCount+"_status"],membershipColumn:column===exclusionZoneAssignment?column:undefined}) as SeascapeFeature;
it.each([6,8])("offers exactly Count and Assignment without changing native values/bindings at R%s",resolution=>{
 const columns=[exclusionZoneCount,exclusionZoneAssignment,exclusionZoneCount+"_status","exclusion_zones__recorded_polygon_union_area_fraction","exclusion_zones__recorded_point_feature_count","exclusion_zones__recorded_line_union_length_m"];
 const all=columns.map(c=>field(c,resolution));const others={...field(exclusionZoneCount,resolution),dataset:"human"};
 const before=structuredClone(all.slice(0,2));const actual=exclusionZoneFeatures([...all,others]);
 expect(actual.map(f=>f.name).slice(0,2)).toEqual(["Exclusion Zone Count","Exclusion Zone Assignment"]);
 actual.slice(0,2).forEach((f,i)=>{for(const k of ["id","column","membershipColumn","qualifiers","definition","unit","productId"] as const)expect(f[k]).toEqual(before[i][k]);});
 expect(actual.at(-1)).toBe(others);
 for(const col of columns.slice(2))expect(savedExclusionZone(actual,"GOVERNANCE__"+col)?.column).toBe(exclusionZoneCount);
 expect(savedExclusionZone(actual,"GOVERNANCE__"+exclusionZoneAssignment)?.column).toBe(exclusionZoneAssignment);
 expect(savedExclusionZone(actual,"GOVERNANCE__ports__count")).toBeUndefined();
});


it("shows readable zone names throughout categorical views while preserving source records and overlaps", async () => {
 const { governanceMembershipLabel, governanceIdentityView } = await import("./governanceMemberships");
 const { decodeGovernanceMemberships } = await import("./governanceMemberships");
 const { default: fixture } = await import("./governanceMemberships.fixture.json");
 const payload = structuredClone(fixture);
 payload.dictionary[0].feature_id = "ca.dfo.closure:133";
 Object.assign(payload.dictionary[0].records[0], {source_dataset_id:"dfo_pacific_closure_references_20261019", feature_name:"Smith Sound", area_code:null, area_system_id:null});
 payload.dictionary[1].feature_id = "us.cfr33.165.1329:a1";
 Object.assign(payload.dictionary[1].records[0], {source_dataset_id:"uscg_theafoss_rna_20261015", feature_name:"Thea Foss sediment-cap RNA (a)(1); (b), (c)", area_code:null, area_system_id:null});
 const before = structuredClone(payload);
 const data = decodeGovernanceMemberships(payload, {rows:payload.rows,group:payload.group,column:payload.column,countColumn:payload.countColumn,statusColumn:payload.statusColumn});
 const view = governanceIdentityView(data, ["a","b","c","d"]);
 expect(view.categories).toEqual(["Smith Sound","Thea Foss Waterway Seabed Restriction Area 1","Multiple recorded features"]);
 expect(view.categoryKeys.slice(0,2)).toEqual(["feature:ca.dfo.closure:133","feature:us.cfr33.165.1329:a1"]);
 expect(view.categoryMemberships.get("a")).toEqual([0,1]);
 expect(data.counts).toEqual(fixture.counts);
 expect(payload).toEqual(before);
 expect(governanceMembershipLabel({...data.cells[0]![1],feature_id:"us.cfr33.165.1329:a2"})).toBe("Thea Foss Waterway Seabed Restriction Area 2");
 expect(governanceMembershipLabel({...data.cells[0]![1],feature_id:"us.cfr33.165.1309"})).toBe("Thea Foss sediment-cap Regulated Navigation Area (a)(1); (b), (c)");
});
