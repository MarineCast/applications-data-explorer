import { expect, it } from "vitest";
import { managementAreaFeatures, managementAreaCountColumn } from "./managementAreas";
import { featurePickerItem } from "./sourcePicker";
import type { SeascapeCatalog, SeascapeFeature } from "./seascape";

it("keeps count and full membership choices at each native resolution without changing their bindings", () => {
  const membershipColumn = "management_areas__feature_memberships_v1";
  const columns = [managementAreaCountColumn, membershipColumn, managementAreaCountColumn + "_status",
    "management_areas__recorded_polygon_union_area_fraction", "management_areas__source_count",
    "management_areas__subarea__recorded_feature_count", "management_areas__subarea__feature_memberships_v1"];
  const fields = [6, 8].flatMap(resolution => columns.map(column => ({
    id: "GOVERNANCE__" + column, column, resolution, dataset: "governance", family: "Management Areas",
    name: "Original label", unit: "count", qualifiers: [managementAreaCountColumn + "_status"],
    membershipColumn: column.endsWith("feature_memberships_v1") ? column : undefined,
    available: 1, rows: 2, definition: "Retained source definition", productId: "governance-r" + resolution,
  }) as SeascapeFeature));
  const other = { ...fields[0], dataset: "human" };
  const expected = fields.filter(f => [managementAreaCountColumn, membershipColumn].includes(f.column!)).map(f => ({ ...f }));
  const result = managementAreaFeatures([...fields, other]);
  expect(result).toHaveLength(5);
  result.slice(0, 4).forEach((field, index) => {
    const name = field.column === managementAreaCountColumn ? "Management Area Count" : "Management Area";
    expect(field).toEqual({ ...expected[index], name, family: "Fisheries Management Areas", role: field.membershipColumn ? "recorded_feature_identity" : "scientific_metric" });
    expect(featurePickerItem(field, { features: result } as SeascapeCatalog).name).toBe(name);
  });
  expect(result.at(-1)).toBe(other);
});

it("recognizes legacy catalog IDs without an explicit source column", () => {
  const fields = [managementAreaCountColumn, "management_areas__feature_memberships_v1", "management_areas__source_count"]
    .map(column => ({ id: "GOVERNANCE__dynamic__" + column, dataset: "governance" }) as SeascapeFeature);
  expect(managementAreaFeatures(fields).map(f => f.name)).toEqual(["Management Area Count", "Management Area"]);
});
