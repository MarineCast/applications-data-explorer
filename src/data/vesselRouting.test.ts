import {expect,it} from "vitest";
import {vesselRoutingFeatures,vesselRoutingFamily,vesselRoutingRecorded,savedVesselRouting} from "./vesselRouting";
import type {SeascapeFeature} from "./seascape";
it.each([6,8])("keeps every identity binding and one boolean while hiding legacy measurements at R%s",resolution=>{
 const names=["shipping_lanes__noaa_recommended_route__feature_memberships_v1","traffic_separation_schemes__chs_scheme_boundary__feature_memberships_v1","speed_restriction_zones__feature_memberships_v1"];
 const fields=names.map(column=>({id:`GOVERNANCE__${column}`,column,membershipColumn:column,dataset:"governance",resolution,definition:"Original source role / exceptions",qualifiers:["count","status"],role:"recorded_feature_identity"} as SeascapeFeature));
 const before=structuredClone(fields);
 const bool={id:`GOVERNANCE__${vesselRoutingRecorded}`,column:vesselRoutingRecorded,dataset:"governance",resolution,definition:"Recommended and conditional reference presence; unknown is not false"} as SeascapeFeature;
 const old={id:"old",column:"shipping_lanes__noaa_recommended_route__recorded_feature_count",dataset:"governance",resolution} as SeascapeFeature;
 const other={id:"other",column:"exclusion_zones__recorded_feature_count",dataset:"governance",family:"Exclusion Zones"} as SeascapeFeature;
 const result=vesselRoutingFeatures([...fields,bool,old,other]);
 expect(result).toHaveLength(5);
 fields.forEach((f,i)=>expect(f).toEqual({...before[i],family:vesselRoutingFamily,...(f.column==="speed_restriction_zones__feature_memberships_v1"?{name:"Speed Restriction Zones"}:{})}));
 expect(result.filter(f=>f.role==="scientific_metric")).toEqual([bool]);
 expect(bool).toMatchObject({name:"Routing / regulation recorded",family:vesselRoutingFamily,kind:"categorical",categories:[false,true],unit:"boolean"});
 expect(other.family).toBe("Exclusion Zones");
 expect(savedVesselRouting(result,`GOVERNANCE__${old.column}`)).toBe(bool);
 expect(savedVesselRouting(result,`GOVERNANCE__dynamic__${old.column}`)).toBe(bool);
 expect(savedVesselRouting(result,fields[0].id)).toBeUndefined();
 expect(savedVesselRouting(result,"GOVERNANCE__exclusion_zones__recorded_feature_count")).toBeUndefined();
});


it.each([6,8])("groups every traffic scheme role with separation zones while preserving source bindings and saved aliases at R%s",resolution=>{
 const shipping="vessel_routing_regulations__shipping_lanes__feature_memberships_v1",zones="vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1";
 const columns=[shipping,zones,"speed_restriction_zones__feature_memberships_v1","shipping_lanes__chs_recommended_track__feature_memberships_v1","traffic_separation_schemes__chs_separation_zone__feature_memberships_v1","traffic_separation_schemes__noaa_separation_zone__feature_memberships_v1","traffic_separation_schemes__chs_scheme_boundary__feature_memberships_v1","traffic_separation_schemes__chs_lane_part__feature_memberships_v1","traffic_separation_schemes__chs_scheme_crossing__feature_memberships_v1","traffic_separation_schemes__chs_separation_line__feature_memberships_v1","traffic_separation_schemes__noaa_traffic_lane__feature_memberships_v1"];
 const features=columns.map(column=>({id:`GOVERNANCE__${column}`,column,membershipColumn:column,dataset:"governance",resolution,productId:`governance-r${resolution}`,qualifiers:["native-count","native-status"],definition:"Native roles and conditional/advisory details retained"} as SeascapeFeature));
 const result=vesselRoutingFeatures(features);
 expect(result.map(f=>f.column)).toEqual([zones,columns[2]]);
 expect(result.map(f=>f.name)).toEqual(["Shipping Lanes & Traffic Separation Zones","Speed Restriction Zones"]);
 expect(result.every(f=>f.qualifiers.join()==="native-count,native-status")).toBe(true);
 expect(savedVesselRouting(result,features[0].id)).toBe(result[0]);
 expect(savedVesselRouting(result,features[3].id)).toBe(result[0]);expect(savedVesselRouting(result,features[4].id)).toBe(result[0]);
 expect(savedVesselRouting(result,features[6].id)).toBe(result[0]);expect(savedVesselRouting(result,features[7].id)).toBe(result[0]);
 features.slice(3).forEach(f=>expect(savedVesselRouting(result,f.id)).toBe(result[0]));
 expect(savedVesselRouting(result,`GOVERNANCE__dynamic__${shipping}`)).toBe(result[0]);
});
