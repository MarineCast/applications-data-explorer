import type { SeascapeFeature } from "./seascape";
import { isWildlifeCoverage } from "./wildlifeRefuges";

export const marineConservationGroup = "marine_conservation_areas";
export const conservationReferenceGroup = "proposed_interim_conservation_references";
export const conservationCount = `${marineConservationGroup}__recorded_feature_count`;
export const conservationAssignment = `${marineConservationGroup}__feature_memberships_v1`;
export const conservationCoverage = `${marineConservationGroup}__recorded_polygon_union_area_fraction`;
export const allConservationAssignment = "marine_conservation_assignment__feature_memberships_v1";
export const conservationReference = `${conservationReferenceGroup}__feature_memberships_v1`;
export const conservationNames: Record<string, string> = {
  [conservationAssignment]: "Marine Conservation Area Assignment",
  [conservationCount]: "Marine Conservation Area Count",
  [conservationCoverage]: "Marine Conservation Area Coverage",
};
const legacy = /^(marine_protected_areas|conservation_designations|wildlife_refuges|national_marine_sanctuaries)__/;
const column = (field: SeascapeFeature) => field.column ?? field.id.replace(/^GOVERNANCE__(?:dynamic__)?/, "");

/** A unified producer is required: never add old counts or coverage in the browser. */
export function marineConservationFeatures(features: SeascapeFeature[]): SeascapeFeature[] {
  const ready = new Set(features.filter(f => f.dataset === "governance" && [conservationAssignment, allConservationAssignment].includes(column(f))).map(f => `${f.resolution}:${f.productId}`));
  const combined = new Set(features.filter(f => f.dataset === "governance" && column(f) === allConservationAssignment).map(f => `${f.resolution}:${f.productId}`));
  return features.filter(field => {
    if (field.dataset !== "governance") return true;
    const key = column(field);
    if (combined.has(`${field.resolution}:${field.productId}`) && (key === conservationAssignment || key.startsWith(conservationReferenceGroup + "__"))) return false;
    if (key.startsWith("marine_conservation_assignment__")) {
      if (key !== allConservationAssignment) return false;
      field.id = field.id.replace(allConservationAssignment, conservationAssignment);
      field.name = conservationNames[conservationAssignment]; field.family = "Marine Conservation Areas";
      field.role = "recorded_feature_identity"; field.assignmentSemantics = "conservation_status";
    }
    if (legacy.test(key) && ready.has(`${field.resolution}:${field.productId}`)) return false;
    if (key.startsWith(marineConservationGroup + "__")) {
      if (!conservationNames[key]) return false;
      field.name = conservationNames[key]; field.family = "Marine Conservation Areas";
      field.role = field.membershipColumn ? "recorded_feature_identity" : "scientific_metric";
    } else if (key.startsWith(conservationReferenceGroup + "__")) {
      if (key !== conservationReference) return false;
      field.name = "Proposed / Interim Conservation Reference Assignment";
      field.family = "Proposed / Interim Conservation References"; field.role = "recorded_feature_identity";
    }
    return true;
  });
}

export function savedConservation(features: SeascapeFeature[], preferred: string): SeascapeFeature | undefined {
  const key = preferred.replace(/^GOVERNANCE__(?:dynamic__)?/, "");
  if (!legacy.test(key) && !key.startsWith(marineConservationGroup + "__") && !key.startsWith(conservationReferenceGroup + "__") && key !== allConservationAssignment) return undefined;
  const assignment = features.find(f => column(f) === allConservationAssignment);
  const referenceTarget = assignment ? allConservationAssignment : conservationReference;
  const target = key.includes("reported_interim_pa") || key.startsWith(conservationReferenceGroup + "__") || key === "marine_protected_areas__recorded_point_feature_count"
    ? referenceTarget : key.endsWith("__feature_memberships_v1") ? assignment ? allConservationAssignment : conservationAssignment
      : key.endsWith("__recorded_polygon_union_area_fraction") ? conservationCoverage : conservationCount;
  return features.find(f => column(f) === target) ?? features.find(f => column(f) === conservationCount);
}

export const isPercentCoverage = (field?: SeascapeFeature) => isWildlifeCoverage(field) || field?.dataset === "governance" && column(field) === conservationCoverage;
