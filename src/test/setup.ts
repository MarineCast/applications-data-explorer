import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
afterEach(cleanup);

// Fixture tests never use the locally configured basemap credential.
beforeEach(() => vi.stubEnv("VITE_MAPTILER_KEY", ""));
