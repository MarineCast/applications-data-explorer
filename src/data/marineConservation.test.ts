import { expect, it } from "vitest";
import type { SeascapeFeature } from "./seascape";
import { marineConservationFeatures, savedConservation, conservationNames, conservationAssignment, conservationCount, conservationCoverage, conservationReference, isPercentCoverage } from "./marineConservation";
import { governanceMembershipLabel } from "./governanceMemberships";
import fixture from "./governanceMemberships.fixture.json";
const field = (column: string, resolution = 6) => ({ dataset:"governance", id:`GOVERNANCE__${column}`, column, productId:`governance-r${resolution}`, resolution,
  name:"Old", family:"Old", membershipColumn:column.endsWith("__feature_memberships_v1")?column:undefined } as SeascapeFeature);
it.each([6,8])("offers exactly three core metrics and a separate proposed/interim reference at R%s", resolution => {
  const other=field("management_areas__recorded_feature_count",resolution);
  const fields=marineConservationFeatures([...Object.keys(conservationNames).map(c=>field(c,resolution)),field(conservationReference,resolution),field(conservationCount+"_status",resolution),
    field("wildlife_refuges__feature_memberships_v1",resolution),field("marine_protected_areas__recorded_feature_count",resolution),other]);
  expect(fields.filter(f=>f.family==="Marine Conservation Areas").map(f=>f.name)).toEqual(Object.values(conservationNames));
  expect(fields.find(f=>f.column===conservationReference)?.family).toBe("Proposed / Interim Conservation References");
  expect(fields.at(-1)).toBe(other);
});
it("keeps old catalog choices until producer unification is available",()=>{
  const legacy=field("wildlife_refuges__recorded_feature_count");
  expect(marineConservationFeatures([legacy])).toEqual([legacy]);
  expect(savedConservation([legacy],legacy.id)).toBeUndefined();
});
it.each([
  ["marine_protected_areas__feature_memberships_v1",conservationAssignment],
  ["national_marine_sanctuaries__recorded_polygon_union_area_fraction",conservationCoverage],
  ["wildlife_refuges__recorded_feature_count",conservationCount],
  ["conservation_designations__reported_interim_pa__feature_memberships_v1",conservationReference],
  ["marine_protected_areas__recorded_point_feature_count",conservationReference],
  ["conservation_designations__reported_oecm_designated__recorded_feature_count",conservationCount],
])("migrates saved %s to its corresponding unified feature",(prior,target)=>{
  const features=[...Object.keys(conservationNames),conservationReference].map(c=>field(c,8));
  expect(savedConservation(features,`GOVERNANCE__${prior}`)?.column).toBe(target);
  expect(savedConservation(features,"GOVERNANCE__ports__recorded_feature_count")).toBeUndefined();
});
it("identifies fractional coverage for percent display without converting counts",()=>{
  expect(isPercentCoverage(field(conservationCoverage))).toBe(true);
  expect(isPercentCoverage(field(conservationCount))).toBe(false);
});
it("uses the marine site name while retaining distinct source records",()=>{
  const record=fixture.dictionary[0].records[0];
  const member={feature_id:"noaa_mpa_site:NMS13",records:[{...record,source_dataset_id:"fws",feature_name:"Alternate name"},{...record,source_dataset_id:"noaa_mpa_inventory_2023",feature_name:"Olympic Coast National Marine Sanctuary"}]};
  expect(governanceMembershipLabel(member)).toBe("Olympic Coast National Marine Sanctuary");
  expect(member.records).toHaveLength(2);
});


it.each([6,8])("offers exactly three choices with proposed/interim included only in Assignment at R%s", resolution=>{
 const combined=field("marine_conservation_assignment__feature_memberships_v1",resolution);
 const features=marineConservationFeatures([...Object.keys(conservationNames).map(c=>field(c,resolution)),field(conservationReference,resolution),combined,field("marine_conservation_assignment__recorded_feature_count",resolution)]);
 expect(features.map(f=>f.name).sort()).toEqual(Object.values(conservationNames).sort());
 expect(combined.id).toBe("GOVERNANCE__"+conservationAssignment);
 expect(combined.membershipColumn).toBe("marine_conservation_assignment__feature_memberships_v1");
 expect(combined.assignmentSemantics).toBe("conservation_status");
 for(const prior of [conservationReference,"conservation_designations__reported_interim_pa__feature_memberships_v1",conservationAssignment,"marine_protected_areas__recorded_point_feature_count"])
   expect(savedConservation(features,"GOVERNANCE__"+prior)).toBe(combined);
 expect(savedConservation(features,"GOVERNANCE__"+conservationCount)?.column).toBe(conservationCount);
 expect(savedConservation(features,"GOVERNANCE__"+conservationCoverage)?.column).toBe(conservationCoverage);
});
it("labels status-qualified references without changing original names or source/site records",()=>{
 const record=fixture.dictionary[0].records[0];
 for(const status of ["proposed","interim"]){
  const member={feature_id:`conservation_reference:${status}:cpcad_parent:714320000`,records:[{...record,feature_name:"Gulf Islands National Park Reserve Of Canada"}]};
  expect(governanceMembershipLabel(member)).toBe(`${status[0].toUpperCase()+status.slice(1)}: Gulf Islands National Park Reserve Of Canada`);
  expect(member.records[0].feature_name).toBe("Gulf Islands National Park Reserve Of Canada");
 }
});
