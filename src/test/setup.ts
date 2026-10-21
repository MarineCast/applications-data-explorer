import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
afterEach(cleanup);

// Fixture tests never use the locally configured basemap credential.
beforeEach(() => vi.stubEnv("VITE_MAPTILER_KEY", ""));

// jsdom lacks native dialog methods; behavior is also checked in the browser.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};

// jsdom has popover UA styles but no opening API. Native Safari QA verifies
// top-layer rendering; this shim keeps component interactions testable.
HTMLElement.prototype.showPopover = function () {
  this.style.display = "block";
};

// Browser QA covers real canvas drawing; jsdom has no canvas renderer.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
