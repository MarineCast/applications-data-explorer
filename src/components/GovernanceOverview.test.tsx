import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import GovernanceOverview from "./GovernanceOverview";
import type { MapLayer } from "../data/map";
it("counts every overlapping country assignment without folding unknown or verified empty cells into mapped counts",()=>{
 const layer={cells:[{id:"both"},{id:"us"},{id:"unknown"},{id:"empty"}],categoryMemberships:new Map([["both",[0,1]],["us",[0]],["unknown",null],["empty",[]]]),categories:["US: 001","Canada: 001"],categoryKeys:["us:001","ca:001"]} as unknown as MapLayer;
 render(<GovernanceOverview layer={layer} colors={["red","blue"]}/>);
 expect(screen.getByText("Mapped cells").nextSibling).toHaveTextContent("2");
 expect(screen.getByText("Overlapping").nextSibling).toHaveTextContent("1");
 expect(screen.getByText("Unknown").nextSibling).toHaveTextContent("1");
 expect(screen.getByText("US: 001").parentElement).toHaveTextContent("2");
 expect(screen.getByText("Canada: 001").parentElement).toHaveTextContent("1");
 expect(screen.getByText(/1 cells have verified empty/)).toBeInTheDocument();
});
