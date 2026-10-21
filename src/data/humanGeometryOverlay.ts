import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Map as LibreMap, GeoJSONSource } from "maplibre-gl";
import {humanRecordColor,humanVisibleFeatures} from "./humanGeometry";
import type {HumanFeature,HumanGeometryView} from "./humanGeometry";

export const humanPointSource="human-native-points",humanShapeSource="human-native-shapes";
export const humanHitLayers=["human-native-clusters","human-native-points","human-native-lines","human-native-areas"];
const allLayers=[...humanHitLayers,"human-native-cluster-labels","human-native-area-outlines"];
function styled(feature:HumanFeature,selected?:string):Feature<Geometry>{return {...feature,properties:{record_id:feature.properties.record_id,
  selected:feature.properties.record_id===selected,color:humanRecordColor(feature),category:feature.properties.category}};}
export function humanOverlayData(view?:HumanGeometryView):{points:FeatureCollection;shapes:FeatureCollection}{
  const visible=view?humanVisibleFeatures(view):{records:[],footprints:[]};
  return {points:{type:"FeatureCollection",features:visible.records.filter(f=>f.geometry.type==="Point").map(f=>styled(f,view?.selected))},
    shapes:{type:"FeatureCollection",features:[...visible.records.filter(f=>f.geometry.type!=="Point"),...visible.footprints].map(f=>styled(f,view?.selected))}};
}
export function installHumanGeometry(map:LibreMap){
  const empty=humanOverlayData();
  map.addSource(humanPointSource,{type:"geojson",data:empty.points,cluster:true,clusterRadius:32,clusterMaxZoom:11});
  map.addSource(humanShapeSource,{type:"geojson",data:empty.shapes});
  map.addLayer({id:"human-native-areas",type:"fill",source:humanShapeSource,filter:["==",["geometry-type"],"Polygon"],layout:{visibility:"none"},paint:{"fill-color":["get","color"],"fill-opacity":.17}});
  map.addLayer({id:"human-native-area-outlines",type:"line",source:humanShapeSource,filter:["==",["geometry-type"],"Polygon"],layout:{visibility:"none"},paint:{"line-color":["get","color"],"line-width":1.4}});
  map.addLayer({id:"human-native-lines",type:"line",source:humanShapeSource,filter:["==",["geometry-type"],"LineString"],layout:{visibility:"none"},paint:{"line-color":["get","color"],"line-width":["case",["get","selected"],5,2.6]}});
  map.addLayer({id:"human-native-clusters",type:"circle",source:humanPointSource,filter:["has","point_count"],layout:{visibility:"none"},paint:{"circle-color":"#365e70","circle-radius":["step",["get","point_count"],14,20,18,100,23],"circle-stroke-color":"#fffdf7","circle-stroke-width":1.5}});
  map.addLayer({id:"human-native-cluster-labels",type:"symbol",source:humanPointSource,filter:["has","point_count"],layout:{visibility:"none","text-field":"{point_count_abbreviated}","text-size":12},paint:{"text-color":"#fffdf7"}});
  map.addLayer({id:"human-native-points",type:"circle",source:humanPointSource,filter:["!",["has","point_count"]],layout:{visibility:"none"},paint:{"circle-color":["get","color"],"circle-radius":["case",["get","selected"],7,4.8],"circle-stroke-color":["case",["get","selected"],"#e39a61","#fffdf7"],"circle-stroke-width":["case",["get","selected"],3,1.4]}});
}
export function updateHumanGeometry(map:LibreMap,view?:HumanGeometryView){
  const points=map.getSource(humanPointSource) as GeoJSONSource|undefined,shapes=map.getSource(humanShapeSource) as GeoJSONSource|undefined;
  if(!points||!shapes)return;
  const data=humanOverlayData(view);points.setData(data.points);shapes.setData(data.shapes);
  for(const id of allLayers)map.setLayoutProperty(id,"visibility",view?"visible":"none");
  if(view){map.setPaintProperty("human-native-points","circle-opacity",view.opacity);map.setPaintProperty("human-native-lines","line-opacity",view.opacity);map.setPaintProperty("human-native-areas","fill-opacity",view.opacity*.2);}
}
export async function pickHumanGeometry(map:LibreMap,view:HumanGeometryView,point:{x:number;y:number}){
  const hit=map.queryRenderedFeatures([point.x,point.y],{layers:humanHitLayers})[0];
  if(!hit){view.onBackground();return;}
  if(hit.properties?.cluster&&hit.geometry.type==="Point"){
    const zoom=await (map.getSource(humanPointSource) as GeoJSONSource).getClusterExpansionZoom(Number(hit.properties.cluster_id));
    map.easeTo({center:hit.geometry.coordinates as [number,number],zoom});
  }else if(typeof hit.properties?.record_id==="string")view.onSelect(hit.properties.record_id);
}
