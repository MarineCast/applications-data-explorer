import {describe,expect,it,vi} from "vitest";
import {createHash,webcrypto} from "node:crypto";
import {decodeHumanGeometry,defaultHumanFilter,filteredHumanRecords,humanGeometryNote,humanVisibleFeatures} from "./humanGeometry";
import type {HumanFeature,HumanGeometryView} from "./humanGeometry";
import {humanOverlayData,installHumanGeometry,updateHumanGeometry,pickHumanGeometry,humanPointSource} from "./humanGeometryOverlay";
import type {Map as LibreMap} from "maplibre-gl";
import {loadSeascapeLayer} from "./seascape";
import type {SeascapeCatalog,SeascapeFeature} from "./seascape";
const record=(id:string,category:string,access:string):HumanFeature=>({type:"Feature",id,geometry:{type:"Point",coordinates:[-123,48]},properties:{record_id:id,group:"places",role:"record",name:id,category,location_method:"retained_catalog_point_not_verified_entrance",label_point:[-123,48],h3_index:"reference-only",attributes:{source_id:id,access:access==="restricted"?"private":null}}});
const a=record("Synthetic Park","park","unknown"),b=record("Synthetic Beach","beach","restricted");
const area:HumanFeature={...a,id:"source-park-area",geometry:{type:"Polygon",coordinates:[[[-123,48],[-123,48.1],[-123.1,48],[-123,48]]]},properties:{...a.properties,role:"source_footprint",location_method:"original_source_polygon_not_access_boundary"}};
const payload={schema:"human.native_features.v1",type:"FeatureCollection",features:[a,b,area]};
const data=()=>decodeHumanGeometry(payload,"places",2);
const view=():HumanGeometryView=>({data:data(),filter:{...defaultHumanFilter},opacity:.8,onSelect:vi.fn(),onBackground:vi.fn()});
describe("Human native locations",()=>{
 it("preserves all named identities, private attributes and source footprints",()=>{
  const result=data();expect(result.records).toEqual([a,b]);expect(result.footprints).toEqual([area]);
  expect(result.categories).toEqual(["beach","park"]);expect(result).not.toHaveProperty("accessStates");
  expect(humanGeometryNote(a)).toMatch(/not been verified/);
  expect(()=>decodeHumanGeometry({...payload,features:[a,a]},"places",2)).toThrow(/duplicate/);
  expect(()=>decodeHumanGeometry(payload,"places",3)).toThrow(/count/);
  expect(()=>decodeHumanGeometry({...payload,features:[b,area]},"places",1)).toThrow(/Unlinked/);
 });
 it("filters by category and search without derived access states",()=>{
  const result=data();expect(filteredHumanRecords(result,defaultHumanFilter)).toEqual([a,b]);
  expect(filteredHumanRecords(result,{...defaultHumanFilter,categories:["park"]})).toEqual([a]);
  expect(filteredHumanRecords(result,{...defaultHumanFilter,search:"private"})).toEqual([b]);
  expect(filteredHumanRecords(result,{...defaultHumanFilter,categories:[]})).toEqual([]);
  expect(humanOverlayData(view()).points.features[1].properties?.color).toBe("#ae7b28");
 });
 it("keeps original areas optional, linked to filtered records, with no fabricated H3 geometry",()=>{
  const input=view();expect(humanVisibleFeatures(input).footprints).toEqual([]);
  input.filter={...input.filter,showFootprints:true,categories:["park"]};expect(humanVisibleFeatures(input).footprints).toEqual([area]);
  const overlay=humanOverlayData(input);expect(overlay.points.features.map(f=>f.id)).toEqual([a.id]);expect(overlay.shapes.features[0].geometry).toEqual(area.geometry);
  input.filter.showRecords=false;expect(humanOverlayData(input).points.features).toEqual([]);expect(humanOverlayData(input).shapes.features).toHaveLength(1);
  input.filter.categories=[];expect(humanOverlayData(input).shapes.features).toEqual([]);
 });
 it("hides old overlays on domain change and selects individual record IDs",async()=>{
  const pointSource={setData:vi.fn(),getClusterExpansionZoom:vi.fn().mockResolvedValue(12)},shapeSource={setData:vi.fn()};
  const map={addSource:vi.fn(),addLayer:vi.fn(),getSource:vi.fn((id:string)=>id===humanPointSource?pointSource:shapeSource),setLayoutProperty:vi.fn(),setPaintProperty:vi.fn(),queryRenderedFeatures:vi.fn().mockReturnValue([{properties:{record_id:a.properties.record_id}}]),easeTo:vi.fn()} as unknown as LibreMap;
  installHumanGeometry(map);updateHumanGeometry(map,view());updateHumanGeometry(map,undefined);
  expect(pointSource.setData).toHaveBeenLastCalledWith({type:"FeatureCollection",features:[]});
  expect(map.setLayoutProperty).toHaveBeenCalledWith("human-native-points","visibility","none");
  const input=view();await pickHumanGeometry(map,input,{x:10,y:10});expect(input.onSelect).toHaveBeenCalledWith(a.properties.record_id);
 });
 it("loads checksum-bound native geometry as records rather than H3 cells",async()=>{
  const body=JSON.stringify(payload),binding={url:"/test-human-native-geometry",sha256:createHash("sha256").update(body).digest("hex")};
  const field={id:"HUMAN_NATIVE__places",productId:"test",column:"places",geometryGroup:"places",name:"Named Destinations",dataset:"human",kind:"categorical",rows:2,available:2,resolution:7,qualifiers:[],categories:["park","beach"],unit:"source records",range:[0,1],family:"Places",role:"native_source_geometry",sourceRelease:"Synthetic fixture",sourcePath:"test.geojson",sourceSha256:"fixture",definition:"Synthetic source records",modelingEligibility:"research_only",arrowType:"GeoJSON"} satisfies SeascapeFeature;
  const catalog={products:{test:{rows:999,cells:{url:"/must-not-read",sha256:"unused"},columns:{},sourceSha256:"test",sourcePath:"test",nativeFeatures:binding,nativeGroups:{places:{records:2,context_features:1}}}},features:[field]} as unknown as SeascapeCatalog;
  vi.stubGlobal("crypto",webcrypto);const fetcher=vi.fn().mockResolvedValue(new Response(body));vi.stubGlobal("fetch",fetcher);
  try{const layer=await loadSeascapeLayer(catalog,field);expect(layer.cells).toEqual([]);expect(layer.index.size).toBe(0);expect(layer.humanGeometry?.records).toEqual([a,b]);expect(fetcher).toHaveBeenCalledTimes(1);}finally{vi.unstubAllGlobals();}
 });
});
