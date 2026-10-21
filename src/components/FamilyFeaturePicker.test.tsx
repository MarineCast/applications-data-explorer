import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import FamilyFeaturePicker from "./FamilyFeaturePicker";
import type { SeascapeCatalog, SeascapeFeature } from "../data/seascape";

const feature = (id: string, name: string, family: string, overrides: Partial<SeascapeFeature> = {}): SeascapeFeature => ({
  id, name, family, resolution:6, dataset:"seascape", unit:"m", range:[0,100], available:8, rows:10,
  role:"original_source_field", definition:"A source measurement.", qualifiers:[], sourceRelease:"fixture",
  sourcePath:"fixture.parquet", sourceSha256:"fixture", modelingEligibility:"not_assigned", arrowType:"double", ...overrides,
});
const catalog = { features:[
  feature("depth", "Bathymetry", "Bathymetry", {measurement:{quantity:"depth", statistic:"mean", positiveDirection:"down"}}),
  feature("anomaly", "Local depth anomaly", "Bathymetry"),
  feature("shore-qc", "Shoreline quality", "Shoreline", {role:"source_quality"}),
  feature("shore", "Shoreline length", "Shoreline"),
  feature("null", "Freshwater distance", "Freshwater", {available:0}),
  feature("r8", "Terrain slope", "Terrain", {resolution:8}),
  feature("gov", "Protected area", "Marine Protected Areas", {dataset:"governance"}),
] } as SeascapeCatalog;

