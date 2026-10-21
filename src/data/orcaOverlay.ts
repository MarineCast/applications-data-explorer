import type { FeatureCollection, Point } from "geojson";
import type { Map as LibreMap, GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import {orcaCategoryColors,orcaCategories} from "./orca";
import type {OrcaSighting} from "./orca";
export interface OrcaPoints {records:readonly OrcaSighting[];selected?:string;whaleMarkers:boolean;onSelect:(id:string)=>void;}
export const orcaPointSource="orca-sighting-points";
export const orcaPointHitLayers=["orca-point-clusters","orca-points","orca-point-whales"];
export function orcaPointGeoJSON(view?:OrcaPoints):FeatureCollection<Point>{return {type:"FeatureCollection",features:(view?.records??[]).filter(r=>r.latitude!==null&&r.longitude!==null).map(r=>({type:"Feature",id:r.event_id,geometry:{type:"Point",coordinates:[r.longitude!,r.latitude!]},properties:{event_id:r.event_id,category:r.category,selected:r.event_id===view?.selected}}))};}
/** Small code-drawn whale glyph: decorative report marker, never an individual whale count. */
export function whaleImage(color:string){
 const width=32,height=32,data=new Uint8Array(width*height*4),rgb=[1,3,5].map(n=>parseInt(color.slice(n,n+2),16));
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const body=((x-15)/11)**2+((y-17)/7)**2<=1;
  const tail=x>=24&&x<=31&&Math.abs(y-17)>=Math.max(0,5-(x-24))&&Math.abs(y-17)<=7;
  const fin=y>=20&&y<=27&&x>=13&&x<=18-(y-20)/2;
  const spout=y>=4&&y<=10&&(Math.abs(x-9)<=1||(y<7&&Math.abs(x-9)<=4));
  if(body||tail||fin||spout){const i=(y*width+x)*4;data.set([...rgb,255],i);}
 }
 return {width,height,data};
}
const glyphMaps=new WeakSet<LibreMap>();
const previousData=new WeakMap<LibreMap,{records:readonly OrcaSighting[]|undefined;selected:string|undefined}>();
export function installOrcaOverlay(map:LibreMap){
 map.addSource(orcaPointSource,{type:"geojson",data:orcaPointGeoJSON(),cluster:true,clusterRadius:40,clusterMaxZoom:12,clusterProperties:{srkw:["+",["case",["==",["get","category"],"srkw"],1,0]],transient:["+",["case",["==",["get","category"],"transient"],1,0]],other:["+",["case",["==",["get","category"],"other"],1,0]]}});
 const color=["match",["get","category"],"srkw",orcaCategoryColors.srkw,"transient",orcaCategoryColors.transient,orcaCategoryColors.other] as ExpressionSpecification;
 map.addLayer({id:"orca-point-clusters",type:"circle",source:orcaPointSource,filter:["has","point_count"],layout:{visibility:"none"},paint:{"circle-color":["case",["==",["get","srkw"],["get","point_count"]],orcaCategoryColors.srkw,["==",["get","transient"],["get","point_count"]],orcaCategoryColors.transient,["==",["get","other"],["get","point_count"]],orcaCategoryColors.other,"#44667b"],"circle-radius":["step",["get","point_count"],15,20,19,100,24],"circle-stroke-color":"#fffefb","circle-stroke-width":2}});
 map.addLayer({id:"orca-point-cluster-count",type:"symbol",source:orcaPointSource,filter:["has","point_count"],layout:{visibility:"none","text-field":"{point_count_abbreviated}","text-size":12},paint:{"text-color":"#ffffff"}});
 map.addLayer({id:"orca-points",type:"circle",source:orcaPointSource,filter:["!",["has","point_count"]],layout:{visibility:"none"},paint:{"circle-color":[...color],"circle-radius":["case",["get","selected"],7,4.5],"circle-stroke-color":["case",["get","selected"],"#D68D63","#fffefb"],"circle-stroke-width":["case",["get","selected"],3,1.5]}});
 map.addLayer({id:"orca-point-whales",type:"symbol",source:orcaPointSource,filter:["!",["has","point_count"]],layout:{visibility:"none","icon-image":["concat","orca-whale-",["get","category"]],"icon-size":1,"icon-allow-overlap":false}});
}
export function updateOrcaOverlay(map:LibreMap,view?:OrcaPoints){
 const source=map.getSource(orcaPointSource) as GeoJSONSource|undefined;if(!source)return;
 if(view?.whaleMarkers&&!glyphMaps.has(map)){for(const category of orcaCategories)map.addImage(`orca-whale-${category}`,whaleImage(orcaCategoryColors[category]),{pixelRatio:2});glyphMaps.add(map);}
 const previous=previousData.get(map);
 if(!previous||previous.records!==view?.records||previous.selected!==view?.selected){source.setData(orcaPointGeoJSON(view));previousData.set(map,{records:view?.records,selected:view?.selected});}
 for(const id of [...orcaPointHitLayers,"orca-point-cluster-count"]){const glyph=id==="orca-point-whales",circle=id==="orca-points";map.setLayoutProperty(id,"visibility",view&&(!glyph||view.whaleMarkers)&&(!circle||!view.whaleMarkers)?"visible":"none");}
}
export async function pickOrcaPoint(map:LibreMap,view:OrcaPoints,point:{x:number;y:number}){
 const feature=map.queryRenderedFeatures([point.x,point.y],{layers:orcaPointHitLayers})[0];
 if(!feature)return;
 if(feature.properties?.cluster&&feature.geometry.type==="Point"){
  const zoom=await (map.getSource(orcaPointSource) as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties.cluster_id));
  map.easeTo({center:feature.geometry.coordinates as [number,number],zoom});
 }else if(typeof feature.properties?.event_id==="string")view.onSelect(feature.properties.event_id);
}
