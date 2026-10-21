export interface RelationshipField {
  key: string; id: string; column: string; productId: string; dataset: string; resolution: number;
  name: string; family: string; unit: string; definition: string; sourceSha256: string;
  modelingEligibility: string; available: number | null; rows: number;
  kind: 'numeric' | 'categorical' | 'membership'; quality: boolean; temporal: string; slices: string[];
  unsupported?: string | null;
}
export interface RelationshipQuery {
  variables: string[]; mode: 'features' | 'response'; resolution: number; method: 'spearman' | 'pearson';
  cohort: 'pairwise' | 'complete'; plot: 'auto' | 'scatter' | 'density' | 'box' | 'strip' | 'contingency';
  x?: string; y?: string; start: string | null; end: string | null; slice: string | null;
  includeQuality: boolean; membershipEncoding: 'none' | 'exact_set'; threshold: number;
  categories: ('srkw' | 'transient' | 'other')[]; interval: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  precision: 'strict' | 'reported'; bindings?: Record<string, string>;
}
export interface RelationshipCatalog {
  fields: RelationshipField[]; families: string[]; defaults?: RelationshipField[]; total: number; next: number | null;
  unavailable?: string; unavailableProducts?: Record<string, string>;
  weatherRange?: { start_date: string; end_date: string; latest_complete_all_metric_day: string } | null;
}
export interface PairCounts {
  eligible: number; matchedKeys: number; complete: number; excluded: number; coverage: number;
  missingLeftKey: number; missingRightKey: number; leftNull: number; rightNull: number; bothNull: number; exclusionNote: string;
}
export interface MatrixEntry extends PairCounts { x: string; y: string; value: number | null; reason: string | null }
export interface GroupSummary { label: string; n: number; min: number; q1: number; median: number; q3: number; max: number; low: number; high: number; points?: number[] }
export interface RelationshipResult {
  version: string; queryId: string; recipe: RelationshipQuery & { analysisVersion: string; samplingSeed: number; adapterSha256: string };
  bindings: Record<string, string>; variables: RelationshipField[]; grain: string;
  quality: Record<string, Record<string, unknown>>;
  cohort: { policy: string; unionRows: number; commonCompleteRows: number; commonExcluded: number };
  matrix: MatrixEntry[];
  pair: { x: string; y: string; diagnostics: PairCounts; plot: string; allowedPlots: string[]; reason: string | null;
    statistics: { value: number | null; method: string; reason: string | null } | null;
    points: { x: number; y: number }[]; ranges?: { x: number[]; y: number[] };
    density: { counts: number[][]; xEdges: number[]; yEdges: number[] } | null;
    groups: GroupSummary[]; numericAxis?: 'x' | 'y'; contingency: { x: string[]; y: string[]; counts: number[][]; n: number } | null;
  };
  families: { name: string; eligiblePairs: number; testedPairs: number; aboveThreshold: number; threshold: number; strongest: MatrixEntry[] }[];
  response: { eligibleRecords: number; selectedCategoryRecords: number; positiveBins: number; distinctCells: number; distinctPeriods: number; policy: string; coverage: string; exclusions: Record<string, number> } | null;
  sampling: { seed: number; plotLimit: number; plotted: number; statistics: string }; warnings: string[];
}
export interface RelationshipPlan { variables: RelationshipField[]; bindings: Record<string, string>; grain: string; estimatedWorkingBytes: number; policy: string }

export async function relationshipRequest<T>(path: string, body?: RelationshipQuery, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/relationships/${path}`, {
    method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(95000)]) : AbortSignal.timeout(95000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || payload === null) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? (payload as { detail: unknown }).detail : null;
    throw new Error(typeof detail === 'string' ? detail : response.status === 422 ? 'The selection is invalid. Check variables and date bounds.' : 'The local analysis service is unavailable. Start the FastAPI backend, then retry.');
  }
  return payload as T;
}

export function relationshipName(f?: RelationshipField) {
  if (f?.column.toUpperCase().endsWith('DISTANCE_TO_ISOBATH_50_M')) return 'Distance to 50 m isobath';
  return f?.name.replace(/^Modeled sediment /, '').replace(/^(Bathymetry )?distance to isobath 50 m$/i, 'Distance to 50 m isobath').replace(/^./, c => c.toUpperCase()) ?? 'Variable';
}
export function associationColor(value: number | null) {
  if (value === null) return '#eef1f2';
  const from = [245, 245, 240], to = value >= 0 ? [31, 122, 157] : [188, 120, 77];
  return `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * Math.abs(value))).join(',')})`;
}
