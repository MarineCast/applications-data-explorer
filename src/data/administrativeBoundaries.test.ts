import {expect,it} from "vitest";
import {administrativeBoundaryFeatures,administrativeBoundariesFamily} from "./administrativeBoundaries";
import type {SeascapeFeature} from "./seascape";
it.each([6,8] as const)("retains all five administrative choices and adds both Tribal choices at R%s without changing saved identities",resolution=>{
 const columns=["county_regional_boundaries__recorded_feature_count","county_regional_boundaries__feature_memberships_v1","federal_waters__assignment__feature_memberships_v1","federal_waters__international_boundary","state_provincial_waters__assignment__feature_memberships_v1","tribal_first_nations_areas__mapped_area","tribal_first_nations_areas__feature_memberships_v1"];
 const fields=columns.map(column=>({id:`GOVERNANCE__${column}`,column,dataset:"governance",resolution,family:column.startsWith("tribal_")?"Tribal First Nations Areas":"Administrative Boundaries",name:column,range:[0,1],available:1,rows:1,role:"scientific_metric",sourceRelease:"Fixture",sourcePath:"fixture",sourceSha256:"fixture",modelingEligibility:"false",arrowType:"fixture",definition:"Source-backed distinct administrative/legal types",qualifiers:["source_status"],unit:"source unit",sourceContext:{bia:{country:"United States",agency:"BIA",boundary_type:"Land-area reference"},nrcan:{country:"Canada",agency:"NRCan",boundary_type:"Indian Reserve administrative geometry"}}} as SeascapeFeature));
 const before=fields.map(f=>({...f}));const result=administrativeBoundaryFeatures(fields);
 expect(result).toHaveLength(7);expect(new Set(result.map(f=>f.family))).toEqual(new Set([administrativeBoundariesFamily]));
 result.forEach((field,i)=>{expect(field).toEqual({...before[i],family:administrativeBoundariesFamily});expect(result.find(f=>f.id===before[i].id)).toBe(field);});
});
