import { biogenicHabitatFeatures, anthropogenicPublicValues } from "./biogenicHabitats";
import { kelpFeatures } from "./kelp";
import { seagrassFeatures } from "./seagrass";
import { criticalHabitatFeatures } from "./criticalHabitat";
import { exclusionZoneFeatures } from "./exclusionZones";
import { vesselRoutingFeatures } from "./vesselRouting";
import { humanPortFeatures } from "./humanPorts";
import { isPercentCoverage, marineConservationFeatures } from "./marineConservation";
import { waterAssignmentFeatures, waterAssignmentFamily, waterAssignmentView } from "./waterAssignments";
import { regionalBoundaryFeatures } from "./regionalBoundaries";
import { coastGuardFeatures } from "./coastGuard";
import { administrativeBoundaryFeatures } from "./administrativeBoundaries";
import { managementAreaFeatures } from "./managementAreas";
import { tribalAreaColumn, tribalAssignmentColumn, tribalAreaFeatures } from "./tribalAreas";
import { wildlifeRefugeFeatures } from "./wildlifeRefuges";
import { decodeHumanGeometry } from "./humanGeometry";
import type { HumanGeometryData } from "./humanGeometry";
import type { RiverInfluenceData, InfluenceFrame } from "./riverInfluence";
import type { HydrologyData } from "./hydrology";
import type { OrcaData } from "./orca";
import { decodeGovernanceMemberships, governanceIdentityView } from "./governanceMemberships";
import type { GovernanceMembershipData, MembershipBinding } from "./governanceMemberships";
import { cellToLatLng, getResolution, isValidCell } from "h3-js";
import type { Cell } from "./demo";
import type { MapLayer } from "./map";
import type { MeteorologyCatalog } from "./meteorology";
export type NativeResolution = 5 | 6 | 7 | 8;
export interface Asset {
  url: string;
  sha256: string;
}
export interface SeascapeFeature {
  id: string;
  resolution: NativeResolution;
  name: string;
  family: string;
  unit: string;
  range: [number, number];
  available: number;
  rows: number;
  role: string;
  qualifiers: string[];
  sourceRelease: string;
  sourcePath: string;
  sourceSha256: string;
  definition: string;
  modelingEligibility: string;
  aliasOf?: string;
  arrowType: string;
  column?: string;
  productId?: string;
  dataset?: string;
  kind?: "numeric" | "categorical";
  circular?: boolean;
  categories?: (string | boolean)[];
  membershipColumn?: string;
  supportLimitation?: string;
  supportMembershipColumn?: string;
  assignmentSemantics?: "geographic" | "conservation_status";
  sourceRecordContext?: Record<string, Record<string, string | null>>;
  sourceContext?: Record<string, {country: string; agency: string; boundary_type: string; classification?: string; scope?: string}>;
  geometryGroup?: string;
  measurement?: { quantity: "depth"; statistic: "mean"; positiveDirection: "down" };
}
export interface NativeProduct {
  nativeFeatures?: Asset;
  nativeGroups?: Record<string, {records:number;context_features:number}>;
  rows: number;
  cells: Asset;
  columns: Record<string, Asset>;
  memberships?: Record<string, MembershipBinding & { asset: Asset }>;
  sourceSha256: string;
  sourcePath: string;
  label?: string;
}
export interface SlicedProduct {
  axis: string;
  defaultSlice: string;
  slices: Record<string, NativeProduct>;
}
export interface SeascapeCatalog {
  meteorology?: MeteorologyCatalog;
  orca?: OrcaData;
  hydrology?: HydrologyData;
  riverInfluence?: RiverInfluenceData;
  version: number;
  release: string;
  artifact: string;
  manifestSha256: string;
  receiptStatus: string;
  publishedAt: string;
  sourceCompleteness: string;
  features: SeascapeFeature[];
  products?: Record<string, NativeProduct | SlicedProduct>;
  datasets?: Record<string, {
    name: string; release: string; status: string; limitations: string;
    manifestSha256?: string; publishedAt?: string; companions?: string[];
  }>;
  unavailableProducts?: { name: string; reason: string }[];
  resolutions: Record<
    string,
    {
      rows: number;
      cells: Asset;
      columns: Record<string, Asset>;
      memberships?: Record<string, MembershipBinding & { asset: Asset }>;
      sourceSha256: string;
      sourcePath: string;
    }
  >;
}
export type SourceValue = string | boolean | number | null;
interface Packed {
  values?: SourceValue[];
  dictionary?: SourceValue[];
  indices?: number[];
}
export interface SeascapeLayer extends MapLayer {
  field: SeascapeFeature;
  catalog: SeascapeCatalog;
  qualifiers: Record<string, SourceValue[]>;
  index: Map<string, number>;
  rawValues?: ReadonlyMap<string, SourceValue>;
  governanceMemberships?: GovernanceMembershipData;
  governanceSourceContext?: SeascapeFeature["sourceContext"];
  humanGeometry?: HumanGeometryData;
  riverInfluence?: InfluenceFrame;
  slice?: { axis: string; value: string; label: string };
}
const assets = new Map<string, Promise<unknown>>();
async function checkedAsset(asset: Asset): Promise<unknown> {
  const key = `${asset.url}:${asset.sha256}`;
  let pending = assets.get(key);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(asset.url);
      if (!response.ok)
        throw new Error(`Cannot read local data (${response.status}).`);
      const bytes = await response.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (v) => v.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== asset.sha256)
        throw new Error(
          "Local data checksum mismatch. Retry the current files.",
        );
      return JSON.parse(new TextDecoder().decode(bytes));
    })();
    assets.set(key, pending);
    pending.catch(() => assets.delete(key));
  }
  return pending;
}
export function decodeColumn(packed: Packed, rows: number): SourceValue[] {
  const values =
    packed.values ??
    packed.indices?.map((i) => {
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        !packed.dictionary ||
        i >= packed.dictionary.length
      )
        throw new Error("Invalid categorical index.");
      return packed.dictionary[i];
    });
  if (
    !values ||
    values.length !== rows ||
    values.some(
      (v) => v === undefined || (v !== null && !["string", "boolean", "number"].includes(typeof v)) || (typeof v === "number" && !Number.isFinite(v)),
    )
  )
    throw new Error("Invalid source column or row count.");
  return values;
}
export async function loadSeascapeCatalog(): Promise<SeascapeCatalog> {
  const response = await fetch("/local-data/seascape/catalog.json", {
    cache: "no-store",
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("json"))
    throw new Error(
      "Current Seascape files could not be read. Check Data/Seascape and retry.",
    );
  const catalog = (await response.json()) as SeascapeCatalog | null;
  // The flat exporter has no publication receipt: this is a current source
  // snapshot, not a promoted release. Recognize its exact v2 contract only.
  const flat = catalog?.version === 2 &&
    catalog.receiptStatus === "current flat data" &&
    catalog.release === "current" && catalog.artifact === "Seascape area Parquets" &&
    catalog.datasets?.seascape?.status === "current area Parquets";
  if (
    !catalog || ![1, 2].includes(catalog.version) ||
    !catalog.resolutions?.["6"] ||
    !catalog.resolutions?.["8"] ||
    !Array.isArray(catalog.features) ||
    !(flat || catalog.receiptStatus?.startsWith("published_") ||
      (catalog.version === 2 && catalog.receiptStatus?.startsWith("PASS_atomic_immutable_"))) ||
    (catalog.version === 2 && (!catalog.products || !catalog.datasets ||
      catalog.features.some((f) => !f.productId || !catalog.products?.[f.productId] ||
        !f.dataset || !catalog.datasets?.[f.dataset])))
  )
    throw new Error("Unsupported seascape catalog.");
  if (catalog.version === 2) {
    for (const field of catalog.features) {
      const base = catalog.products![field.productId!];
      const products = "slices" in base ? Object.values(base.slices ?? {}) : [base];
      if (!(field.dataset === "human" ? [7] : [6, 8]).includes(field.resolution) || !Array.isArray(field.qualifiers) ||
        !products.length || ("slices" in base && !base.slices?.[base.defaultSlice]) ||
        products.some(product => !product || !Number.isInteger(product.rows) || product.rows < 1 ||
          !product.cells?.url || !product.cells?.sha256 || !product.sourceSha256 ||
          (field.geometryGroup ? [] : field.membershipColumn ? [...field.qualifiers] : [field.column ?? field.id, ...field.qualifiers]).some(column =>
            !product.columns?.[column]?.url || !product.columns?.[column]?.sha256)))
        throw new Error(`Invalid native product or column binding for ${field.id}. Check the current source product and retry.`);
      if (field.geometryGroup && (field.dataset !== "human" || field.kind !== "categorical" ||
          products.some(p => !p.nativeFeatures?.url || !p.nativeFeatures.sha256 || p.nativeGroups?.[field.geometryGroup!]?.records !== field.rows)))
        throw new Error(`Invalid Human native geometry binding for ${field.id}.`);
      if (field.membershipColumn && (field.dataset !== "governance" || field.kind !== "categorical" ||
        products.some(product => {
          const binding = product.memberships?.[field.membershipColumn!];
          return !binding || binding.rows !== product.rows || binding.column !== field.membershipColumn ||
            binding.column !== `${binding.group}__feature_memberships_v1` || binding.countColumn !== `${binding.group}__recorded_feature_count` ||
            binding.statusColumn !== `${binding.column}_status` || !binding.asset?.url || !binding.asset?.sha256 ||
            !product.columns[binding.countColumn] || !product.columns[binding.statusColumn] || !product.columns[`${binding.countColumn}_status`];
        }))) throw new Error(`Invalid Governance membership binding for ${field.id}.`);
    }
  }
  for (const field of catalog.features) {
    if (!field.unit || field.unit === "source units") field.unit = "Units unavailable";
  }
  catalog.features = exclusionZoneFeatures(criticalHabitatFeatures(vesselRoutingFeatures(humanPortFeatures(marineConservationFeatures(coastGuardFeatures(managementAreaFeatures(administrativeBoundaryFeatures(regionalBoundaryFeatures(waterAssignmentFeatures(tribalAreaFeatures(wildlifeRefugeFeatures(catalog.features))))))))))));
  catalog.features = kelpFeatures(catalog.features);
  catalog.features = seagrassFeatures(catalog.features);
  catalog.features = biogenicHabitatFeatures(catalog.features);
  return catalog;
}
const supports = new Map<string, Promise<Cell[]>>();
async function loadCells(
  product: NativeProduct,
  res: NativeResolution,
): Promise<Cell[]> {
  const key = `${product.cells.sha256}:${res}:${product.sourceSha256}:${product.rows}`;
  let pending = supports.get(key);
  if (!pending) {
    pending = (async () => {
      const data = (await checkedAsset(product.cells)) as {
        ids: string[];
        resolution: number;
        sourceSha256: string;
      };
      if (
        data.resolution !== res ||
        data.sourceSha256 !== product.sourceSha256 ||
        data.ids.length !== product.rows ||
        new Set(data.ids).size !== data.ids.length
      )
        throw new Error("Invalid native H3 support.");
      return data.ids.map((id) => {
        if (!isValidCell(id) || getResolution(id) !== res)
          throw new Error("Invalid H3 cell/resolution.");
        const [lat, lon] = cellToLatLng(id);
        // Geometry is generated lazily for visible cells, never aggregated.
        return {
          id,
          lat,
          lon,
          boundary: [],
          zone: lat >= 48.5 ? ("north" as const) : ("south" as const),
        };
      });
    })();
    supports.set(key, pending);
    pending.catch(() => supports.delete(key));
  }
  return pending;
}
/** Original source column only, for temporal summaries; same checked native support. */
export async function loadSeascapeValues(catalog: SeascapeCatalog, field: SeascapeFeature, selectedSlice?: string): Promise<ReadonlyMap<string, SourceValue>> {
  if (field.membershipColumn || field.geometryGroup) {
    const layer = await loadSeascapeLayer(catalog, field, selectedSlice);
    return layer.rawValues!;
  }
  const base = field.productId ? catalog.products?.[field.productId] : catalog.resolutions[String(field.resolution)];
  if (!base) throw new Error("Missing native product binding.");
  const product = "slices" in base ? base.slices[selectedSlice ?? base.defaultSlice] : base;
  if (!product) throw new Error("Unavailable source slice.");
  const asset = product.columns[field.column ?? field.id];
  if (!asset) throw new Error("Missing source column binding.");
  const [cells, payload] = await Promise.all([loadCells(product, field.resolution), checkedAsset(asset)]);
  const raw = anthropogenicPublicValues(field, decodeColumn(payload as Packed, product.rows));
  if (field.kind === "categorical" ? raw.some(v => v !== null && !field.categories?.includes(v as string | boolean))
    : raw.some(v => v !== null && typeof v !== "number")) throw new Error("Invalid source metric values.");
  return new Map(cells.map((cell, i) => [cell.id, raw[i]]));
}

export async function loadSeascapeLayer(
  catalog: SeascapeCatalog,
  field: SeascapeFeature,
  selectedSlice?: string,
): Promise<SeascapeLayer> {
  const base: NativeProduct | SlicedProduct | undefined = field.productId ? catalog.products?.[field.productId] : catalog.resolutions[String(field.resolution)];
  if (!base) throw new Error("Missing native product binding.");
  const sliceValue = "slices" in base ? selectedSlice ?? base.defaultSlice : undefined;
  const product = "slices" in base ? base.slices[sliceValue!] : base;
  if (!product) throw new Error("Unavailable source slice.");
  if (field.geometryGroup) {
    if (!product.nativeFeatures || product.nativeGroups?.[field.geometryGroup]?.records !== field.rows) throw new Error("Missing Human native geometry binding.");
    const humanGeometry = decodeHumanGeometry(await checkedAsset(product.nativeFeatures), field.geometryGroup, field.rows);
    return {id:field.id, name:field.name, unit:field.unit, range:field.range, resolution:field.resolution,
      cells:[], values:new Map(), rawValues:new Map(humanGeometry.records.map(f=>[f.properties.record_id,f.properties.category])),
      sourceLabel:"Human · retained partial source inventory",categories:humanGeometry.categories,field,catalog,index:new Map(),qualifiers:{},humanGeometry};
  }
  if (field.membershipColumn) return loadGovernanceIdentity(catalog, field, product,
    "slices" in base ? { axis: base.axis, value: sliceValue!, label: product.label ?? sliceValue! } : undefined);
  const column = field.column ?? field.id;
  const columns = [column, ...field.qualifiers.filter((q) => q !== column)];
  if (columns.some((q) => !product.columns[q])) throw new Error("Missing source column binding.");
  const [cells, payloads] = await Promise.all([
    loadCells(product, field.resolution),
    Promise.all(columns.map((q) => checkedAsset(product.columns[q]))),
  ]);
  const decoded = Object.fromEntries(
    columns.map((q, i) => [
      q,
      decodeColumn(payloads[i] as Packed, product.rows),
    ]),
  );
  const raw = anthropogenicPublicValues(field, decoded[column]);
  const categorical = field.kind === "categorical";
  const categories = field.categories ?? [];
  if (categorical && raw.some((v) => v !== null && !categories.includes(v as string | boolean)))
    throw new Error("Unregistered source category.");
  if (!categorical && raw.some((v) => v !== null && typeof v !== "number"))
    throw new Error("Non-numeric map metric.");
  const percent = isPercentCoverage(field);
  const values = new Map(cells.map((c, i) => [c.id,
    raw[i] === null ? null : categorical ? categories.indexOf(raw[i] as string | boolean) : (raw[i] as number) * (percent ? 100 : 1)]));
  const dataset = catalog.datasets?.[field.dataset ?? "seascape"];
  const assignment = field.dataset === "governance" && column === tribalAreaColumn
    ? catalog.features.find(candidate => candidate.productId === field.productId && candidate.resolution === field.resolution && candidate.column === tribalAssignmentColumn)
    : undefined;
  const supportField = field.supportMembershipColumn
    ? { ...field, column: field.supportMembershipColumn, membershipColumn: field.supportMembershipColumn }
    : assignment;
  const support = supportField ? await loadGovernanceIdentity(catalog, supportField, product) : undefined;
  if (field.supportMembershipColumn && support?.governanceMemberships?.cells.some((row, i) =>
    raw[i] !== (row === null ? null : row.length > 0))) throw new Error("Boundary boolean/membership support mismatch.");
  return {
    id: field.id,
    name: field.name,
    unit: percent ? "%" : field.unit,
    range: percent ? [field.range[0] * 100, field.range[1] * 100] : field.range,
    resolution: field.resolution,
    cells,
    values,
    sourceLabel: dataset ? `${dataset.name} · ${dataset.status}` : "Local seascape · partial source coverage",
    categories: categorical ? categories.map(String) : undefined,
    rawValues: new Map(cells.map((c, i) => [c.id, raw[i]])),
    slice: "slices" in base ? { axis: base.axis, value: sliceValue!, label: product.label ?? sliceValue! } : undefined,
    field,
    governanceSourceContext: assignment?.sourceContext,
    catalog,
    governanceMemberships: support?.governanceMemberships,
    index: new Map(cells.map((c, i) => [c.id, i])),
    qualifiers: Object.fromEntries(
      field.qualifiers.map((q) => [q, decoded[q]]),
    ),
  };
}
export function sourceValue(value: SourceValue | undefined): string {
  if (value === null || value === undefined) return "Unavailable / unknown";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return value;
}

async function loadGovernanceIdentity(catalog: SeascapeCatalog, field: SeascapeFeature, product: NativeProduct, slice?: SeascapeLayer["slice"]): Promise<SeascapeLayer> {
  const binding = product.memberships?.[field.membershipColumn!];
  if (!binding || binding.rows !== product.rows) throw new Error("Missing or misaligned Governance membership binding.");
  const columns = [...new Set([...field.qualifiers, binding.countColumn, binding.statusColumn, `${binding.countColumn}_status`])];
  if (columns.some(column => !product.columns[column])) throw new Error("Missing Governance support binding.");
  const [cells, payload, scalarPayloads] = await Promise.all([
    loadCells(product, field.resolution), checkedAsset(binding.asset),
    Promise.all(columns.map(column => checkedAsset(product.columns[column]))),
  ]);
  const data = decodeGovernanceMemberships(payload, binding);
  const qualifiers = Object.fromEntries(columns.map((column, i) => [column, decodeColumn(scalarPayloads[i] as Packed, product.rows)]));
  if (data.counts.some((count, i) => count !== qualifiers[binding.countColumn][i]) ||
    data.statuses.some((status, i) => status !== qualifiers[binding.statusColumn][i] || status !== qualifiers[`${binding.countColumn}_status`][i]))
    throw new Error("Governance membership/scalar support mismatch.");
  const waterFamily = waterAssignmentFamily(field.column);
  const view = waterFamily ? waterAssignmentView(data, cells.map(cell => cell.id), waterFamily, field.supportLimitation) : governanceIdentityView(data, cells.map(cell => cell.id));
  return { id: field.id, name: field.name, unit: field.unit, range: [0, Math.max(1, view.categories.length - 1)],
    resolution: field.resolution, cells, values: view.values, categories: view.categories, categoryKeys: view.categoryKeys,
    categoryMemberships: view.categoryMemberships, membershipLegend: view.legend,
    rawValues: new Map(cells.map((cell,i) => [cell.id, data.cells[i]?.length === 0 ? "No recorded features · verified empty support" : view.values.get(cell.id) == null ? null : view.categories[view.values.get(cell.id)!]])),
    governanceMemberships: data, field, catalog, qualifiers, index: new Map(cells.map((cell, i) => [cell.id, i])), slice,
    sourceLabel: "Governance · recorded inventory memberships · research only" };
}
