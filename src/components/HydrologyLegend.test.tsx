import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { HydrologyLegend } from "./HydrologyControls";
import { hydrologyFixture } from "../test/hydrologyFixture";
import { defaultHydrologyAppearance, hydrologyPaletteColors } from "../data/hydrologyOverlay";
import type { HydrologyAppearance } from "../data/hydrologyOverlay";
const data=hydrologyFixture();
it("opens palettes and Advanced from the river legend, applies edits, resets and dismisses with Escape", async () => {
 const changed=vi.fn(), user=userEvent.setup();
 function Host(){const[appearance,setAppearance]=useState(defaultHydrologyAppearance);return <HydrologyLegend data={data} metric="discharge_mean" day="2026-09-25" onInspect={()=>{}} appearance={appearance} onAppearanceChange={value=>{changed(value);setAppearance(value);}}/>;}
 render(<Host/>);
 expect(screen.getByRole("region",{name:"River legend"})).toHaveTextContent("Fraser0");
 await user.click(screen.getByRole("button",{name:"Color options"}));
 const popup=screen.getByRole("dialog",{name:"Map color options"});
 await user.click(within(popup).getByRole("radio",{name:"Viridis"}));
 expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({palette:"viridis",colors:hydrologyPaletteColors(data,"viridis")}));
 await user.click(within(popup).getByText("Advanced",{exact:true}));
 fireEvent.change(within(popup).getByLabelText("Fraser river color"),{target:{value:"#cc6633"}});
 expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({palette:"custom",colors:expect.objectContaining({fraser:"#cc6633"})}));
 fireEvent.change(within(popup).getByRole("slider",{name:"Bubble opacity"}),{target:{value:"0.44"}});
 expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({opacity:.44}));
 fireEvent.change(within(popup).getByRole("slider",{name:"Bubble size"}),{target:{value:"12"}});
 expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({radius:12}));
 await user.click(within(popup).getByRole("button",{name:"Restore defaults"}));
 expect(changed).toHaveBeenLastCalledWith(defaultHydrologyAppearance);
 await user.keyboard("{Escape}");expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(screen.getByRole("button",{name:"Color options"})).toHaveFocus();
});
it("keeps missingness notes and river inspection available alongside appearance settings", async()=>{
 const inspect=vi.fn(),changed=vi.fn<(v:HydrologyAppearance)=>void>(),user=userEvent.setup();
 render(<HydrologyLegend data={data} metric="temperature_mean" day="2026-09-25" onInspect={inspect} appearance={defaultHydrologyAppearance} onAppearanceChange={changed}/>);
 expect(screen.getByRole("region",{name:"River legend"})).toHaveTextContent("CowichanUnavailable");
 await user.hover(screen.getByRole("button",{name:"Legend information"}));expect(screen.getByRole("tooltip")).toHaveTextContent("A measured zero remains a filled bubble");
 await user.unhover(screen.getByRole("button",{name:"Legend information"}));
 await user.click(screen.getByRole("button",{name:"Color options"}));await user.click(screen.getByText("Advanced",{exact:true}));
 await user.click(screen.getByRole("button",{name:"Inspect Fraser river"}));expect(inspect).toHaveBeenCalledWith("fraser");
});
