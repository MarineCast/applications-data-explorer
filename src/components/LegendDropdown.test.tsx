import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import LegendDropdown from "./LegendDropdown";

it("requests the browser top layer from a clipped legend and keeps popup clicks active", async () => {
  const showPopover = vi.spyOn(HTMLElement.prototype, "showPopover");
  const change = vi.fn(), user = userEvent.setup();
  try {
    render(<div style={{ overflow:"hidden", maxHeight:120 }}><LegendDropdown label="Test legend" popupLabel="Test appearance" preview="Legend">
      <button onClick={change}>Change palette</button>
    </LegendDropdown></div>);
    const trigger=screen.getByRole("button", {name:"Color options"});
    await user.click(trigger);
    const popup=screen.getByRole("dialog", {name:"Test appearance"});
    expect(popup).toHaveAttribute("popover","manual");
    expect(showPopover).toHaveBeenCalled();
    expect(showPopover.mock.instances).toContain(popup);
    await user.click(screen.getByRole("button", {name:"Change palette"}));
    expect(change).toHaveBeenCalledOnce();
    expect(popup).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  } finally {
    showPopover.mockRestore();
  }
});