it("cascades family into native features, starts with an available measurement and preserves a choice within the same family", async () => {
  function Host() {
    const [value, setValue] = useState("anomaly");
    return <FamilyFeaturePicker label="Feature" catalog={catalog} resolution={6} dataset="seascape" value={value} onChange={setValue} />;
  }
  const user = userEvent.setup();
  render(<Host />);
  expect(screen.getByRole("button", {name:"Family"})).toHaveTextContent("Bathymetry");
  await user.click(screen.getByRole("button", {name:"Family"}));
  expect(screen.queryByRole("button", {name:"Select Terrain"})).not.toBeInTheDocument();
  expect(screen.queryByRole("button", {name:"Select Marine Protected Areas"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", {name:"Select Bathymetry"}));
  expect(screen.getByRole("button", {name:"Feature"})).toHaveValue("anomaly");
  await user.click(screen.getByRole("button", {name:"Family"}));
  await user.click(screen.getByRole("button", {name:"Select Shoreline"}));
  expect(screen.getByRole("button", {name:"Feature"})).toHaveValue("shore");
  await user.click(screen.getByRole("button", {name:"Feature"}));
  expect(screen.getByRole("button", {name:"Select Shoreline quality"})).toBeVisible();
  expect(screen.queryByRole("button", {name:"Select Local depth anomaly"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", {name:"About Shoreline quality"}));
  expect(screen.getByRole("button", {name:"Feature"})).toHaveValue("shore");
  expect(screen.getByRole("button", {name:"Copy metric name: Shoreline quality"})).toBeVisible();
  await user.keyboard("{Escape}{Escape}");
  await user.click(screen.getByRole("button", {name:"Family"}));
  await user.click(screen.getByRole("button", {name:"Select Freshwater"}));
  expect(screen.getByRole("button", {name:"Feature"})).toHaveValue("null");
  await user.click(screen.getByRole("button", {name:"Feature"}));
  expect(screen.getByText("No available values")).toBeVisible();
  expect(screen.getByRole("button", {name:"Select Freshwater distance"})).toBeEnabled();
});

it("derives family and feature choices from the active native product and resolution", async () => {
  const props = {label:"Feature", catalog, resolution:6 as const, dataset:"seascape", value:"depth", onChange:vi.fn()};
  const user = userEvent.setup();
  const {rerender} = render(<FamilyFeaturePicker {...props} />);
  rerender(<FamilyFeaturePicker {...props} resolution={8} value="r8" />);
  expect(screen.getByRole("button", {name:"Family"})).toHaveTextContent("Terrain");
  await user.click(screen.getByRole("button", {name:"Feature"}));
  expect(screen.getByRole("button", {name:"Select Terrain slope"})).toBeVisible();
  expect(screen.queryByRole("button", {name:/Select Bathymetry/})).not.toBeInTheDocument();
  rerender(<FamilyFeaturePicker {...props} dataset="governance" value="gov" />);
  expect(screen.getByRole("button", {name:"Family"})).toHaveTextContent("Marine Protected Areas");
  expect(screen.getByRole("button", {name:"Select Protected area"})).toBeVisible();
});

it("keeps the comparison family and feature independent from the left map", async () => {
  function Host() {
    const [left, setLeft] = useState("depth");
    const [right, setRight] = useState("anomaly");
    return <>
      <FamilyFeaturePicker label="Feature" catalog={catalog} resolution={6} dataset="seascape" value={left} onChange={setLeft} />
      <FamilyFeaturePicker label="Right map feature" familyLabel="Right map family" catalog={catalog} resolution={6} dataset="seascape" value={right} onChange={setRight} />
    </>;
  }
  const user = userEvent.setup();
  render(<Host />);
  await user.click(screen.getByRole("button", {name:"Right map family"}));
  await user.click(screen.getByRole("button", {name:"Select Shoreline"}));
  expect(screen.getByRole("button", {name:"Right map feature"})).toHaveValue("shore");
  expect(screen.getByRole("button", {name:"Family"})).toHaveTextContent("Bathymetry");
  expect(screen.getByRole("button", {name:"Feature"})).toHaveValue("depth");
});


it("keeps all population measurements and coverage indicators in one Population family", async () => {
  const names = ["Population Count", "Population Density (people/km²)", "Population Within 25km", "Population Within 50km", "Population Within 100km"];
  const columns = ["population_count_collected", "population_density_per_km2_collected", "population_within_25km_collected", "population_within_50km_collected", "population_within_100km_collected"];
  const fields=names.flatMap((name,i)=>[
    feature(columns[i], name, "Population", {dataset:"human",column:columns[i],resolution:7}),
    feature(columns[i]+"__coverage_status", name+" Coverage", "Population", {dataset:"human",column:columns[i]+"__coverage_status",resolution:7,kind:"categorical"}),
  ]);
  const onChange=vi.fn(), user=userEvent.setup();
  render(<FamilyFeaturePicker label="Feature" catalog={{features:fields} as SeascapeCatalog} resolution={7} dataset="human" value={columns[0]} onChange={onChange}/>);
  await user.click(screen.getByRole("button",{name:"Family"}));
  expect(screen.getByRole("button",{name:"Select Population"})).toBeVisible();
  expect(screen.queryByRole("button",{name:"Select Population Coverage"})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:"Select Population"}));
  await user.click(screen.getByRole("button",{name:"Feature"}));
  for(const name of names){
    expect(screen.getByRole("button",{name:"Select "+name})).toBeVisible();
    expect(screen.getByRole("button",{name:"Select "+name+" Coverage"})).toBeVisible();
  }
  await user.click(screen.getByRole("button",{name:"Select Population Density (people/km²)"}));
  expect(onChange).toHaveBeenCalledWith("population_density_per_km2_collected");
});


it("starts Human access families with individual sites, keeping source lines and H3 counts separate", async()=>{
 const fields=[feature("population","Population Count","Population",{dataset:"human",resolution:7}),
  feature("lines","Shoreline Access Classifications","Shore Access",{dataset:"human",resolution:7,geometryGroup:"access_lines",kind:"categorical"}),
  feature("count","Shore Access Source Records · H3 summary","Shore Access",{dataset:"human",resolution:7}),
  feature("points","Shore Access Sites","Shore Access",{dataset:"human",resolution:7,geometryGroup:"shore_access",kind:"categorical"})];
 const onChange=vi.fn(),user=userEvent.setup();
 render(<FamilyFeaturePicker label="Feature" catalog={{features:fields} as SeascapeCatalog} resolution={7} dataset="human" value="population" onChange={onChange}/>);
 await user.click(screen.getByRole("button",{name:"Family"}));await user.click(screen.getByRole("button",{name:"Select Shore Access"}));
 expect(onChange).toHaveBeenCalledWith("points");
});


it("keeps the Wildlife Refuges dropdown to three friendly choices with discreet copy buttons", async () => {
  const names = ["Wildlife Refuge Count", "Wildlife Refuge Assignment", "Wildlife Refuge Coverage"];
  const fields = names.map((name, i) => feature(String(i), name, "Wildlife Refuges", { dataset: "governance", role: "scientific_metric" }));
  const user = userEvent.setup();
  render(<FamilyFeaturePicker label="Feature" catalog={{ features: fields } as SeascapeCatalog} resolution={6} dataset="governance" value="0" onChange={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Feature" }));
  expect(screen.getAllByRole("button", { name: /^Select Wildlife Refuge/ })).toHaveLength(3);
  for (const name of names) expect(screen.getByRole("button", { name: `Select ${name}` })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /Copy metric name/ })).toHaveLength(3);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByText(/Copied/)).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Measurements" })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Select Wildlife Refuge/ }).map(item => item.textContent)).toEqual(names);
});


it("shows the two combined Tribal / First Nations choices and explains unknown versus false in feature information", async () => {
  const fields = [feature("assignment", "Tribal / First Nations Assignment", "Tribal First Nations Areas", {dataset:"governance",membershipColumn:"tribal_first_nations_areas__feature_memberships_v1"}),
    feature("area", "Tribal / First Nations Area", "Tribal First Nations Areas", {dataset:"governance",kind:"categorical",definition:"True: qualifying overlap. False: verified full-cell coverage. Null: unknown support; not sovereign territory."})];
  const user=userEvent.setup();
  render(<FamilyFeaturePicker label="Feature" catalog={{features:fields} as SeascapeCatalog} resolution={6} dataset="governance" value="area" onChange={vi.fn()}/>);
  await user.click(screen.getByRole("button", {name:"Feature"}));
  expect(screen.getAllByRole("button", {name:/^Select Tribal/}).map(button=>button.textContent)).toEqual(["Tribal / First Nations Area", "Tribal / First Nations Assignment"]);
  expect(screen.getAllByRole("button",{name:/Copy metric/})).toHaveLength(2);
  await user.click(screen.getByRole("button",{name:"About Tribal / First Nations Area"}));
  expect(screen.getByRole("region",{name:"About Tribal / First Nations Area"})).toHaveTextContent("Null: unknown support");
});


it.each([6,8] as const)("keeps Wildlife Refuges and Tribal families simultaneously reachable at R%s",async resolution=>{
 const families=["Coast Guard Sectors","Conservation Designations","County Regional Boundaries","Critical Habitat","Exclusion Zones","Federal Waters","International Boundaries","Management Areas","Marine Protected Areas","National Marine Sanctuaries","Ports","Shipping Lanes","Speed Restriction Zones","State Provincial Waters","Traffic Separation Schemes"];
 const fields=[...families.map(name=>feature(name,name,name,{dataset:"governance",resolution})),
  ...["Count","Assignment","Coverage"].map(name=>feature("refuge-"+name,"Wildlife Refuge "+name,"Wildlife Refuges",{dataset:"governance",resolution})),
  ...["Area","Assignment"].map(name=>feature("tribal-"+name,"Tribal / First Nations "+name,"Tribal First Nations Areas",{dataset:"governance",resolution,kind:"categorical",membershipColumn:name==="Assignment"?"tribal_first_nations_areas__feature_memberships_v1":undefined}))];
 function Host(){const [value,setValue]=useState("tribal-Area");return <FamilyFeaturePicker label="Feature" catalog={{features:fields} as SeascapeCatalog} resolution={resolution} dataset="governance" value={value} onChange={setValue}/>;}
 const user=userEvent.setup();render(<Host/>);
 await user.click(screen.getByRole("button",{name:"Family"}));
 expect(screen.getByRole("button",{name:"Select Tribal First Nations Areas"})).toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Select Wildlife Refuges"})).toBeInTheDocument();
 await user.keyboard("{ArrowDown}{End}{Enter}");
 expect(screen.getByRole("button",{name:"Family"})).toHaveTextContent("Wildlife Refuges");
 await user.click(screen.getByRole("button",{name:"Feature"}));
 expect(screen.getAllByRole("button",{name:/^Select Wildlife Refuge/})).toHaveLength(3);
 await user.click(screen.getByRole("button",{name:"Select Wildlife Refuge Assignment"}));
 await user.click(screen.getByRole("button",{name:"Family"}));
 await user.click(screen.getByRole("button",{name:"Select Tribal First Nations Areas"}));
 await user.click(screen.getByRole("button",{name:"Feature"}));
 expect(screen.getAllByRole("button",{name:/^Select Tribal/})).toHaveLength(2);
});

it.each([6,8] as const)("defaults Federal Waters to the approved assignment and offers the boundary second at R%s",async resolution=>{
 const assignment="federal_waters__assignment__feature_memberships_v1",boundary="federal_waters__international_boundary";
 const fields=[feature("ports","Port count","Ports",{dataset:"governance",resolution}),
  feature(boundary,"International Boundary","Federal Waters",{dataset:"governance",resolution,column:boundary,kind:"categorical"}),
  feature(assignment,"Country Assignment","Federal Waters",{dataset:"governance",resolution,column:assignment,kind:"categorical"})];
 function Host(){const[value,setValue]=useState("ports");return <FamilyFeaturePicker label="Feature" catalog={{features:fields} as SeascapeCatalog} resolution={resolution} dataset="governance" value={value} onChange={setValue}/>;}
 const user=userEvent.setup();render(<Host/>);
 await user.click(screen.getByRole("button",{name:"Family"}));await user.click(screen.getByRole("button",{name:"Select Federal Waters"}));
 expect(screen.getByRole("button",{name:"Feature"})).toHaveValue(assignment);
 await user.click(screen.getByRole("button",{name:"Feature"}));
 expect(screen.getAllByRole("button",{name:/^Select (Country Assignment|International Boundary)$/}).map(b=>b.textContent)).toEqual(["Country Assignment","International Boundary"]);
 await user.click(screen.getByRole("button",{name:"Select International Boundary"}));expect(screen.getByRole("button",{name:"Feature"})).toHaveValue(boundary);
});

it.each([6, 8] as const)("combines all five administrative boundary choices at R%s without changing selected feature IDs", async resolution => {
  const { administrativeBoundaryFeatures } = await import("../data/administrativeBoundaries");
  const names = ["County / District Count", "County / District Assignment", "Country Assignment", "International Boundary", "State / Province Assignment"];
  const columns = ["county_regional_boundaries__recorded_feature_count", "county_regional_boundaries__feature_memberships_v1", "federal_waters__assignment__feature_memberships_v1", "federal_waters__international_boundary", "state_provincial_waters__assignment__feature_memberships_v1"];
  const oldFamilies = ["Regional Boundaries", "Regional Boundaries", "Federal Waters", "Federal Waters", "State Provincial Waters"];
  const fields = administrativeBoundaryFeatures(columns.map((column, i) => feature(column, names[i], oldFamilies[i], {dataset: "governance", resolution, column})));
  function Host() {
    const [value, setValue] = useState(columns[0]);
    return <FamilyFeaturePicker label="Feature" catalog={{features: fields} as SeascapeCatalog} resolution={resolution} dataset="governance" value={value} onChange={setValue}/>;
  }
  const user = userEvent.setup(); render(<Host/>);
  await user.click(screen.getByRole("button", {name: "Family"}));
  expect(screen.getByRole("button", {name: "Select Administrative Boundaries"})).toBeInTheDocument();
  for (const family of new Set(oldFamilies)) expect(screen.queryByRole("button", {name: `Select ${family}`})).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", {name: "Select Administrative Boundaries"}));
  for (let i = 0; i < names.length; i++) {
    await user.click(screen.getByRole("button", {name: "Feature"}));
    expect(screen.getAllByRole("button", {name: /^Select /}).map(button => button.textContent)).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    await user.click(screen.getByRole("button", {name: `Select ${names[i]}`}));
    expect(screen.getByRole("button", {name: "Feature"})).toHaveValue(columns[i]);
    expect(screen.getByRole("button", {name: "Family"})).toHaveTextContent("Administrative Boundaries");
  }
});

it.each([6, 8] as const)("shows one Coast Guard Assignment choice at R%s", async resolution => {
  const {coastGuardFeatures, coastGuardAssignmentColumn} = await import("../data/coastGuard");
  const fields = coastGuardFeatures([coastGuardAssignmentColumn, "coast_guard_sectors__ccg_administrative_region__feature_memberships_v1", "coast_guard_sectors__uscg_sector__feature_memberships_v1"]
    .map(column => feature("GOVERNANCE__" + column, column, "Coast Guard Sectors", {column, resolution, dataset: "governance", membershipColumn: column})));
  render(<FamilyFeaturePicker label="Feature" catalog={{features: fields} as SeascapeCatalog} resolution={resolution} dataset="governance" value={fields[0].id} onChange={vi.fn()}/>);
  await userEvent.setup().click(screen.getByRole("button", {name: "Feature"}));
  expect(screen.getAllByRole("button", {name: /^Select /}).map(button => button.textContent)).toEqual(["Coast Guard Assignment"]);
});


it.each(["Marine Conservation Areas", "Administrative Boundaries", "Wildlife Refuges"])("copies %s feature names without selecting or adding a visible success banner", async family => {
 const user=userEvent.setup(), write=vi.spyOn(navigator.clipboard,"writeText").mockResolvedValue(), onChange=vi.fn();
 const field=feature("assignment","Marine Conservation Area Assignment",family,{dataset:"governance"});
 render(<FamilyFeaturePicker label="Right map feature" catalog={{features:[field]} as SeascapeCatalog} resolution={6} dataset="governance" value={field.id} onChange={onChange}/>);
 await user.click(screen.getByRole("button",{name:"Right map feature"}));
 await user.click(screen.getByRole("button",{name:"Copy metric name: Marine Conservation Area Assignment"}));
 expect(write).toHaveBeenCalledExactlyOnceWith("Marine Conservation Area Assignment");
 expect(onChange).not.toHaveBeenCalled();
 expect(screen.getByRole("dialog")).toBeVisible();
 expect(screen.getByRole("status")).toHaveClass("sr-only");
 expect(screen.getByRole("button",{name:"Copy metric name: Marine Conservation Area Assignment"})).toHaveAttribute("title","Copied");
 write.mockRestore();
});
