import {expect,it} from "vitest";
import {filterCategoryLayer} from "./categoryVisibility";
import {membershipStyles} from "./governancePatterns";
import {createCategoryScale} from "./colorScale";
import type {MapLayer} from "./map";
const cells=["a","b","unknown","empty"].map(id=>({id,lat:48,lon:-123,boundary:[],zone:"north"})) as MapLayer["cells"];
const layer:MapLayer={id:"test",name:"Test",unit:"category",resolution:6,range:[0,2],cells,values:new Map([["a",0],["b",1],["unknown",null],["empty",null]]),categories:["One","Two","Mixed"],categoryKeys:["one","two","multiple-memberships"],sourceLabel:"fixture"};
it("hides categorical cells without turning them into missing values or changing source data",()=>{
 const filtered=filterCategoryLayer(layer,["one"])!;
 expect(filtered.cells.map(c=>c.id)).toEqual(["b","unknown","empty"]);
 expect(filtered.values.get("a")).toBe(0);expect(layer.cells).toHaveLength(4);
 expect(filterCategoryLayer(layer,[])).toBe(layer);
 expect(filterCategoryLayer(layer,["one","two"])!.cells.map(c=>c.id)).toEqual(["unknown","empty"]);
});
it("removes hidden memberships from overlap stripes, retains unknown/empty support and stable indices",()=>{
 const source={...layer,categoryMemberships:new Map<string,readonly number[]|null>([["a",[0,1]],["b",[0]],["unknown",null],["empty",[]]])};
 const filtered=filterCategoryLayer(source,["one"])!;
 expect(filtered.cells.map(c=>c.id)).toEqual(["a","unknown","empty"]);
 expect(filtered.categoryMemberships.get("a")).toEqual([1]);expect(filtered.values.get("a")).toBe(1);
 expect(source.categoryMemberships.get("a")).toEqual([0,1]);
 const patterns=membershipStyles(filtered,createCategoryScale(source.values,source.categories!,"ocean"))!;
 expect(patterns.cells.has("a")).toBe(false);expect(patterns.cells.get("unknown")).toBe("membership-unknown");expect(patterns.cells.get("empty")).toBe("membership-empty");
 expect(filterCategoryLayer(source,["one","two"])!.cells.map(c=>c.id)).toEqual(["unknown","empty"]);
});
