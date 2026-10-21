import { expect, it } from "vitest";
import { savedPortFeature, humanPortFeatures } from "./humanPorts";
import type { SeascapeFeature } from "./seascape";
const port = {id:"HUMAN_NATIVE__ports",dataset:"human",geometryGroup:"ports",resolution:7} as SeascapeFeature;
it.each(["recorded_feature_count","feature_memberships_v1","recorded_point_feature_count","recorded_polygon_union_area_fraction"])("moves a saved Governance %s choice to native Human points", suffix=>{
 const old={id:`GOVERNANCE__ports__${suffix}`,dataset:"governance",resolution:6} as SeascapeFeature;
 expect(savedPortFeature([old,port],old.id)).toBe(port);
 expect(savedPortFeature([old],old.id)).toBeUndefined();
 expect(humanPortFeatures([old,port])).toEqual([port]);
 expect(port.resolution).toBe(7);
});
it("preserves unrelated choices and waits for the verified Human replacement",()=>{
 const other={id:"GOVERNANCE__management_areas__recorded_feature_count",dataset:"governance"} as SeascapeFeature;
 expect(humanPortFeatures([other])).toEqual([other]);
 expect(savedPortFeature([other,port],other.id)).toBeUndefined();
});
