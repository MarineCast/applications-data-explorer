import { afterEach, expect, it, vi } from "vitest";
import { loadHourlyWeather, loadMeteorologyCatalog, loadMeteorologyLayer, withMeteorology } from "./meteorology";
import { weatherFixture } from "../test/weatherFixture";
import type { SeascapeCatalog } from "./seascape";

afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });

it("accepts checked native R5 UTC data and fails closed on wrong time or cell grain", async () => {
  const fetch = vi.fn().mockResolvedValue(response(weatherFixture));
  vi.stubGlobal("fetch", fetch);
  expect((await loadMeteorologyCatalog())?.dates).toEqual(weatherFixture.dates);
  fetch.mockResolvedValue(response({ ...weatherFixture, timezone: "local" }));
  await expect(loadMeteorologyCatalog()).rejects.toThrow("validated daily UTC");
  fetch.mockResolvedValue(response({ ...weatherFixture, dates: ["2026-10-06", "2026-10-08"] }));
  await expect(loadMeteorologyCatalog()).rejects.toThrow("validated daily UTC");
});

it("maps only the requested native day, preserving zero, null, identity and source units", async () => {
  const catalog = withMeteorology({ features: [] } as unknown as SeascapeCatalog, weatherFixture);
  const field = catalog.features[0];
  const payload = { snapshot: weatherFixture.snapshot, date: "2026-10-07", metric: field.column, ids: weatherFixture.cells, values: [0, null] };
  const fetch = vi.fn().mockResolvedValue(response(payload));
  vi.stubGlobal("fetch", fetch);
  const layer = await loadMeteorologyLayer(catalog, field, "2026-10-07");
  expect([...layer.values.values()]).toEqual([0, null]);
  expect([...layer.index.keys()]).toEqual(weatherFixture.cells);
  expect(layer.resolution).toBe(5);
  expect(layer.unit).toBe("degC");
  expect(layer.slice?.value).toBe("2026-10-07");
  expect(fetch.mock.calls[0][0]).toContain("operation=daily");
  expect(fetch.mock.calls[0][0]).toContain("date=2026-10-07");
  fetch.mockResolvedValue(response({ ...payload, date: "2026-10-08", snapshot: "wrong" }));
  await expect(loadMeteorologyLayer(catalog, field, "2026-10-08")).rejects.toThrow("snapshot mismatch");
});

it("checks all 24 UTC hours and does not replace missing hourly values with zero", async () => {
  const day = weatherFixture.dates[0], metric = weatherFixture.metrics[0].column;
  const payload = { snapshot: weatherFixture.snapshot, date: day, metric, cell: null, hourlyColumn: "TEMPERATURE_2M_C",
    values: Array.from({ length:24 }, (_, i) => i === 5 ? null : i), counts: Array.from({ length:24 }, (_, i) => i === 5 ? 0 : 2),
    hours: Array.from({ length:24 }, (_, i) => `${day}T${String(i).padStart(2, "0")}:00:00Z`) };
  const fetch = vi.fn().mockResolvedValue(response(payload));
  vi.stubGlobal("fetch", fetch);
  expect((await loadHourlyWeather(weatherFixture, day, metric)).values[5]).toBeNull();
  fetch.mockResolvedValue(response({ ...payload, hours: payload.hours.slice(1) }));
  await expect(loadHourlyWeather(weatherFixture, day, metric)).rejects.toThrow("Invalid hourly");
});

it("shares in-flight period reads and caches separately from daily frames", async () => {
  const weather = {...weatherFixture,snapshot:"c".repeat(64),dates:["2026-10-01"]};
  const catalog = withMeteorology({features:[]} as unknown as SeascapeCatalog,weather);
  const field = catalog.features[0];
  let complete!: (response: Response)=>void;
  const fetch = vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{complete=resolve;}));
  vi.stubGlobal("fetch",fetch);
  const a=loadMeteorologyLayer(catalog,field,"month:2026-10-01"),b=loadMeteorologyLayer(catalog,field,"month:2026-10-01");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain("period=month");
  complete(response({snapshot:weather.snapshot,date:"2026-10-01",metric:field.column,period:"month",ids:weather.cells,values:[12,null]}));
  const layers=await Promise.all([a,b]);
  expect(layers[0].slice?.label).toBe("Oct 2026");
  expect([...layers[1].values.values()]).toEqual([12,null]);
  await loadMeteorologyLayer(catalog,field,"month:2026-10-01");
  expect(fetch).toHaveBeenCalledTimes(1);
});
