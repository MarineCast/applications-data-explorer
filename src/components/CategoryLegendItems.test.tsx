import {useState} from "react";
import {render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {expect,it} from "vitest";
import CategoryLegendItems from "./CategoryLegendItems";
function Host({initial=["A","B","C"],count=3}:{initial?:string[];count?:number}){
 const [selection,setSelection]=useState(initial);
 const keys=count===3?["A","B","C"]:Array.from({length:count},(_,i)=>`Area ${i}`);
 return <><output aria-label="Selected categories">{selection.join(",")}</output><CategoryLegendItems identity="fixture" items={keys.map(key=>({key,label:key,color:"#123456",selected:selection.includes(key)}))} onSelectionChange={setSelection}/></>;
}
it("isolates and restores using the selection before the browser's two click events",async()=>{
 const user=userEvent.setup();render(<Host/>);
 const item=screen.getByRole("button",{name:"B"});
 await user.dblClick(item.querySelector("i")!);
 expect(screen.getByLabelText("Selected categories")).toHaveTextContent(/^B$/);
 expect(item).toHaveAttribute("aria-pressed","true");
 await user.dblClick(item);
 expect(screen.getByLabelText("Selected categories")).toHaveTextContent(/^A,B,C$/);
 await user.click(item);expect(item).toHaveAttribute("aria-pressed","false");
 item.focus();await user.keyboard("{Enter}");expect(item).toHaveAttribute("aria-pressed","true");
});
it.each([["A"],[],["A","C"]])("isolates a hidden category from %j, and switching isolated items does not restore all",async(...selection)=>{
 const user=userEvent.setup();render(<Host initial={selection}/>);
 await user.dblClick(screen.getByRole("button",{name:"B"}));
 expect(screen.getByLabelText("Selected categories")).toHaveTextContent(/^B$/);
 await user.dblClick(screen.getByRole("button",{name:"C"}));
 expect(screen.getByLabelText("Selected categories")).toHaveTextContent(/^C$/);
});
it("restores all categories, including items outside the search and page",async()=>{
 const user=userEvent.setup();render(<Host initial={[]} count={60}/>);
 await user.type(screen.getByRole("searchbox",{name:"Find legend category"}),"Area 59");
 await user.dblClick(screen.getByRole("button",{name:"Area 59"}));
 expect(screen.getByLabelText("Selected categories")).toHaveTextContent(/^Area 59$/);
 await user.dblClick(screen.getByRole("button",{name:"Area 59"}));
 expect(screen.getByLabelText("Selected categories").textContent?.split(",")).toHaveLength(60);
});
