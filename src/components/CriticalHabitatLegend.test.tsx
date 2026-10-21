import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import MapLegend from "./MapLegend";
import {createCategoryScale,createColorScale} from "../data/colorScale";
import {criticalHabitatAssignment,criticalHabitatCount,criticalHabitatCoverageNote} from "../data/criticalHabitat";
import type {MapLayer} from "../data/map";

const props={opacity:.8,onPalette:vi.fn(),onScaleMode:vi.fn(),onOpacity:vi.fn()};
const values=new Map<string,number|null>([["hit",1],["unknown",null],["empty",0]]);
const base:MapLayer={id:"GOVERNANCE__"+criticalHabitatCount,name:"Critical Habitat Count",unit:"count",resolution:8,range:[0,1],cells:[],values,sourceLabel:"local"};

it("shows unknown habitat support even when categorical cell counts are not requested",()=>{
 const layer:MapLayer={...base,id:"GOVERNANCE__"+criticalHabitatAssignment,name:"Critical Habitat Assignment",categories:["Marbled Murrelet [Sidney]"],categoryKeys:["eccc:21712"],categoryMemberships:new Map([["hit",[0]],["unknown",null],["empty",[]]])};
 render(<MapLegend {...props} layer={layer} scale={createCategoryScale(layer.values,layer.categories!,"ocean")}/>);
 expect(screen.getByText("Unknown habitat coverage · 1 cell")).toBeVisible();
 expect(screen.getByText(criticalHabitatCoverageNote)).toBeVisible();
 expect(screen.getByRole("button",{name:"Marbled Murrelet [Sidney]"})).toBeVisible();
});

it("labels numeric count missingness as unknown and keeps a recorded zero numeric",()=>{
 render(<MapLegend {...props} layer={base} scale={createColorScale(values,"ocean","minmax")}/>);
 expect(screen.getByText("Unknown habitat coverage")).toBeVisible();
 expect(screen.getByText(criticalHabitatCoverageNote)).toBeVisible();
 expect(screen.getByRole("img",{name:/0 to 1 count/})).toBeVisible();
});

it("preserves other families' caller-supplied coverage labels",()=>{
 const layer={...base,id:"GOVERNANCE__vessel_routing__recorded",name:"Vessel Routing / Regulation Recorded"};
 render(<MapLegend {...props} layer={layer} scale={createColorScale(values,"ocean","minmax")} missingLabel="Unknown routing / regulation coverage"/>);
 expect(screen.getByText("Unknown routing / regulation coverage")).toBeVisible();
 expect(screen.queryByText(criticalHabitatCoverageNote)).not.toBeInTheDocument();
});
