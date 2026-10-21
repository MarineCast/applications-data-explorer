import { populationSupport } from "./humanPopulation";
import type { SeascapeCatalog, SeascapeFeature } from "./seascape";

export interface SourcePickerItem {
  id: string;
  name: string;
  group: string;
  summary: string;
  details: { label: string; value: string }[];
  note?: string;
  unavailable?: boolean;
  disabled?: boolean;
  copyText?: string;
  secondary?: string;
}

/** Presentation labels only; original names, IDs and units remain in metadata and exports. */
export function featureDisplayName(field?: SeascapeFeature): string {
  if (!field) return "Choose variable";
  if (field.membershipColumn) return field.name;
  const parts = field.id.split("__");
  if (field.dataset !== "governance" || parts.length !== 4) return field.name;
  const readable = (value: string) => value.replaceAll("_", " ").replace(/^./, char => char.toUpperCase())
    .replace(/\b(ccg|uscg|usfws|noaa|wdfw|bc|epa)\b/gi, word => word.toUpperCase());
  return `${readable(parts[2])} · ${readable(parts[3])}`;
}

export function featurePickerItem(field: SeascapeFeature, catalog: SeascapeCatalog): SourcePickerItem {
  const supplied = field.definition?.trim();
  const hasDefinition = supplied && !supplied.startsWith("Unchanged original source definition;");
  const depth = field.measurement?.quantity === "depth";
  const limitations = catalog.datasets?.[field.dataset ?? "seascape"]?.limitations;
  const context = field.role !== "scientific_metric" && !populationSupport(field) && (/quality|context|processing/.test(field.role) || /(?:\bstatus\b|\bqc\b|qualification|coverage|source_count|processing)/i.test(field.name));
  const duplicate = catalog.features?.some(other => other.id !== field.id && other.resolution === field.resolution && other.dataset === field.dataset && other.family === field.family && other.name === field.name);
  const summary = depth
    ? "Mean water depth for each native map cell. Positive values run downward."
    : hasDefinition ? supplied
    : context ? `Source quality or processing information for ${field.name.toLowerCase()}. These values describe the data, rather than an environmental measurement.`
    : `${field.name} is a ${field.family.toLowerCase()} ${field.kind === "categorical" ? "category" : "measurement"} recorded for each native map cell. No additional field description is supplied in this catalog.`;
  return {
    id: field.id,
    copyText: field.dataset === "human" ? field.column ?? field.name : field.name,
    name: depth ? `${field.name} · mean depth (${field.unit})` : featureDisplayName(field),
    group: field.geometryGroup ? "Source locations and geometry" : field.membershipColumn ? "Recorded feature identities" : context ? "Quality, coverage & processing" : "Measurements",
    secondary: duplicate ? field.id : undefined,
    summary,
    details: [
      { label: "Original name", value: field.name },
      { label: "Source field", value: field.column ?? field.id },
      { label: "Units", value: !field.unit || field.unit === "source units" ? "Not supplied" : field.unit },
      { label: field.geometryGroup ? "Spatial support" : "Native grid", value: field.geometryGroup ? "Original source points / lines / areas" : `H3 R${field.resolution}` },
      { label: "Available values", value: `${field.available.toLocaleString()} of ${field.rows.toLocaleString()} ${field.geometryGroup ? "source records" : field.dataset === "meteorology" ? "daily records" : "cells"}` },
    ],
    note: limitations?.startsWith("Current source snapshots") ? undefined : limitations,
    unavailable: !field.available,
  };
}
