import { expect, it } from "vitest";
import { normalizeWaterCountry, waterAssignmentCode, waterAssignmentFeatures, waterAssignmentView, waterAssignmentColumn, waterFamilies, internationalBoundaryColumn } from "./waterAssignments";
import type { SeascapeFeature } from "./seascape";
import type { GovernanceRecord, GovernanceMembershipData } from "./governanceMemberships";
import fixture from "./governanceMemberships.fixture.json";
import { decodeGovernanceMemberships } from "./governanceMemberships";
const record=(region:string,jurisdiction:string,feature_type="state_water_polygon")=>({region,jurisdiction,feature_type}) as GovernanceRecord;
it("normalizes explicit country aliases, validates typed WA BC OR labels, rejects inconsistent countries and lines",()=>{
 for(const value of ["US","USA","United_States","United States of America"])expect(normalizeWaterCountry(value)).toBe("USA");
 for(const value of ["Canada","CAN","ca"])expect(normalizeWaterCountry(value)).toBe("CAN");
 expect(normalizeWaterCountry("International")).toBeUndefined();
 expect(waterAssignmentCode("state_provincial_waters",record("Washington","USA"))).toBe("WA");
 expect(waterAssignmentCode("state_provincial_waters",record("BRITISH_COLUMBIA","Canada","provincial_water_polygon"))).toBe("BC");
 expect(waterAssignmentCode("state_provincial_waters",record("Oregon","US"))).toBe("OR");
 expect(waterAssignmentCode("state_provincial_waters",record("BC","USA"))).toBeUndefined();
 expect(waterAssignmentCode("state_provincial_waters",record("WA","USA","state_seaward_boundary_line"))).toBeUndefined();
 expect(waterAssignmentCode("federal_waters",record("","USA","exclusive_economic_zone_limit"))).toBeUndefined();
 expect(waterAssignmentCode("federal_waters",record("","International","high_seas_polygon"))).toBe("INT");
});
it("keeps one state assignment and two federal choices, hides the separate international family while other families remain available",()=>{
 const fields=[6,8].flatMap(resolution=>Object.keys(waterFamilies).flatMap(family=>[waterAssignmentColumn(family as keyof typeof waterFamilies),...(family==="federal_waters"?[internationalBoundaryColumn]:[]),family+"__feature_memberships_v1",family+"__recorded_feature_count",family+"__recorded_line_union_length_m_status"].map(column=>({id:"GOVERNANCE__"+column,column,dataset:"governance",resolution}) as SeascapeFeature)));
 const other={id:"other",dataset:"governance",column:"wildlife_refuges__recorded_feature_count"} as SeascapeFeature;
 const result=waterAssignmentFeatures([...fields,{column:"international_boundaries__feature_memberships_v1",dataset:"governance"} as SeascapeFeature,other]);expect(result).toHaveLength(7);expect(result.at(-1)).toBe(other);
 expect(result.slice(0,6).map(f=>f.name)).toEqual(["State / Province Assignment","Country Assignment","International Boundary","State / Province Assignment","Country Assignment","International Boundary"]);
});
it("retains all crossing assignments, categorical legend, unknown and verified no assignment separately",()=>{
 const original=decodeGovernanceMemberships(fixture,fixture);
 const members=[record("WA","USA"),record("BC","CAN","provincial_water_polygon"),record("OR","USA")].map((r,i)=>({...original.cells[0]![0],feature_id:`source:${i}`,records:[{...original.cells[0]![0].records[0],...r}]}));
 const data={...original,cells:[members,null,[],[members[0]]],counts:[3,null,0,1],statuses:["partial","unknown","observed","partial"]} as GovernanceMembershipData;
 const view=waterAssignmentView(data,["a","b","c","d"],"state_provincial_waters");
 expect(view.categories).toEqual(["Washington","British Columbia","Oregon","Multiple water assignments"]);
 expect(view.categoryMemberships.get("a")).toEqual([0,1,2]);expect(view.values.get("a")).toBe(3);
 expect(view.categoryMemberships.get("b")).toBeNull();expect(view.categoryMemberships.get("c")).toEqual([]);
 expect(data.cells[0]).toEqual(members);
 expect(view.legend.support.map(s=>s.cells)).toEqual([1,1]);
 const federal=waterAssignmentView({...data,cells:[null,null,null,null],counts:[null,null,null,null]},["a","b","c","d"],"federal_waters");
 expect(federal.categories).toEqual(["United States","Canada","International"]);
 expect([...federal.values.values()]).toEqual([null,null,null,null]);expect(federal.legend.support[0].cells).toBe(4);
});

it("keeps every supported US, Canada and International crossing membership without a dominant country",()=>{
 const original=decodeGovernanceMemberships(fixture,fixture);
 const members=[record("","US","federal_administrative_water_polygon"),record("","Canada","federal_administrative_water_polygon"),record("","International","high_seas_polygon")].map((r,i)=>({...original.cells[0]![0],feature_id:`country:${i}`,records:[{...original.cells[0]![0].records[0],...r}]}));
 const data={...original,rows:3,cells:[members,null,[]],counts:[3,null,0],statuses:["partial","unavailable","observed"]} as GovernanceMembershipData;
 const view=waterAssignmentView(data,["crossing","unknown","empty"],"federal_waters");
 expect(view.categoryMemberships.get("crossing")).toEqual([0,1,2]);expect(view.categoryMemberships.get("unknown")).toBeNull();expect(view.categoryMemberships.get("empty")).toEqual([]);
 expect(data.cells[0]).toEqual(members);
});

it("supports explicitly geographic country/state/province polygons while retaining nulls and all categories",()=>{
 expect(waterAssignmentCode("state_provincial_waters",record("WA","USA","geographic_state_water_polygon"))).toBe("WA");
 expect(waterAssignmentCode("state_provincial_waters",record("BC","CAN","geographic_province_water_polygon"))).toBe("BC");
 expect(waterAssignmentCode("federal_waters",record("","CAN","geographic_country_water_polygon"))).toBe("CAN");
 expect(waterAssignmentCode("federal_waters",record("","USA","geographic_country_water_polygon"))).toBe("USA");
 expect(waterAssignmentCode("federal_waters",record("","International","geographic_country_water_polygon"))).toBeUndefined();
});
