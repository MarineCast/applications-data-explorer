import { latLngToCell } from "h3-js";
import type { MeteorologyCatalog } from "../data/meteorology";

export const weatherFixture: MeteorologyCatalog = {
  version: 1, status: "validated_local_snapshot", snapshot: "a".repeat(64), resolution: 5, timezone: "UTC",
  dates: ["2026-10-06", "2026-10-07", "2026-10-08"],
  cells: [latLngToCell(48.5, -123.2, 5), latLngToCell(49, -124, 5)],
  metrics: [{ column: "TEMPERATURE_2M_C_MEAN", name: "Mean air temperature", family: "Temperature", hourlyColumn: "TEMPERATURE_2M_C",
    definition: "Daily mean 2 m air temperature.", unit: "degC", range: [-20, 40], available: 5, rows: 6, circular: false }],
  dailySeries: { TEMPERATURE_2M_C_MEAN: [4, 6, 8] },
  source: { attribution: "Copernicus / ECMWF, CC BY 4.0", sampling: "nearest quarter-degree ERA5 source",
    effective_resolution: "approximately 31 km; H3 adds no weather detail", run_date_utc: "2026-10-15T11:00:00Z",
    source_revision: "ERA5/ERA5T not distinguished", hourly_time: "UTC hour start; rainfall for following hour",
    null_policy: "complete support required", products: { daily: { sha256: "d".repeat(64) }, hourly: { sha256: "e".repeat(64) } } },
};
