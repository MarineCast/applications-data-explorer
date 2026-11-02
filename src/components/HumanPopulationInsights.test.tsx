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

it.each([["unavailable",/does not establish/],["known_zero",/supported source coverage/]] as const)("uses compact %s coverage without audit columns", (coverage,message) => {
  const input=layer(0,null,null);
  input.field.column="population_count_collected";
  input.field.populationEvidence={method:"area_weighted_collected_sources_missing_as_zero.v1",auditReceipt:true};
  input.qualifiers={population_count__coverage_status:[coverage],population_count__unverified_geographic_support:[coverage==="unavailable"]};
  render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText(message)).toBeInTheDocument();
  expect(screen.getByText("Retained in the external audit receipt")).toBeInTheDocument();
  expect(screen.getByText("area_weighted_collected_sources_missing_as_zero.v1")).toBeInTheDocument();
});

it("inspects the compact count coverage layer through its retained quantity", () => {
  const input=layer(0,null,null);input.field.column="population_count__coverage_status";
  input.qualifiers={population_count__coverage_status:["unavailable"],population_count_collected:[0]};
  render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText("0 persons")).toBeInTheDocument();
  expect(screen.getByText(/does not establish/)).toBeInTheDocument();
});


it.each(["population_count_collected","population_count_coverage_status"])("retains new snake_case support for %s", column => {
  const input=layer(0,null,null);input.field.column=column;
  input.qualifiers={population_count_coverage_status:["unavailable"],population_count_unverified_geographic_support:[true],population_count_collected:[0]};
  render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText("0 persons")).toBeInTheDocument();
  expect(screen.getByText("unavailable")).toBeInTheDocument();
  expect(screen.getByText(/does not establish/)).toBeInTheDocument();
  expect(screen.getAllByText("Yes")).toHaveLength(2);
});


it.each(["population_count_collected","population_density_per_km2_collected"])("keeps %s values when row support is audit-only",column=>{
  const input=layer(0,null,null);input.field.column=column;input.qualifiers={};
  input.field.populationEvidence={method:"area_weighted_collected_sources_missing_as_zero.v1",auditReceipt:true,supportInAudit:true};
  render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText(/Coverage for this zero is retained/)).toBeInTheDocument();
  expect(screen.getByText(/Detailed coverage, geographic support and cell area/)).toBeInTheDocument();
  expect(screen.queryByText("This zero has supported source coverage.")).not.toBeInTheDocument();
  expect(screen.queryByText("Source coverage")).not.toBeInTheDocument();
  expect(screen.getByText("area_weighted_collected_sources_missing_as_zero.v1")).toBeInTheDocument();
  if(column.includes("density"))expect(screen.getByText("Full cell area")).toBeInTheDocument();
});


it.each(["population_count","population_density_per_km2"])("inspects renamed %s with unchanged allocation assumptions", column=>{
  const input=layer(0,null,null);input.field.column=column;input.qualifiers={};
  input.field.populationEvidence={method:"area_weighted_collected_sources_missing_as_zero.v1",auditReceipt:true,supportInAudit:true};
  render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText(/Missing contributions count as zero/)).toBeInTheDocument();
  expect(screen.getByText(/Coverage for this zero is retained/)).toBeInTheDocument();
  expect(screen.queryByText("This zero has supported source coverage.")).not.toBeInTheDocument();
});

it("updates bound current support when the selected cell changes", () => {
  const input=layer(0,null,null); input.field.column="population_within_100km";
  input.field.populationEvidence={method:"area_weighted_collected_sources_missing_as_zero.v1",auditReceipt:true,supportInAudit:true,supportAvailable:true,auditFields:{coverage_status:"population_within_100km__coverage_status",zero_imputed:"population_within_100km_collected__zero_imputed"}};
  input.index=new Map([["cell",0],["other",1]]); input.values=new Map([["cell",0],["other",42]]);
  input.qualifiers={population_within_100km__coverage_status:["partial","complete"],population_within_100km_collected__zero_imputed:[true,false],population_within_100km__missing_sources:['["missing"]','[]']};
  const view=render(<HumanPopulationInsights layer={input} cell="cell"/>);
  expect(screen.getByText("partial")).toBeInTheDocument();
  expect(screen.getByText(/does not establish/)).toBeInTheDocument();
  view.rerender(<HumanPopulationInsights layer={input} cell="other"/>);
  expect(screen.getByText("42 persons")).toBeInTheDocument();
  expect(screen.getByText("complete")).toBeInTheDocument();
  expect(screen.getByText("None listed; geographic gaps may still remain")).toBeInTheDocument();
  expect(screen.queryByText("partial")).not.toBeInTheDocument();
});
