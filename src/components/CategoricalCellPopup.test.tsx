import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import CategoricalCellPopup from "./CategoricalCellPopup";
import fixture from "../data/governanceMemberships.fixture.json";
import { decodeGovernanceMemberships } from "../data/governanceMemberships";
import type { SeascapeLayer } from "../data/seascape";
const data=decodeGovernanceMemberships(fixture,fixture);
const cell={id:"cell",lat:48,lon:-123,boundary:[],zone:"north" as const};
const layer={name:"Tribal / First Nations Assignment",resolution:6,index:new Map([[cell.id,0]]),field:{membershipColumn:fixture.column,sourceContext:{dfo:{country:"Canada",agency:"DFO",boundary_type:"Administrative reference"}}},governanceMemberships:data} as unknown as SeascapeLayer;
it("shows every paired area/name/source ID and available provenance for an overlapping cell",async()=>{
 const close=vi.fn();render(<CategoricalCellPopup layer={layer} cell={cell} onClose={close}/>);
 const card=screen.getByRole("dialog",{name:"Cell information"});
 for(const text of ["cell","R6","Tribal / First Nations Assignment","dfo:21-0","wdfw:7","zero","19","San Juan Islands","Canada","Administrative reference"])expect(card).toHaveTextContent(text);
 expect(card).toHaveTextContent("2 recorded areas");
 await userEvent.setup().click(screen.getByRole("button",{name:"Close cell information"}));expect(close).toHaveBeenCalledOnce();
});
it("keeps unknown, verified empty and raw boolean false distinct",()=>{
 const view=render(<CategoricalCellPopup layer={{...layer,index:new Map([[cell.id,1]])}} cell={cell} onClose={vi.fn()}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent("Unknown membership support");
 view.rerender(<CategoricalCellPopup layer={{...layer,index:new Map([[cell.id,2]]),field:{...layer.field,membershipColumn:undefined},rawValues:new Map([[cell.id,false]])}} cell={cell} onClose={vi.fn()}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent("No recorded areas under verified empty support");
 expect(screen.getByRole("dialog")).toHaveTextContent("false");
 expect(screen.getByRole("dialog")).not.toHaveTextContent("Unknown membership support");
});
it("renders source labels as inert text and closes with Escape",async()=>{
 const member=data.cells[0]![0];const hostile={...member,records:member.records.map(r=>({...r,feature_name:"<img src=x onerror=alert(1)>"}))};
 const close=vi.fn();const view=render(<CategoricalCellPopup layer={{...layer,governanceMemberships:{...data,cells:[[hostile],null,[],data.cells[3]]}}} cell={cell} onClose={close}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent("<img src=x onerror=alert(1)>");expect(view.container.querySelector("img")).toBeNull();
 screen.getByLabelText("Cell details").focus();await userEvent.setup().keyboard("{Escape}");expect(close).toHaveBeenCalledOnce();
});

it.each(["State / Province Assignment","Country Assignment"])("shows %s source gap on a null categorical cell without inventing a category",(name)=>{
 render(<CategoricalCellPopup layer={{...layer,name,index:new Map([[cell.id,1]]),field:{...layer.field,supportLimitation:"No qualified water polygons; line support cannot assign interiors."}}} cell={cell} onClose={vi.fn()}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent(name);expect(screen.getByRole("dialog")).toHaveTextContent("No qualified water polygons");expect(screen.getByRole("dialog")).toHaveTextContent("Unknown membership support");expect(screen.getByRole("dialog")).not.toHaveTextContent("Assignment: International");
});

it("shows geographic labels and actual country without converting category zero or unknown into None",()=>{
 const member=data.cells[0]![0];const geographicMember={...member,records:member.records.map(r=>({...r,jurisdiction:"CAN",region:"BC",feature_type:"geographic_province_water_polygon"}))};
 const geographicLayer={...layer,name:"State / Province Assignment",field:{...layer.field,assignmentSemantics:"geographic" as const},governanceMemberships:{...data,cells:[[geographicMember],null,[],data.cells[3]]},rawValues:new Map([[cell.id,"British Columbia"]])};
 const view=render(<CategoricalCellPopup layer={geographicLayer} cell={cell} onClose={vi.fn()}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent("Assignment: British Columbia");expect(screen.getByRole("dialog")).toHaveTextContent("Canada");
 view.rerender(<CategoricalCellPopup layer={{...geographicLayer,index:new Map([[cell.id,1]]),rawValues:new Map([[cell.id,null]])}} cell={cell} onClose={vi.fn()}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent("unresolved, not zero or International");expect(screen.getByRole("dialog")).not.toHaveTextContent("Assignment:");
});

it("shows boundary boolean, all border names and source IDs, and separates false from unknown",()=>{
 const boundary={...layer,name:"International Boundary",field:{...layer.field,column:"federal_waters__international_boundary",membershipColumn:undefined,supportLimitation:"No-hit cells remain unknown under partial source support."},rawValues:new Map([[cell.id,true]])};
 const view=render(<CategoricalCellPopup layer={boundary} cell={cell} onClose={vi.fn()}/>);
 for(const text of ["true","2 recorded boundaries","Boundary ID","dfo:21-0","wdfw:7","San Juan Islands"])expect(screen.getByRole("dialog")).toHaveTextContent(text);
 view.rerender(<CategoricalCellPopup layer={{...boundary,index:new Map([[cell.id,1]]),rawValues:new Map([[cell.id,null]])}} cell={cell} onClose={vi.fn()}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent("Unknown boundary support");
 view.rerender(<CategoricalCellPopup layer={{...boundary,index:new Map([[cell.id,2]]),rawValues:new Map([[cell.id,false]])}} cell={cell} onClose={vi.fn()}/>);
 expect(screen.getByRole("dialog")).toHaveTextContent("false");expect(screen.getByRole("dialog")).toHaveTextContent("No mapped international boundary under verified complete geographic support");
});


it("visibly distinguishes proposed and interim reference entries from designated totals",()=>{
 const members=["proposed","interim"].map(status=>({...data.cells[0]![0],feature_id:`conservation_reference:${status}:cpcad_parent:714320000`}));
 render(<CategoricalCellPopup layer={{...layer,name:"Marine Conservation Area Assignment",field:{...layer.field,assignmentSemantics:"conservation_status"},governanceMemberships:{...data,cells:[members,null,[],data.cells[3]]}}} cell={cell} onClose={vi.fn()}/>);
 const card=screen.getByRole("dialog");
 for(const text of ["Proposed","Interim","2 recorded assignment entries","excluded from Marine Conservation Area Count and Coverage"])
  expect(card).toHaveTextContent(text);
});


it("keeps every native source identity and advisory/conditional role in a grouped shipping popup",()=>{
 const members=data.cells[0]!.map((m,i)=>({...m,records:m.records.map(r=>({...r,feature_name:i?"US recommended route":"Canadian navigation line",jurisdiction:i?"United States":"Canada"}))}));
 const context=Object.fromEntries(members.flatMap((m,i)=>m.records.map(r=>[r.source_feature_id,{routing_role:i?"noaa_recommended_route":"chs_navigation_line",source_role_description:i?"Recommended / advisory route reference":"Navigation reference; no mandatory status inferred",activation_condition:"Conditional applicability remains unknown"}])));
 render(<CategoricalCellPopup layer={{...layer,name:"Shipping Lanes",field:{...layer.field,membershipColumn:"vessel_routing_regulations__shipping_lanes__feature_memberships_v1",sourceRecordContext:context},governanceMemberships:{...data,cells:[members,null,[],data.cells[3]]}}} cell={cell} onClose={vi.fn()}/>);
 const card=screen.getByRole("dialog");
 for(const text of ["Shipping Lanes","2 recorded areas","dfo:21-0","wdfw:7","Canadian navigation line","US recommended route","Canada","United States","noaa_recommended_route","chs_navigation_line","Recommended / advisory","Conditional applicability remains unknown"])expect(card).toHaveTextContent(text);
});


it("retains boundary, crossing, line, lane and zone types inside Traffic Separation Zones",()=>{
 const roles=["chs_scheme_boundary","chs_scheme_crossing","chs_separation_line","chs_lane_part","chs_separation_zone","noaa_traffic_lane","noaa_separation_zone"];
 const members=roles.map((role,i)=>({...data.cells[0]![0],feature_id:`fixture:${role}`,records:data.cells[0]![0].records.slice(0,1).map(r=>({...r,source_feature_id:`fixture:${role}`,feature_name:`Native ${role}`,jurisdiction:i<5?"Canada":"United States"}))}));
 const context=Object.fromEntries(roles.map(role=>[`fixture:${role}`,{routing_role:role,source_object_type:role,legal_applicability:"Reference roles retain their original meanings; current applicability unqualified"}]));
 render(<CategoricalCellPopup layer={{...layer,name:"Traffic Separation Zones",field:{...layer.field,membershipColumn:"vessel_routing_regulations__traffic_separation_zones__feature_memberships_v1",sourceRecordContext:context},governanceMemberships:{...data,cells:[members,null,[],data.cells[3]]}}} cell={cell} onClose={vi.fn()}/>);
 const card=screen.getByRole("dialog");
 for(const text of ["Traffic Separation Zones","7 recorded areas","Canada","United States","current applicability unqualified",...roles.map(role=>`fixture:${role}`)])expect(card).toHaveTextContent(text);
});
