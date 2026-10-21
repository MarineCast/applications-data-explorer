import {render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {it,expect,vi} from "vitest";
import {RiverInfluenceSettings} from "./RiverInfluenceControls";
import {riverInfluenceFixture} from "../test/riverInfluenceFixture";
it("keeps date and distance settings when changing flow lag weights",async()=>{
 const data=riverInfluenceFixture(),value={date:"2026-10-15",distance:"broad",lag:"now"},onChange=vi.fn();
 render(<RiverInfluenceSettings data={data} value={value} onChange={onChange}/>);
 await userEvent.selectOptions(screen.getByRole("combobox",{name:"Flow lag weights"}),"later");
 expect(onChange).toHaveBeenCalledWith({...value,lag:"later"});
 expect(screen.queryByRole("button",{name:/Go to previous pulse/})).not.toBeInTheDocument();
});
