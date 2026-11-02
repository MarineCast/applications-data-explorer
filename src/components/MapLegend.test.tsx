import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import MapLegend from "./MapLegend";
import { createColorScale, createCategoryScale, missingColor } from "../data/colorScale";
import type { MapLayer } from "../data/map";
const layer: MapLayer = {
  id: "depth",
  name: "Depth",
  unit: "m",
  resolution: 6,
  range: [0, 10],
  cells: [],
  values: new Map(),
  sourceLabel: "local",
};
it("preserves null and constant legend colors and dismisses settings outside the card", async () => {
  const values = new Map<string, number | null>([["a", null]]);
  const props = {
    layer,
    opacity: 0.8,
    onPalette: vi.fn(),
    onScaleMode: vi.fn(),
    onOpacity: vi.fn(),
  };
  const view = render(
    <MapLegend
      {...props}
      scale={createColorScale(values, "ocean", "minmax")}
    />,
  );
  const empty = screen.getByRole("img", { name: "No non-null values" });
  expect(empty).not.toHaveClass("continuous");
  expect(empty.children[0]).toHaveStyle({ background: missingColor });
  values.set("a", 0);
  const scale = createColorScale(values, "ocean", "minmax");
  view.rerender(<MapLegend {...props} scale={scale} />);
  const constant = screen.getByRole("img", { name: /Ten color classes/ });
  expect(constant).not.toHaveClass("continuous");
  for (const span of constant.children)
    expect(span).toHaveStyle({ background: scale.colors[5] });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Color options" }));
  const settings = screen.getByRole("dialog", { name: "Map color options" });
  expect(settings).toHaveTextContent("Constant value");
  await user.click(within(settings).getByRole("radio", { name: "Viridis" }));
  expect(props.onPalette).toHaveBeenCalledWith("viridis");
  expect(settings).toBeInTheDocument();
  expect(within(settings).getByRole("combobox", { name: "Coloring method" })).not.toBeVisible();
  expect(within(settings).getByRole("slider", { name: "Layer opacity" })).not.toBeVisible();
  await user.click(within(settings).getByText("Advanced", { exact: true }));
  expect(within(settings).getByRole("slider", { name: "Layer opacity" })).toBeVisible();
  await user.selectOptions(within(settings).getByRole("combobox", { name: "Coloring method" }), "quantile");
  expect(props.onScaleMode).toHaveBeenCalledWith("quantile");
  await user.click(screen.getByRole("button", { name: "Close color options" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Color options" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Color options" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Color options" }));
  await user.click(document.body);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("offers a live smooth-display toggle, radius and contours while preserving categorical source labels", async () => {
  function Host({ categorical = false }: { categorical?: boolean }) {
    const [smoothing, setSmoothing] = useState({ enabled: false, radius: 0.75, contours: true });
    return <MapLegend layer={{ ...layer, categories: categorical ? ["ridge"] : undefined }}
      scale={categorical ? createCategoryScale(new Map([["a", 0]]), ["ridge"], "ocean") : createColorScale(new Map([["a", 0], ["b", 100]]), "ocean", "equal")}
      opacity={0.8} onPalette={() => {}} onScaleMode={() => {}} onOpacity={() => {}}
      outlines onOutlines={() => {}} smoothing={smoothing} onSmoothing={setSmoothing} />;
  }
  const view = render(<Host />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Color options" }));
  expect(screen.getByRole("switch", { name: "Smooth surface" })).not.toBeVisible();
  expect(screen.getByRole("checkbox", { name: "Cell outlines" })).not.toBeVisible();
  await user.click(screen.getByText("Advanced", { exact: true }));
  const toggle = screen.getByRole("switch", { name: "Smooth surface" });
  await user.click(toggle);
  expect(toggle).toBeChecked();
  expect(screen.getByRole("slider", { name: "Smoothing radius" })).toHaveValue("0.75");
  expect(screen.getByRole("checkbox", { name: "Contour lines" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Cell outlines" })).toBeDisabled();
  expect(screen.getByRole("region", { name: "Map legend" })).toHaveTextContent("Smooth surface · visual interpolation");
  await user.click(screen.getByRole("checkbox", { name: "Contour lines" }));
  expect(screen.getByRole("checkbox", { name: "Contour lines" })).not.toBeChecked();
  view.rerender(<Host categorical />);
  expect(screen.queryByRole("switch",{name:"Smooth surface"})).not.toBeInTheDocument();
  expect(screen.queryByRole("slider", { name: "Smoothing radius" })).not.toBeInTheDocument();
});

it("shows source categories, constant and empty states without opening appearance settings", () => {
  const props = {layer, opacity:.8, onPalette:vi.fn(), onScaleMode:vi.fn(), onOpacity:vi.fn()};
  const view = render(<MapLegend {...props} scale={createCategoryScale(new Map([["a",0]]),["Recorded protection"],"ocean")} />);
  expect(screen.getByLabelText("Category key")).toHaveTextContent("Recorded protection");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<MapLegend {...props} scale={createColorScale(new Map([["a",1]]),"ocean","equal")} />);
  expect(screen.getByText("Constant value · 1 m")).toBeVisible();
  view.rerender(<MapLegend {...props} scale={createColorScale(new Map([["a",null]]),"ocean","equal")} />);
  expect(screen.getByText("No available values in this slice")).toBeVisible();
});

it("automatically selects categorical legend then restores continuous controls on numeric layers", async () => {
  const props={opacity:.8,onPalette:vi.fn(),onScaleMode:vi.fn(),onOpacity:vi.fn(),standardization:{enabled:true,onChange:vi.fn()},smoothing:{enabled:true,radius:.75,contours:true},onSmoothing:vi.fn()};
  const view=render(<MapLegend {...props} layer={{...layer,categories:["Area 7"]}} scale={createCategoryScale(new Map([["a",0]]),["Area 7"],"ocean")} open />);
  expect(screen.queryByRole("combobox",{name:"Coloring method"})).not.toBeInTheDocument();
  expect(screen.queryByRole("switch",{name:"Display z-scores"})).not.toBeInTheDocument();
  expect(screen.queryByRole("switch",{name:"Smooth surface"})).not.toBeInTheDocument();
  view.rerender(<MapLegend {...props} layer={layer} scale={createColorScale(new Map([["a",0],["b",10]]),"ocean","minmax")} open />);
  expect(screen.getByRole("combobox",{name:"Coloring method"})).toHaveValue("minmax");
  expect(screen.getByRole("switch",{name:"Display z-scores"})).not.toBeDisabled();
});

it("bounds a large legend to searchable pages while keeping every category reachable", async () => {
  const labels=Array.from({length:2500},(_,i)=>`Area ${i}`),user=userEvent.setup();
  render(<MapLegend layer={{...layer,categories:labels}} scale={createCategoryScale(new Map([["a",0]]),labels,"ocean")} opacity={.8} onPalette={vi.fn()} onScaleMode={vi.fn()} onOpacity={vi.fn()} open />);
  expect(document.querySelectorAll('.category-legend-list > button')).toHaveLength(50);
  await user.click(screen.getByRole('button',{name:'Next legend categories'}));
  expect(document.querySelector('.category-legend-list')).toHaveTextContent('Area 50');
  await user.type(screen.getByRole('searchbox',{name:'Find legend category'}),'Area 2499');
  expect(document.querySelectorAll('.category-legend-list > button')).toHaveLength(1);
  expect(document.querySelector('.category-legend-list')).toHaveTextContent('Area 2499');
});

it("toggles category icons without opening settings and preserves their colors",async()=>{
 const user=userEvent.setup();
 function Host(){const [hidden,setHidden]=useState<string[]>([]);return <MapLegend layer={{...layer,categories:["Area"]}} scale={createCategoryScale(new Map([["a",0]]),["Area"],"ocean")} opacity={.8} onPalette={()=>{}} onScaleMode={()=>{}} onOpacity={()=>{}} hiddenCategories={hidden} onHiddenCategoriesChange={setHidden}/>;}
 render(<Host/>);const item=screen.getByRole("button",{name:"Area"}),icon=item.querySelector("i")!,color=icon.getAttribute("style");
 await user.click(icon);expect(item).toHaveAttribute("aria-pressed","false");expect(icon.getAttribute("style")).toBe(color);
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 item.focus();await user.keyboard(" ");expect(item).toHaveAttribute("aria-pressed","true");
});


it("shows tribal boolean counts and a separate unknown key while retaining category filter keys",async()=>{
 const values=new Map<string,number|null>([["yes",1],["no",0],["unknown",null]]),onHiddenCategoriesChange=vi.fn();
 render(<MapLegend layer={{...layer,values,categories:["false","true"]}} scale={createCategoryScale(values,["false","true"],"ocean")} categoricalCounts missingLabel="Unknown overlap support" opacity={.8} onPalette={vi.fn()} onScaleMode={vi.fn()} onOpacity={vi.fn()} onHiddenCategoriesChange={onHiddenCategoriesChange}/>);
 expect(screen.getByRole("button",{name:"false · 1 cell"})).toBeVisible();
 expect(screen.getByRole("button",{name:"true · 1 cell"})).toBeVisible();
 expect(screen.getByText("Unknown overlap support · 1 cell")).toBeVisible();
 await userEvent.setup().click(screen.getByRole("button",{name:"false · 1 cell"}));
 expect(onHiddenCategoriesChange).toHaveBeenCalledWith(["false"]);
});

it("counts overlapping tribal identities in every corresponding categorical legend entry",()=>{
 const values=new Map<string,number|null>([["both",2],["us",0],["unknown",null]]);
 const categories=["US: 001","Canada: 001","Multiple recorded features"];
 const membershipLayer={...layer,values,categories,categoryKeys:["us:001","ca:001","multiple-memberships"],categoryMemberships:new Map([["both",[0,1]],["us",[0]],["unknown",null]])};
 render(<MapLegend layer={membershipLayer} scale={createCategoryScale(values,categories,"ocean")} categoricalCounts missingLabel="Unknown membership support" opacity={.8} onPalette={vi.fn()} onScaleMode={vi.fn()} onOpacity={vi.fn()}/>);
 expect(screen.getByRole("button",{name:"US: 001 · 2 cells"})).toBeVisible();
 expect(screen.getByRole("button",{name:"Canada: 001 · 1 cell"})).toBeVisible();
 expect(screen.queryByRole("button",{name:/Multiple recorded/})).not.toBeInTheDocument();
 expect(screen.getByText("Unknown membership support · 1 cell")).toBeVisible();
});

it.each([["State / Province Assignment",["Washington","British Columbia","Oregon"]],["Country Assignment",["United States","Canada","International"]]])("shows %s vocabulary and explicit unknown counts even with no qualified polygons",(name,categories)=>{
 const values=new Map<string,number|null>([["a",null],["b",null]]);
 const id=`GOVERNANCE__${name==="Country Assignment"?"federal_waters":"state_provincial_waters"}__assignment__feature_memberships_v1`;
 const scale=createCategoryScale(values,categories as string[],"ocean");
 render(<MapLegend layer={{...layer,id,name:name as string,values,categories:categories as string[],categoryMemberships:new Map([["a",null],["b",null]])}} scale={scale} categoricalCounts missingLabel="Unknown water assignment support" opacity={.8} onPalette={vi.fn()} onScaleMode={vi.fn()} onOpacity={vi.fn()}/>);
 for(const category of categories)expect(screen.getByRole("button",{name:category+" · 0 cells"})).toBeVisible();
 const buttons=within(screen.getByLabelText("Category key")).getAllByRole("button");
 expect(buttons.map(button=>button.textContent)).toEqual([...(categories as string[])].sort().map(category=>category+" · 0 cells"));
 for(const category of categories)expect(screen.getByRole("button",{name:category+" · 0 cells"}).querySelector("i")).toHaveStyle({background:scale.colors[categories.indexOf(category)]});
 expect(screen.getByText("Unknown water assignment support · 2 cells")).toBeVisible();expect(screen.queryByText(/No qualified water polygons/)).not.toBeInTheDocument();
});

it("alphabetizes county/district legend names while preserving original colors and filter keys", async () => {
  const categories = ["San Juan County", "Capital Regional District", "qathet Regional District"];
  const values = new Map<string, number | null>([["a", 0], ["b", 1], ["c", 2]]);
  const scale = createCategoryScale(values, categories, "ocean");
  const onHiddenCategoriesChange = vi.fn();
  render(<MapLegend layer={{...layer, id: "GOVERNANCE__county_regional_boundaries__feature_memberships_v1", categories, values,
    categoryKeys: ["san-juan", "capital", "qathet"]}} scale={scale} opacity={.8}
    onPalette={vi.fn()} onScaleMode={vi.fn()} onOpacity={vi.fn()} onHiddenCategoriesChange={onHiddenCategoriesChange}/>);
  const buttons = within(screen.getByLabelText("Category key")).getAllByRole("button");
  expect(buttons.map(button => button.textContent)).toEqual(["Capital Regional District", "qathet Regional District", "San Juan County"]);
  expect(buttons[0].querySelector("i")).toHaveStyle({background: scale.colors[1]});
  await userEvent.setup().click(buttons[0]);
  expect(onHiddenCategoriesChange).toHaveBeenCalledWith(["capital"]);
  expect(categories).toEqual(["San Juan County", "Capital Regional District", "qathet Regional District"]);
});

it("renders public presence as True/False without an unknown category", () => {
  const values = new Map<string,number|null>([["a",0],["b",0]]);
  render(<MapLegend layer={{...layer,id:"anthropogenic_static__ANTHROPOGENIC__ARTIFICIAL_REEF_MAPPED_POSITIVE_EVIDENCE",name:"Artificial Reef",categories:["false","true"],values}} scale={createCategoryScale(values,["false","true"],"ocean")} opacity={.8} onPalette={vi.fn()} onScaleMode={vi.fn()} onOpacity={vi.fn()}/>);
  expect(screen.getByRole("button",{name:"False · 2 cells"})).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"True · 0 cells"})).toBeInTheDocument();
  expect(screen.getByRole("region",{name:"Map legend"})).not.toHaveTextContent("Unknown coverage");
});

it("shows compact reef 0/1 categories as False/True with exact cell counts", () => {
  const values = new Map<string,number|null>([["a",0],["b",1],["c",1]]);
  render(<MapLegend layer={{...layer,id:"anthropogenic_static__has_mapped_artificial_reef",name:"Artificial Reef",categories:["0","1"],values}} scale={createCategoryScale(values,["0","1"],"ocean")} opacity={.8} onPalette={vi.fn()} onScaleMode={vi.fn()} onOpacity={vi.fn()}/>);
  expect(screen.getByRole("button",{name:"False · 1 cell"})).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"True · 2 cells"})).toBeInTheDocument();
});
