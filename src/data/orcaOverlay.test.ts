import {describe,it,expect,vi} from "vitest";
import type {Map as LibreMap} from "maplibre-gl";
import {installOrcaOverlay,updateOrcaOverlay,pickOrcaPoint,orcaPointGeoJSON,orcaPointSource} from "./orcaOverlay";
import {orcaFixture} from "../test/orcaFixture";
describe("reported-coordinate overlay",()=>{
 it("uses actual reported coordinates and omits records without coordinates",()=>{const records=orcaFixture().records,onSelect=vi.fn();const data=orcaPointGeoJSON({records,onSelect,whaleMarkers:false});expect(data.features).toHaveLength(5);expect(data.features[0].geometry.coordinates).toEqual([-123.4,48.5]);expect(data.features.map(f=>f.id)).not.toContain("synthetic:unlocated");});
 it("clusters reports, expands clusters, lazily adds glyphs and picks record IDs",async()=>{
 const source={setData:vi.fn(),getClusterExpansionZoom:vi.fn().mockResolvedValue(10)};
 const map={addSource:vi.fn(),addLayer:vi.fn(),addImage:vi.fn(),getSource:vi.fn().mockReturnValue(source),setLayoutProperty:vi.fn(),queryRenderedFeatures:vi.fn(),easeTo:vi.fn()} as unknown as LibreMap;
 installOrcaOverlay(map);expect(map.addSource).toHaveBeenCalledWith(orcaPointSource,expect.objectContaining({cluster:true,clusterMaxZoom:12}));expect(map.addImage).not.toHaveBeenCalled();
 const view={records:orcaFixture().records,whaleMarkers:true,onSelect:vi.fn()};updateOrcaOverlay(map,view);updateOrcaOverlay(map,view);expect(map.addImage).toHaveBeenCalledTimes(3);
 vi.mocked(map.queryRenderedFeatures).mockReturnValue([{geometry:{type:"Point",coordinates:[-123.4,48.5]},properties:{cluster:true,cluster_id:9}}] as never);
 await pickOrcaPoint(map,view,{x:3,y:4});expect(source.getClusterExpansionZoom).toHaveBeenCalledWith(9);expect(map.easeTo).toHaveBeenCalledWith({center:[-123.4,48.5],zoom:10});expect(view.onSelect).not.toHaveBeenCalled();
 vi.mocked(map.queryRenderedFeatures).mockReturnValue([{properties:{event_id:"synthetic:mixed"}}] as never);await pickOrcaPoint(map,view,{x:3,y:4});expect(view.onSelect).toHaveBeenCalledWith("synthetic:mixed");
 updateOrcaOverlay(map,undefined);expect(source.setData).toHaveBeenLastCalledWith({type:"FeatureCollection",features:[]});expect(map.setLayoutProperty).toHaveBeenLastCalledWith("orca-point-cluster-count","visibility","none");
 });
});
