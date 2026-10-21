import { expect, it } from "vitest";
import { savedWaterAssignment } from "../data/waterAssignments";
import type { SeascapeCatalog,SeascapeFeature } from "../data/seascape";
import { waterFamilies,waterAssignmentColumn } from "../data/waterAssignments";
it("restores every old diagnostic, source membership and status to the single water assignment at its native resolution",()=>{
 const fields=Object.keys(waterFamilies).flatMap(family=>[6,8].map(resolution=>({id:"GOVERNANCE__"+waterAssignmentColumn(family as keyof typeof waterFamilies),column:waterAssignmentColumn(family as keyof typeof waterFamilies),dataset:"governance",resolution,available:0,kind:"categorical",name:family}) as SeascapeFeature));
 const catalog={features:fields} as SeascapeCatalog;
 for(const family of Object.keys(waterFamilies))for(const resolution of [6,8] as const)for(const suffix of ["recorded_feature_count","recorded_line_union_length_m","feature_memberships_v1","recorded_polygon_union_area_fraction_status"]) {
  const selected=savedWaterAssignment(catalog.features.filter(f=>f.resolution===resolution),"GOVERNANCE__"+family+"__"+suffix);
  expect(selected?.column).toBe(waterAssignmentColumn(family as keyof typeof waterFamilies));expect(selected?.resolution).toBe(resolution);
 }
});

it("restores saved International Boundaries selections to the new Federal boundary feature at the same resolution",()=>{
 for(const resolution of [6,8]){
  const column="federal_waters__international_boundary";const boundary={column,resolution,dataset:"governance"} as SeascapeFeature;
  for(const prefix of ["GOVERNANCE__","GOVERNANCE__dynamic__"])for(const suffix of ["feature_memberships_v1","recorded_line_union_length_m_status","recorded_feature_count"]){
   expect(savedWaterAssignment([boundary],prefix+"international_boundaries__"+suffix)).toBe(boundary);
  }
 }
});
