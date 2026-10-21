import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HumanPopulationInsights from "./HumanPopulationInsights";
import type { SeascapeLayer } from "../data/seascape";

afterEach(cleanup);
const field = "population_within_100km_collected";
function layer(value: number | null, coverage: string | null, imputed: boolean | null) {
  return {field:{dataset:"human",column:field,sourceRelease:"US 2020 / Canada 2021"},index:new Map([["cell",0]]),values:new Map([["cell",value]]),qualifiers:{
    [`${field}__coverage_status`]:[coverage], [`${field}__zero_imputed`]:[imputed],
    "population_within_100km__unverified_geographic_support":[true],
    "population_within_100km__missing_sources":['["CA2021:missing"]'],
    [`${field}__method`]:["area_weighted_collected_sources_missing_as_zero.v1"],
  }} as unknown as SeascapeLayer;
}
describe("Human collected population inspection",()=>{
  it("retains positive partial sums, census vintages and explicit zero assumptions",()=>{
    render(<HumanPopulationInsights layer={layer(1234.5,"partial",true)} cell="cell"/>);
    expect(screen.getByText("1,234.5 persons")).toBeInTheDocument();
    expect(screen.getByText("100 km from the H3 cell center")).toBeInTheDocument();
    expect(screen.getByText("US 2020 / Canada 2021")).toBeInTheDocument();
    expect(screen.getByText("partial")).toBeInTheDocument();
    expect(screen.getByText(/not a complete observed/)).toBeInTheDocument();
    expect(screen.getByText('["CA2021:missing"]')).toBeInTheDocument();
  });
  it.each([[true,"partial",/does not establish/],[false,"known_zero",/supported source coverage/],[null,null,/Coverage for this zero is unknown/]] as const)("distinguishes zero coverage %s",(imputed,coverage,message)=>{
    render(<HumanPopulationInsights layer={layer(0,coverage,imputed)} cell="cell"/>);
    expect(screen.getByText("0 persons")).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });
  it("does not turn an unavailable value into zero",()=>{
    render(<HumanPopulationInsights layer={layer(null,null,null)} cell="cell"/>);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("0 persons")).not.toBeInTheDocument();
  });
});


it("inspects a 25 km collected estimate using its own qualifiers",()=>{
  const input=layer(42,"partial",true);
  input.field.column="population_within_25km_collected";
  input.qualifiers={
    population_within_25km_collected__coverage_status:["partial"],
    population_within_25km_collected__zero_imputed:[true],
    population_within_25km__missing_sources:['["25km-missing"]'],
    population_within_25km__unverified_geographic_support:[true],
  };
  render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText("25 km from the H3 cell center")).toBeInTheDocument();
  expect(screen.getByText('["25km-missing"]')).toBeInTheDocument();
});

it("shows collected density with its unchanged full-cell denominator and coverage evidence",()=>{
  const input=layer(308.625,"partial",true);
  input.field.column="population_density_per_km2_collected";
  input.qualifiers={population_density_per_km2_collected__coverage_status:["partial"],
    population_density_per_km2_collected__zero_imputed:[true],
    population_count__available_source_subtotal:[1234.5], cell_area_km2:[4.]};
  render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText("308.63 persons/km²")).toBeInTheDocument();
  expect(screen.getByText("4 km² · full cell area")).toBeInTheDocument();
  expect(screen.getByText(/not a complete observed/)).toBeInTheDocument();
});
