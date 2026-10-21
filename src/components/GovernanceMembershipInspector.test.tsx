import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GovernanceMembershipInspector from "./GovernanceMembershipInspector";
import fixture from "../data/governanceMemberships.fixture.json";
import { decodeGovernanceMemberships } from "../data/governanceMemberships";
const data = decodeGovernanceMemberships(fixture, fixture);

describe("Governance membership inspection", () => {
  it("shows every feature, qualified code, paired record and part lineage", () => {
    render(<GovernanceMembershipInspector memberships={data.cells[0]} count={2} status="partial" />);
    const section = screen.getByRole("region", { name: "Governance feature memberships" });
    expect(section).toHaveTextContent("Feature count: 2");
    expect(within(section).getAllByRole("heading", { level: 4 })).toHaveLength(2);
    expect(section).toHaveTextContent("dfo:21-0");
    expect(section).toHaveTextContent("wdfw:7");
    expect(section).toHaveTextContent("San Juan Islands");
    expect(section).toHaveTextContent("21-0");
    expect(section).toHaveTextContent("Not supplied");
    expect(section).toHaveTextContent("part-a");
    expect(section).toHaveTextContent("part-b");
  });
  it("distinguishes legacy unavailable identities, unknown support and verified empty membership", () => {
    const view = render(<GovernanceMembershipInspector />);
    expect(screen.getByText(/not included in this prepared product/)).toBeInTheDocument();
    view.rerender(<GovernanceMembershipInspector memberships={null} count={null} status="unknown" />);
    expect(screen.getByText(/membership is unknown/)).toBeInTheDocument();
    expect(screen.queryByText(/No recorded features under/)).not.toBeInTheDocument();
    view.rerender(<GovernanceMembershipInspector memberships={[]} count={0} status="observed" />);
    expect(screen.getByText(/No recorded features under verified empty/)).toBeInTheDocument();
    view.rerender(<GovernanceMembershipInspector memberships={[]} count={0} status="partial" />);
    expect(screen.queryByText(/No recorded features under verified empty/)).not.toBeInTheDocument();
    expect(screen.getByText(/does not establish absence/)).toBeInTheDocument();
  });
  it("renders explicit loading and failed reads without invented feature identities", () => {
    const view = render(<GovernanceMembershipInspector loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading feature identities");
    view.rerender(<GovernanceMembershipInspector error="Membership checksum mismatch" />);
    expect(screen.getByRole("alert")).toHaveTextContent("checksum mismatch");
  });
});


it("shows explicit country, agency and provider boundary type beside original tribal names and IDs",()=>{
  const original=data.cells[0]![0];
  const member={...original,feature_id:"bia_administrative_lar:area:001",records:original.records.map(record=>({...record,source_dataset_id:"bia_administrative_lar",feature_name:"Source area name"}))};
  render(<GovernanceMembershipInspector memberships={[member]} count={1} status="partial" sourceContext={{bia_administrative_lar:{country:"United States",agency:"Bureau of Indian Affairs",boundary_type:"BIA land-area reference",classification:"Original code retained undecoded"}}}/>);
  const section=screen.getByRole("region",{name:"Governance feature memberships"});
  for(const value of ["United States","Bureau of Indian Affairs","BIA land-area reference","bia_administrative_lar:area:001","Source area name"])expect(section).toHaveTextContent(value);
});

it("uses a plain county name in the heading while retaining source provenance separately", () => {
  const original = data.cells[0]![1];
  const member = {...original, records: original.records.map(record => ({...record,
    feature_type: "county_equivalent_statistical_reference", feature_name: "San Juan County", source_dataset_id: "census_counties_2025"}))};
  render(<GovernanceMembershipInspector memberships={[member]} count={1} status="partial"/>);
  expect(screen.getByRole("heading", {level: 4})).toHaveTextContent(/^San Juan County$/);
  expect(screen.getByRole("region", {name: "Governance feature memberships"})).toHaveTextContent("census_counties_2025");
});

it("keeps exclusion activity, permitted transit, exceptions and unknown effective dates inspectable",()=>{
 const member=data.cells[0]![0];
 render(<GovernanceMembershipInspector memberships={[member]} count={1} status="partial" sourceRecordContext={{[member.records[0].source_feature_id]:{restriction_category:"seabed_disturbance_restriction",prohibited_activity:"Anchoring and seabed disturbance",permitted_activity:"Ordinary transit permitted",effective_start:null,exceptions:"Remediation and source treaty provisions"}}}/>);
 expect(screen.getByText("Ordinary transit permitted")).toBeInTheDocument();
 expect(screen.getByText("Anchoring and seabed disturbance")).toBeInTheDocument();
 expect(screen.getByText("Remediation and source treaty provisions")).toBeInTheDocument();
});
