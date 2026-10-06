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
