import { expect, it, vi } from "vitest";
import type { Map as LibreMap } from "maplibre-gl";
import { hydrologyFixture } from "../test/hydrologyFixture";
import { defaultHydrologyAppearance, hydrologyPointGeoJSON, hydrologyRiverColor, installHydrologyOverlay, updateHydrologyOverlay, pickHydrologyPoint, hydrologyPointLayer } from "./hydrologyOverlay";
it("retains exact mouth coordinates, distinct co-located rivers and measured zero versus missing", () => {
  const data = hydrologyFixture(true), view = {data, metric:"discharge_mean" as const, day:"2026-09-25", onSelect:vi.fn()};
  const nodes = hydrologyPointGeoJSON(view);
  expect(nodes.features).toHaveLength(2);
  expect(nodes.features[0].geometry.coordinates).toEqual([data.rivers[0].mouths[0].longitude, data.rivers[0].mouths[0].latitude]);
  expect(nodes.features.map(f=>f.properties?.river)).toEqual(["fraser", "cowichan"]);
  expect(nodes.features[0].properties).toMatchObject({value:0, missing:false, color:hydrologyRiverColor("fraser")});
  expect(hydrologyPointGeoJSON({...view,day:"2026-09-26"}).features[0].properties).toMatchObject({value:null, missing:true});
  expect(hydrologyPointGeoJSON({...view,data:{...data,rivers:[...data.rivers].reverse()}}).features.find(f=>f.properties?.river==="fraser")?.properties?.color).toBe(hydrologyRiverColor("fraser"));
});
it("keeps multiple mouth markers tied to one river color and does not add series or values", () => {
  const data=hydrologyFixture(); data.rivers=[{...data.rivers[0],mouths:[...data.rivers[0].mouths,{...data.rivers[0].mouths[0],mouth_id:"other-mouth"}]},data.rivers[1]];
  const nodes=hydrologyPointGeoJSON({data,metric:"discharge_mean",day:data.dates[0],onSelect:vi.fn()});
  expect(nodes.features).toHaveLength(3); expect(nodes.features.slice(0,2).map(f=>f.properties?.color)).toEqual([hydrologyRiverColor("fraser"),hydrologyRiverColor("fraser")]);
  expect(data.rivers).toHaveLength(2);
});
it("installs, selects and clears the bubble overlay independently of hex cells", () => {
  const source={setData:vi.fn()}, map={addSource:vi.fn(),addLayer:vi.fn(),getSource:()=>source,setLayoutProperty:vi.fn(),setPaintProperty:vi.fn(),queryRenderedFeatures:vi.fn().mockReturnValue([{properties:{river:"fraser"}},{properties:{river:"cowichan"}}])} as unknown as LibreMap;
  const view={data:hydrologyFixture(),metric:"discharge_mean" as const,day:"2026-09-30",selected:"fraser",onSelect:vi.fn()};
  installHydrologyOverlay(map); updateHydrologyOverlay(map,view); pickHydrologyPoint(map,view,{x:10,y:20});
  expect(view.onSelect).toHaveBeenCalledWith("cowichan");
  updateHydrologyOverlay(map); expect(source.setData).toHaveBeenLastCalledWith({type:"FeatureCollection",features:[]});
  expect(map.setLayoutProperty).toHaveBeenLastCalledWith(hydrologyPointLayer,"visibility","none");
});

it("applies edited river colors, radius and opacity to the rendered bubble data",()=>{
 const appearance={...defaultHydrologyAppearance,colors:{fraser:"#cc6633"},radius:12,opacity:.44};
 const view={data:hydrologyFixture(),metric:"discharge_mean" as const,day:"2026-09-25",appearance,onSelect:vi.fn()};
 const source={setData:vi.fn()}, map={getSource:()=>source,setPaintProperty:vi.fn(),setLayoutProperty:vi.fn()} as unknown as LibreMap;
 updateHydrologyOverlay(map,view);
 expect(hydrologyPointGeoJSON(view).features[0].properties).toMatchObject({color:"#cc6633",radius:12});
 expect(map.setPaintProperty).toHaveBeenCalledWith(hydrologyPointLayer,"circle-opacity",["case",["get","missing"],0,.44]);
});

it("assigns distinct stable colors to the ten curated rivers while retaining prior identities", () => {
 const prior = {fraser:"#3686B8",cowichan:"#C87A45",skagit:"#8B72C4",snohomish:"#C65D83",nooksack:"#339886",columbia:"#B09A36"};
 for (const [id,color] of Object.entries(prior)) expect(hydrologyRiverColor(id)).toBe(color);
 const ids=[...Object.keys(prior),"puyallup","elwha","skokomish","queets"];
 expect(new Set(ids.map(id=>hydrologyRiverColor(id))).size).toBe(10);
 const data=hydrologyFixture();
 data.rivers=ids.map(id=>({...data.rivers[0],id,name:id}));
 const nodes=hydrologyPointGeoJSON({data,metric:"discharge_mean",day:data.dates[0],onSelect:vi.fn()});
 expect(nodes.features).toHaveLength(10);
 expect(nodes.features.map(f=>f.properties?.river)).toEqual(ids);
});
