import {
  Anchor, Building2, Compass, Droplets, Fish, Gauge, Landmark, Layers3, createLucideIcon,
  Leaf, MapPin, Mountain, ShieldCheck, Ship, Shell, Sprout, Users, Waves, Waypoints, Thermometer, Wind, Cloud, CloudRain,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NativeResolution, SeascapeCatalog, SeascapeFeature } from "../data/seascape";
import { waterAssignmentColumn, internationalBoundaryColumn } from "../data/waterAssignments";
import { featurePickerItem } from "../data/sourcePicker";
import { administrativeBoundariesFamily } from "../data/administrativeBoundaries";
import { managementAreasFamily } from "../data/managementAreas";
import SourcePicker from "./SourcePicker";

const Rock = createLucideIcon("Rock", [
  ["path", { d: "m3 16 2-7 7-4 7 3 2 9-5 3H7Z", key: "outline" }],
  ["path", { d: "m5 9 6 4 8-5M11 13l-4 7m4-7 5 7", key: "facets" }],
]);

const familyIcons: Record<string, LucideIcon> = {
  Anthropogenic: Building2,
  [administrativeBoundariesFamily]: Layers3,
  Bathymetry: Mountain,
  Bivalve: Shell,
  "Biogenic Habitats": Sprout,
  "Coastal Bounds": Compass,
  "Coastal Environment": Waves,
  Estuary: Waves,
  Freshwater: Droplets,
  Kelp: Sprout,
  Seagrass: Leaf,
  Shoreline: Waves,
  "Spatial Support": Waypoints,
  Substrate: Rock,
  Terrain: Mountain,
  Temperature: Thermometer,
  Discharge: Waves,
  "Flow indicators": Gauge,
  "River influence": Waves,
  "Water temperature": Thermometer,
  Wind: Wind,
  Humidity: Droplets,
  "Cloud cover": Cloud,
  Pressure: Gauge,
  Precipitation: CloudRain,
  "Coast Guard Sectors": ShieldCheck,
  "Conservation Designations": Leaf,
  "Marine Conservation Areas": Leaf,
  "Proposed / Interim Conservation References": Leaf,
  "County Regional Boundaries": MapPin,
  "Critical Habitat": Fish,
  "Exclusion Zones": ShieldCheck,
  "Federal Waters": Landmark,
  "International Boundaries": Compass,
  [managementAreasFamily]: Landmark,
  "Marine Protected Areas": ShieldCheck,
  "National Marine Sanctuaries": Fish,
  Ports: Anchor,
  "Shipping Lanes": Ship,
  "Vessel Routing & Regulations": Ship,
  "Speed Restriction Zones": Gauge,
  "State Provincial Waters": Landmark,
  "Traffic Separation Schemes": Ship,
  "Tribal First Nations Areas": Users,
  "Wildlife Refuges": Leaf,
};
const familyIconFor = (family: string) => familyIcons[family] ?? Layers3;
const familyName = (family: string) => family === "PREFERRED" ? "Preferred sources" : family;

function startingFeature(fields: SeascapeFeature[]) {
  return fields.find(field => field.column === waterAssignmentColumn("federal_waters"))
    ?? fields.find(field => field.available > 0 && field.geometryGroup && field.geometryGroup !== "access_lines")
    ?? fields.find(field => field.available > 0 && field.geometryGroup)
    ?? fields.find(field => field.available > 0 && field.measurement?.quantity === "depth")
    ?? fields.find(field => field.available > 0 && field.kind !== "categorical" && field.range[0] !== field.range[1] && !/quality|context|processing/.test(field.role) && !/status|qualification/i.test(field.name))
    ?? fields.find(field => field.available > 0 && field.kind !== "categorical" && !/quality|context/.test(field.role))
    ?? fields.find(field => field.available > 0)
    ?? fields[0];
}

export default function FamilyFeaturePicker({ label, familyLabel = "Family", catalog, resolution, dataset, value, onChange, showFeature = true }: {
  label: string;
  showFeature?: boolean;
  familyLabel?: string;
  catalog: SeascapeCatalog;
  resolution: NativeResolution;
  dataset: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const fields = catalog.features.filter(field => field.resolution === resolution && (field.dataset ?? "seascape") === dataset);
  // Derive family from the active native field so product/resolution changes cannot leave it stale.
  const activeFeature = fields.find(field => field.id === value);
  const family = activeFeature?.family ?? fields[0]?.family ?? "";
  const families = [...new Set(fields.map(field => field.family))].sort((a, b) => familyName(a).localeCompare(familyName(b)));
  const refuge = dataset === "governance" && family === "Wildlife Refuges";
  const conservation = dataset === "governance" && ["Marine Conservation Areas", "Proposed / Interim Conservation References"].includes(family);
  const tribal = dataset === "governance" && family === "Tribal First Nations Areas";
  const federal = dataset === "governance" && family === "Federal Waters";
  const administrative = dataset === "governance" && family === administrativeBoundariesFamily;
  const management = dataset === "governance" && family === managementAreasFamily;
  const choices = fields.filter(field => field.family === family);
  if (federal) choices.sort((a, b) => Number(a.column === internationalBoundaryColumn) - Number(b.column === internationalBoundaryColumn));
  if (tribal) choices.sort((a, b) => Number(Boolean(a.membershipColumn)) - Number(Boolean(b.membershipColumn)));
  if (refuge) {
    const order = ["Wildlife Refuge Count", "Wildlife Refuge Assignment", "Wildlife Refuge Coverage"];
    choices.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }
  return <>
    <SourcePicker label={familyLabel} value={family} showInformation={false} iconFor={familyIconFor}
      items={families.map(name => ({ id:name, name:familyName(name), group:"Families", summary:"", details:[] }))}
      onChange={nextFamily => {
        if (nextFamily === family) return;
        const next = startingFeature(fields.filter(field => field.family === nextFamily));
        if (next) onChange(next.id);
      }} />
    {showFeature && <SourcePicker label={label} value={value} copyable compactCopyFeedback={dataset === "governance"} showInformation={!refuge && !conservation} preserveOrder={refuge || tribal || federal || conservation}
      items={choices.map(field => ({ ...featurePickerItem(field, catalog), ...(refuge || tribal || federal || administrative || management || conservation ? { group: "Features" } : {}) }))}
      onChange={onChange} />}
  </>;
}
