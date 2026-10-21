import type { Feature, Geometry } from "geojson";
import type { ReactNode } from "react";

export interface HumanProperties {
  record_id: string; group: string; role: "record" | "source_footprint";
  name: string | null; category: string;
  location_method: string; label_point: [number, number]; h3_index: string;
  attributes: Record<string, unknown>;
  source_geometry_valid?: boolean; source_geometry_wkb_sha256?: string;
}
export type HumanFeature = Feature<Geometry, HumanProperties>;
export interface HumanGeometryData {
  group: string; records: HumanFeature[]; footprints: HumanFeature[];
  categories: string[];
}
export interface HumanGeometryFilter {
  categories: string[] | null;
  search: string; showRecords: boolean; showFootprints: boolean;
}
export const defaultHumanFilter: HumanGeometryFilter = {
  categories: null, search: "", showRecords: true, showFootprints: false,
};
export interface HumanGeometryView {
  data: HumanGeometryData; filter: HumanGeometryFilter; selected?: string; opacity: number;
  onSelect: (id: string) => void; onBackground: () => void; popup?: ReactNode;
}
export function humanCategoryLabel(value: string) {
  const names: Record<string,string> = {port:"Ports",boat_launch:"Boat launches",beach:"Beaches",park:"Parks",marina:"Marinas",
    viewpoint:"Viewpoints",lighthouse:"Lighthouses",ferry_terminal:"Ferry terminals",pier:"Piers",slipway:"Slipways",
    trailhead:"Trailheads",recreation_site:"Recreation sites",beach_resort:"Beach resorts",unclassified:"Other / unclassified"};
  return names[value] ?? value.replaceAll("_", " ").replace(/\b\w/g,c=>c.toUpperCase());
}
export function humanRecordName(feature: HumanFeature) {
  return feature.properties.name?.trim() || `Unnamed ${humanCategoryLabel(feature.properties.category).toLowerCase()} · ${feature.properties.attributes.ACCESS_SITE_ID ?? feature.properties.record_id}`;
}
export function humanGeometryNote(feature: HumanFeature) {
  if (feature.properties.category === "port") return "Original NGA World Port Index point; a partial physical port inventory. Source harbor and facility codes remain uninterpreted; the point does not define a port footprint or legal jurisdiction.";
  const method=feature.properties.location_method;
  if(method.includes("make_valid"))return "Source polygon repaired for display; original geometry is checksum-linked. This is not a legal access boundary.";
  if(method.includes("marine_facing"))return "Marine-facing representative location derived from the source park area; this is not a surveyed entrance.";
  if(feature.geometry.type!=="Point")return "Original source line or area; its label point is not an entrance. Source access classifications and restrictions apply.";
  if(method.includes("representative")||method.includes("not_verified"))return "Retained representative/catalog location; an entrance or current public access has not been verified.";
  return "Source point location. Mapping alone does not establish current access, operation or use.";
}
export function humanCategoryColor(category:string) {
  const colors:Record<string,string>={port:"#465da7",boat_launch:"#216da1",marina:"#297d81",park:"#47744a",beach:"#ae7b28",viewpoint:"#77649b",ferry_terminal:"#425d94",lighthouse:"#9b5c66",pier:"#6b635a"};
  return colors[category]??"#426c74";
}
export function humanRecordColor(feature: HumanFeature) {
  return humanCategoryColor(feature.properties.category);
}
function validGeometry(geometry:Geometry):boolean {
  if(!geometry||!["Point","MultiPoint","LineString","MultiLineString","Polygon","MultiPolygon","GeometryCollection"].includes(geometry.type))return false;
  if(geometry.type==="GeometryCollection")return geometry.geometries.length>0&&geometry.geometries.every(validGeometry);
  const coordinates=(value:unknown):boolean=>Array.isArray(value)&&value.length>0&&(typeof value[0]==="number"
    ? value.length>=2&&value.every(v=>typeof v==="number"&&Number.isFinite(v))&&Math.abs(value[0])<=180&&Math.abs(value[1] as number)<=90
    : value.every(coordinates));
  return coordinates(geometry.coordinates);
}
export function decodeHumanGeometry(payload:unknown,group:string,expectedRows:number):HumanGeometryData {
  const value=payload as {schema?:string;type?:string;features?:HumanFeature[]};
  if(value.schema!=="human.native_features.v1"||value.type!=="FeatureCollection"||!Array.isArray(value.features))throw Error("Unsupported Human native geometry contract.");
  const ids=new Set<string|number>();
  for(const f of value.features){
    const p=f.properties;
    if(f.type!=="Feature"||f.id===undefined||ids.has(f.id)||!p||typeof p.record_id!=="string"||typeof p.group!=="string"||typeof p.category!=="string"||typeof p.location_method!=="string"||!["record","source_footprint"].includes(p.role)||!validGeometry(f.geometry)||
      !Array.isArray(p.label_point)||p.label_point.length!==2||!p.label_point.every(Number.isFinite)||!p.attributes||typeof p.attributes!=="object")throw Error("Invalid or duplicate Human source geometry.");
    ids.add(f.id);
  }
  const selected=value.features.filter(f=>f.properties.group===group);
  const records=selected.filter(f=>f.properties.role==="record");
  const recordIds=new Set(records.map(f=>f.properties.record_id));
  if(records.length!==expectedRows||recordIds.size!==records.length)throw Error("Human record count/identity mismatch.");
  const footprints=selected.filter(f=>f.properties.role==="source_footprint");
  if(footprints.some(f=>!recordIds.has(f.properties.record_id)))throw Error("Unlinked Human source footprint.");
  return {group,records,footprints,categories:[...new Set(records.map(f=>f.properties.category))].sort()};
}
export function filteredHumanRecords(data:HumanGeometryData,filter:HumanGeometryFilter) {
  const query=filter.search.trim().toLocaleLowerCase();
  return data.records.filter(f=>(filter.categories===null||filter.categories.includes(f.properties.category))&&
    (!query||`${humanRecordName(f)} ${f.properties.record_id} ${JSON.stringify(f.properties.attributes)}`.toLocaleLowerCase().includes(query)));
}
export function humanVisibleFeatures(view:HumanGeometryView) {
  const records=filteredHumanRecords(view.data,view.filter),ids=new Set(records.map(f=>f.properties.record_id));
  return {records:view.filter.showRecords?records:[],footprints:view.filter.showFootprints?view.data.footprints.filter(f=>ids.has(f.properties.record_id)):[]};
}
