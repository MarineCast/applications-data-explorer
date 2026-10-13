import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CoordinatePopup from "./CoordinatePopup";
import { coordinatePopupPosition, coordinateText } from "../data/mapCoordinates";

describe("map coordinate popup", () => {
  it("copies latitude first with six decimals and reports successful clipboard writes", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<CoordinatePopup coordinates={{ lat: 48.1234567, lon: -123.7654321, left: 10, top: 20 }} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Copy coordinates" }));
    expect(write).toHaveBeenCalledWith("48.123457, -123.765432");
    expect(screen.getByRole("status")).toHaveTextContent("Coordinates copied.");
    write.mockRestore();
  });
  it("offers selectable coordinate text if clipboard access fails, and closes with Escape", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    const close = vi.fn();
    render(<CoordinatePopup coordinates={{ lat: 48, lon: -123, left: 10, top: 20 }} onClose={close} />);
    await user.click(screen.getByRole("button", { name: "Copy coordinates" }));
    expect(screen.getByRole("status")).toHaveTextContent("Select the text and copy it");
    expect(screen.getByLabelText("Latitude, longitude")).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText("Latitude, longitude"), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    write.mockRestore();
  });
  it("wraps repeated world longitudes, avoids negative zero and keeps the popup inside small viewports", () => {
    expect(coordinateText(48.5, 237)).toBe("48.500000, -123.000000");
    expect(coordinateText(-.0000001, -.0000001)).toBe("0.000000, 0.000000");
    expect(coordinatePopupPosition(388, 780, 390, 782)).toEqual({ left: 150, top: 602 });
    expect(coordinatePopupPosition(-20, -20, 200, 150)).toEqual({ left: 8, top: 8 });
  });
});
