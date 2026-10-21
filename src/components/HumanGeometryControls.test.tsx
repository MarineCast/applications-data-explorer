import {useState} from "react";
import {render,screen,cleanup} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,expect,it} from "vitest";
import {HumanGeometryInspector,HumanGeometryLegend} from "./HumanGeometryControls";
import {decodeHumanGeometry,defaultHumanFilter} from "../data/humanGeometry";
import type {HumanFeature} from "../data/humanGeometry";
afterEach(cleanup);
const point:HumanFeature={type:"Feature",id:"park-1",geometry:{type:"Point",coordinates:[-123,48]},properties:{record_id:"park-1",group:"places",role:"record",name:"Synthetic Park",category:"park",location_method:"marine_facing_representative_point_not_entrance",label_point:[-123,48],h3_index:"reference",attributes:{source:"Synthetic fixture",source_id:"park-1",opening_hours:null,access:null}}};
const area:HumanFeature={...point,id:"area",properties:{...point.properties,role:"source_footprint"},geometry:{type:"Polygon",coordinates:[[[-123,48],[-123,48.1],[-123.1,48],[-123,48]]]}};
it("shows source name, missing attributes, representative-point meaning",()=>{
 render(<HumanGeometryInspector feature={point}/>);
 expect(screen.getByRole("heading",{name:"Synthetic Park"})).toBeInTheDocument();expect(screen.queryByText("Access evidence")).not.toBeInTheDocument();
 expect(screen.getByText(/not a surveyed entrance/)).toBeInTheDocument();expect(screen.getAllByText("Unknown / not supplied")).toHaveLength(2);
 expect(screen.getByText("Synthetic fixture")).toBeInTheDocument();
});

it("shows original park-area repair qualifications and checksum evidence",()=>{
 const footprint={...area,properties:{...area.properties,source_geometry_valid:false,source_geometry_wkb_sha256:"original-geometry-checksum",location_method:"source_polygon_make_valid_for_display_not_access_boundary"}};
 render(<HumanGeometryInspector feature={point} footprints={[footprint]}/>);
 expect(screen.getByText(/Source polygon repaired for display/)).toBeInTheDocument();
 expect(screen.getByText("original-geometry-checksum")).toBeInTheDocument();
 expect(screen.getByText("false")).toBeInTheDocument();
});

it.each(["places","launches","shore_access","access_lines"] as const)("toggles %s categories directly by icon and keyboard",async(group)=>{
 const record={...point,properties:{...point.properties,group}};
 const data=decodeHumanGeometry({type:"FeatureCollection",schema:"human.native_features.v1",features:[record]},group,1);
 function Harness(){const [filter,onChange]=useState(defaultHumanFilter);return <HumanGeometryLegend name="Locations" view={{data,filter,opacity:.8,onSelect:()=>{},onBackground:()=>{}}} onFilterChange={onChange} onOpacity={()=>{}}/>;}
 const user=userEvent.setup();render(<Harness/>);
 const item=screen.getByRole("button",{name:"Parks"});
 expect(item).toHaveAttribute("aria-pressed","true");
 await user.click(item.querySelector("i")!);
 expect(item).toHaveAttribute("aria-pressed","false");
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 item.focus();await user.keyboard("{Enter}");
 expect(item).toHaveAttribute("aria-pressed","true");
 expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
 expect(screen.queryByText(/matching source records|Access evidence|Colors identify/)).not.toBeInTheDocument();
});

it.each(["places","launches","shore_access","access_lines"])("isolates and restores %s legend categories",async(group)=>{
 const records=[point,{...point,id:"beach",properties:{...point.properties,record_id:"beach",category:"beach"}}].map(record=>({...record,properties:{...record.properties,group}}));
 const data=decodeHumanGeometry({type:"FeatureCollection",schema:"human.native_features.v1",features:records},group,2);
 function Host(){const [filter,setFilter]=useState(defaultHumanFilter);return <HumanGeometryLegend name="Locations" view={{data,filter,opacity:.8,onSelect:()=>{},onBackground:()=>{}}} onFilterChange={setFilter} onOpacity={()=>{}}/>;}
 const user=userEvent.setup();render(<Host/>);
 await user.dblClick(screen.getByRole("button",{name:"Parks"}));
 expect(screen.getByRole("button",{name:"Parks"})).toHaveAttribute("aria-pressed","true");expect(screen.getByRole("button",{name:"Beaches"})).toHaveAttribute("aria-pressed","false");
 await user.dblClick(screen.getByRole("button",{name:"Parks"}));
 expect(screen.getByRole("button",{name:"Beaches"})).toHaveAttribute("aria-pressed","true");
});

it("shows original NGA port attributes and a bounded source-code popup",async()=>{
 const {HumanGeometryPopup}=await import("./HumanGeometryControls");
 const port={...point,properties:{...point.properties,category:"port",group:"ports",name:"Aberdeen",location_method:"original_nga_physical_port_point",attributes:{PORT_ID:"nga_wpi:17060",harborType:"RN",maxVesselDraft:null}}};
 render(<HumanGeometryPopup feature={port} onClose={()=>{}}/>);
 expect(screen.getByText("Ports")).toBeInTheDocument();
 expect(screen.getByText(/Original NGA World Port Index point/)).toBeInTheDocument();
 expect(screen.getByText("nga_wpi:17060")).toBeInTheDocument();
 expect(screen.getByText("RN")).toBeInTheDocument();
 expect(screen.getByText("Unknown / not supplied")).toBeInTheDocument();
});
