import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import SourcePicker from "./SourcePicker";
import { featurePickerItem } from "../data/sourcePicker";
import type { SourcePickerItem } from "../data/sourcePicker";
import type { SeascapeCatalog, SeascapeFeature } from "../data/seascape";

const items: SourcePickerItem[] = [
  { id:"depth", name:"Mean depth", group:"Bathymetry", summary:"Source mean depth, positive down.", details:[{label:"Units",value:"m"}] },
  { id:"null", name:"Depth anomaly", group:"Bathymetry", summary:"No available values in this field.", unavailable:true, details:[] },
  { id:"governance", name:"Governance", group:"Products", summary:"Recorded inventory, not current law.", disabled:true, unavailable:true, details:[] },
];

it("scrolls keyboard choices inside a content-sized picker without scrolling the drawer", async () => {
  const user = userEvent.setup();
  const view = render(<section className="domain-layer-panel" style={{paddingBottom:16}}>
    <div className="layer-body"><SourcePicker label="Feature" items={items} value="depth" onChange={vi.fn()} /></div>
  </section>);
  const panel = view.container.querySelector<HTMLElement>(".domain-layer-panel")!;
  const trigger = screen.getByRole("button", {name:"Feature"});
  const panelBounds = vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({bottom:500} as DOMRect);
  const triggerBounds = vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({bottom:300} as DOMRect);
  try {
    await user.click(trigger);
    const popup = screen.getByRole("dialog", {name:"Feature picker"});

    const list = popup.querySelector<HTMLElement>(".source-picker-results")!;
    const last = screen.getByRole("button", {name:"About Governance"});
    const listBounds = vi.spyOn(list, "getBoundingClientRect").mockReturnValue({top:100,bottom:200} as DOMRect);
    const lastBounds = vi.spyOn(last, "getBoundingClientRect").mockReturnValue({top:400,bottom:444} as DOMRect);
    try {
      await user.keyboard("{End}");
      expect(last).toHaveFocus();
      expect(list.scrollTop).toBeGreaterThan(0);
      expect(panel.scrollTop).toBe(0);
      expect(panel.querySelector(".layer-body")!.scrollTop).toBe(0);

    } finally { listBounds.mockRestore(); lastBounds.mockRestore(); }
  } finally { panelBounds.mockRestore(); triggerBounds.mockRestore(); }
});

it("opens directly to grouped choices, shows information without selecting, and restores focus after dismissal", async () => {
  const change = vi.fn();
  render(<SourcePicker label="Feature" items={items} value="depth" onChange={change} />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name:"Feature" });
  await user.click(trigger);
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name:"Select Mean depth" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name:"About Depth anomaly" }));
  expect(screen.getByRole("region", { name:"About Depth anomaly" })).toHaveTextContent("No available values");
  expect(change).not.toHaveBeenCalled();
  expect(trigger).toHaveValue("depth");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name:"About Depth anomaly" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name:"Feature picker" })).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("supports keyboard selection, all-unavailable fields and disabled product information", async () => {
  function Host() {
    const [value,setValue] = useState("depth");
    return <SourcePicker label="Feature" items={items} value={value} onChange={setValue} />;
  }
  render(<Host />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name:"Feature" });
  await user.click(trigger);
  await user.keyboard("{ArrowUp}{Enter}");
  expect(trigger).toHaveValue("null");
  expect(trigger).toHaveTextContent("Depth anomaly");
  expect(trigger).toHaveFocus();
  await user.click(trigger);
  expect(screen.getByRole("button", { name:"Select Depth anomaly" })).toHaveFocus();
  await user.keyboard("{End}");
  expect(screen.getByRole("button", { name:"About Governance" })).toHaveFocus();
  const disabled = screen.getByRole("button", { name:"Select Governance" });
  expect(disabled).toBeDisabled();
  await user.click(screen.getByRole("button", { name:"About Governance" }));
  expect(within(screen.getByRole("region", { name:"About Governance" })).getByText(/not current law/)).toBeVisible();
  expect(trigger).toHaveValue("null");
  await user.click(document.body);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("copies the original metric name beside information without selecting or closing the picker", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const change = vi.fn();
  const view = render(<SourcePicker label="Feature" items={[{...items[0], name:"Bathymetry · mean depth (m)", copyText:"Bathymetry"}, items[1]]} value="null" onChange={change} copyable />);
  await user.click(screen.getByRole("button", { name:"Feature" }));
  const copy = screen.getByRole("button", { name:"Copy metric name: Bathymetry · mean depth (m)" });
  expect(copy.previousElementSibling).toHaveAccessibleName("About Bathymetry · mean depth (m)");
  await user.click(copy);
  expect(write).toHaveBeenCalledExactlyOnceWith("Bathymetry");
  expect(screen.getByText("Copied Bathymetry.")).toBeVisible();
  expect(copy).toHaveAttribute("title", "Copied");
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name:"Feature" })).toHaveValue("null");
  expect(screen.getByRole("dialog", { name:"Feature picker" })).toBeVisible();
  view.rerender(<SourcePicker label="Feature" items={items} value="depth" onChange={change} copyable={false} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByText("Copied Bathymetry.")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Copy metric name/ })).not.toBeInTheDocument();
  write.mockRestore();
});

