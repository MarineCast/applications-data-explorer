import { cellToLatLng, getResolution, isValidCell } from "h3-js";
import type { Cell } from "./demo";
import type { MapLayer } from "./map";
export type NativeResolution = 6 | 8;
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
  categories?: (string | boolean)[];
}
export interface NativeProduct {
  rows: number;
  cells: Asset;
  columns: Record<string, Asset>;
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
          "Local data checksum mismatch. Prepare the source cache again.",
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
      "Local seascape cache is missing. Run the preparation command in the app README.",
    );
  const catalog = (await response.json()) as SeascapeCatalog;
  if (
    ![1, 2].includes(catalog.version) ||
    !catalog.resolutions["6"] ||
    !catalog.resolutions["8"] ||
    !Array.isArray(catalog.features) ||
    !(catalog.receiptStatus.startsWith("published_") ||
      (catalog.version === 2 && catalog.receiptStatus.startsWith("PASS_atomic_immutable_"))) ||
    (catalog.version === 2 && (!catalog.products || !catalog.datasets ||
      catalog.features.some((f) => !f.productId || !catalog.products?.[f.productId] ||
        !f.dataset || !catalog.datasets?.[f.dataset])))
  )
    throw new Error("Unsupported seascape catalog.");
  return catalog;
}
const supports = new Map<string, Promise<Cell[]>>();
async function loadCells(
  product: NativeProduct,
  res: NativeResolution,
): Promise<Cell[]> {
  const key = product.cells.sha256;
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
  const base = field.productId ? catalog.products?.[field.productId] : catalog.resolutions[String(field.resolution)];
  if (!base) throw new Error("Missing native product binding.");
  const product = "slices" in base ? base.slices[selectedSlice ?? base.defaultSlice] : base;
  if (!product) throw new Error("Unavailable source slice.");
  const asset = product.columns[field.column ?? field.id];
  if (!asset) throw new Error("Missing source column binding.");
  const [cells, payload] = await Promise.all([loadCells(product, field.resolution), checkedAsset(asset)]);
  const raw = decodeColumn(payload as Packed, product.rows);
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
  const raw = decoded[column];
  const categorical = field.kind === "categorical";
  const categories = field.categories ?? [];
  if (categorical && raw.some((v) => v !== null && !categories.includes(v as string | boolean)))
    throw new Error("Unregistered source category.");
  if (!categorical && raw.some((v) => v !== null && typeof v !== "number"))
    throw new Error("Non-numeric map metric.");
  const values = new Map(cells.map((c, i) => [c.id,
    raw[i] === null ? null : categorical ? categories.indexOf(raw[i] as string | boolean) : raw[i] as number]));
  const dataset = catalog.datasets?.[field.dataset ?? "seascape"];
  return {
    id: field.id,
    name: field.name,
    unit: field.unit,
    range: field.range,
    resolution: field.resolution,
    cells,
    values,
    sourceLabel: dataset ? `${dataset.name} · ${dataset.status}` : "Local seascape · partial source coverage",
    categories: categorical ? categories.map(String) : undefined,
    rawValues: new Map(cells.map((c, i) => [c.id, raw[i]])),
    slice: "slices" in base ? { axis: base.axis, value: sliceValue!, label: product.label ?? sliceValue! } : undefined,
    field,
    catalog,
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
