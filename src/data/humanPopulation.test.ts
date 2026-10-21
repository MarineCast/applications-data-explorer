import { featurePickerItem } from "./sourcePicker";
import type { SeascapeCatalog } from "./seascape";
import { describe, expect, it } from "vitest";
import { populationSupport, populationScaleValues, samePopulationQuantity } from "./humanPopulation";
import { createColorScale, colorForScale } from "./colorScale";
import type { SeascapeLayer } from "./seascape";

function layer() {
  return { field: { dataset: "human", column: "population_count_collected" },
    index: new Map([["missing", 0], ["complete", 1], ["high-partial", 2]]),
    values: new Map([["missing", 0], ["complete", 100], ["high-partial", 1000]]),
    qualifiers: { population_count__available_source_subtotal: [null, 100, 1000] } } as unknown as SeascapeLayer;
}
describe("population support and classification", () => {
  it("uses unchanged collected allocations and zero baseline for classification", () => {
    const input = layer();
    const classified = createColorScale(populationScaleValues(input)!, "ocean", "equal");
    const native = createColorScale(input.values, "ocean", "equal");
    expect(classified.edges).toEqual(native.edges);
    expect(classified.edges[0]).toBe(0);
    expect(classified.edges[10]).toBe(1000);
    expect(colorForScale(100, classified)).toBe(colorForScale(100, native));
    expect(samePopulationQuantity(input.field, input.field)).toBe(true);
  });
  it("keeps radii, units and coverage fields distinct", () => {
    expect(populationSupport({ dataset: "human", column: "population_within_25km_collected" })?.radius).toBe(25);
    expect(populationSupport({ dataset: "human", column: "population_density_per_km2_collected" })?.allocationBase).toBe("population_count");
    expect(populationSupport({ dataset: "human", column: "population_within_100km__coverage_status" })).toBeUndefined();
    expect(populationSupport({ dataset: "seascape", column: "population_count" })).toBeUndefined();
  });
});

it("uses full-cell areas for shared density classification", () => {
  const input=layer();
  input.field.column="population_density_per_km2_collected";
  input.qualifiers={population_count__available_source_subtotal:[0,100,1000],cell_area_km2:[2,4,5]};
  const values=populationScaleValues(input)!;
  expect(values.get("complete")).toBe(25);
  expect(values.get("high-partial")).toBe(200);
});

it("keeps Population Count in measurements and copies its collected machine ID", () => {
  const input=layer();
  const field: SeascapeLayer["field"]={...input.field,id:"HUMAN__population_count_collected",name:"Population Count",role:"source_field",available:1,rows:3,family:"Population",resolution:7,unit:"persons"};
  const catalog={features:[field]} as SeascapeCatalog;
  const item=featurePickerItem(field,catalog);
  expect(item.group).toBe("Measurements");
  expect(item.copyText).toBe("population_count_collected");
});


it.each([25, 50, 100])("recognizes only the collected public %s km distance quantity", radius => {
  expect(populationSupport({dataset: "human", column: `population_within_${radius}km`})).toBeUndefined();
  expect(populationSupport({dataset: "human", column: `population_within_${radius}km_collected`})?.radius).toBe(radius);
});


it.each(["population_count", "population_density_per_km2"])("rejects retired public %s", column => {
  expect(populationSupport({dataset: "human", column})).toBeUndefined();
});