it("reports clipboard failures without claiming the name was copied", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Permission denied"));
  render(<SourcePicker label="Feature" items={items} value="depth" onChange={vi.fn()} copyable />);
  await user.click(screen.getByRole("button", { name:"Feature" }));
  const copy = screen.getByRole("button", { name:"Copy metric name: Mean depth" });
  await user.click(copy);
  expect(screen.getByText(/Could not copy the metric name/)).toBeVisible();
  expect(copy).toHaveAttribute("title", "Copy metric name");
  expect(screen.queryByText("Copied Mean depth.")).not.toBeInTheDocument();
  write.mockRestore();
});

it("uses declared depth semantics and source definitions without inventing undeclared units or availability", () => {
  const field = { id:"depth", name:"Depth", family:"Bathymetry", unit:"Units unavailable", role:"original_source_field", definition:"Unchanged original source definition; no unit/CRS/scale/sign transformation.", sourcePath:"metrics/depth.parquet", available:0, rows:12, resolution:6 } as SeascapeFeature;
  const catalog = {} as SeascapeCatalog;
  const generic = featurePickerItem(field,catalog);
  expect(generic.summary).toContain("No additional field description");
  expect(generic.details).toContainEqual({label:"Units",value:"Units unavailable"});
  expect(generic.details).toContainEqual({label:"Available values",value:"0 of 12 cells"});
  expect(generic.unavailable).toBe(true);
  expect(generic.disabled).toBeUndefined();
  const depth = featurePickerItem({...field, unit:"m", measurement:{quantity:"depth",statistic:"mean",positiveDirection:"down"}},catalog);
  expect(depth.summary).toContain("Positive values run downward");
  expect(depth.copyText).toBe("Depth");
  const source = featurePickerItem({...field, definition:"A recorded inventory; coverage is unverified."},catalog);
  expect(source.summary).toBe("A recorded inventory; coverage is unverified.");
});

it("filters long variable lists by name or original field identity without changing the selection", async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const choices = Array.from({ length: 14 }, (_, i) => ({ ...items[0], id:`field_${i}`, name:`Measurement ${i}`, group:i < 10 ? "Measurements" : "Quality, coverage & processing" }));
  render(<SourcePicker label="Feature" items={choices} value="field_0" onChange={change} />);
  await user.click(screen.getByRole("button", { name:"Feature" }));
  const filter = screen.getByRole("searchbox", { name:"Filter feature" });
  expect(filter).toHaveFocus();
  await user.type(filter, "field_12");
  expect(screen.getByRole("button", { name:"Select Measurement 12" })).toBeVisible();
  expect(screen.queryByRole("button", { name:"Select Measurement 1" })).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(change).toHaveBeenCalledExactlyOnceWith("field_12");
});

it("distinguishes duplicate names while preserving their original names and units", () => {
  const first = { id:"residents__density", name:"Population density", family:"Resident population", unit:"source units", role:"original_source_field", available:1, rows:2, resolution:7, dataset:"human" } as SeascapeFeature;
  const second = { ...first, id:"residents__density_land" };
  const item = featurePickerItem(first, {features:[first,second]} as SeascapeCatalog);
  expect(item.secondary).toBe(first.id);
  expect(item.copyText).toBe(first.name);
  expect(item.details).toContainEqual({label:"Units",value:"Not supplied"});
});


it.each(["layer-body","comparison-setup-scroll"])("fits a dropdown into a short %s scrollport and refits an open menu on resize", async className=>{
 const user=userEvent.setup();
 const view=render(<div className={className}><SourcePicker label="Family" items={items} value="depth" onChange={vi.fn()}/></div>);
 const body=view.container.firstElementChild as HTMLElement;
 let height=180;
 Object.defineProperty(body,"clientHeight",{configurable:true,get:()=>height});
 const original=HTMLElement.prototype.getBoundingClientRect;
 const bounds=vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(function(this:HTMLElement){
   if(this===body)return {top:100,bottom:100+height} as DOMRect;
   if(this.classList.contains("source-picker-popup")){
     const top=210-body.scrollTop,h=parseFloat(this.style.maxHeight)||330;
     return {top,bottom:top+h,height:h} as DOMRect;
   }
   return original.call(this);
 });
 try {
   await user.click(screen.getByRole("button",{name:"Family"}));
   const popup=screen.getByRole("dialog",{name:"Family picker"});
   expect(popup).toHaveStyle({maxHeight:"180px"});
   expect(popup.getBoundingClientRect().top).toBeGreaterThanOrEqual(100);
   expect(popup.getBoundingClientRect().bottom).toBeLessThanOrEqual(280);
   height=120;act(()=>window.dispatchEvent(new Event("resize")));
   expect(popup).toHaveStyle({maxHeight:"120px"});
   expect(popup.getBoundingClientRect().bottom).toBeLessThanOrEqual(220);
 } finally { bounds.mockRestore(); }
});
