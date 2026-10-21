import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FishSymbol, GitCompareArrows, Grid2X2, HelpCircle, Info, Layers3, LoaderCircle, Search, ShieldCheck, SlidersHorizontal, Upload, X } from 'lucide-react';
import DataDomainDock from '../components/DataDomainDock';
import SourcePicker from '../components/SourcePicker';
import RelationshipsPlots from './RelationshipsPlots';
import { associationColor, relationshipName, relationshipRequest } from '../data/relationships';
import type { RelationshipCatalog, RelationshipField, RelationshipPlan, RelationshipQuery, RelationshipResult } from '../data/relationships';
import './RelationshipsPage.css';

const n = (v: number) => v.toLocaleString();
const domains: Record<string, string> = { seascape: 'Seascape', governance: 'Governance', human: 'Human', meteorology: 'Meteorology' };
const units = (f?: RelationshipField) => !f?.unit || /unavailable|source units/i.test(f.unit) ? 'Unit not declared' : f.unit;
const defaultDates = { start: '2025-01-01', end: '2025-12-31' };
function FieldInfo({ field, onClose }: { field: RelationshipField; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="rel-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={`${relationshipName(field)} definition`}>
    <div className="rel-panel-heading"><h2>{relationshipName(field)}</h2><button onClick={onClose} aria-label="Close definition"><X size={20} /></button></div>
    <p>{field.definition || 'No additional definition supplied in the validated source catalog.'}</p>
    <dl><dt>Original field</dt><dd><code>{field.column}</code></dd><dt>Product</dt><dd>{field.productId}</dd><dt>Support</dt><dd>Native H3 R{field.resolution} · {field.temporal}</dd><dt>Units</dt><dd>{units(field)}</dd><dt>Availability</dt><dd>{field.available === null ? field.temporal === 'UTC day' ? 'Depends on selected days' : 'Depends on selected slice' : `${n(field.available)} / ${n(field.rows)} native rows`}</dd><dt>Model eligibility</dt><dd>{field.modelingEligibility || 'Not established'}</dd><dt>Source fingerprint</dt><dd><code>{field.sourceSha256}</code></dd></dl>
    {field.kind === 'membership' && <p>Overlapping identities remain a complete set. Select exact-set encoding to group identical observed sets; unknown/partial membership support remains excluded. An empty observed set describes records, not ecological absence.</p>}
    {field.unsupported && <p role="note">{field.unsupported}</p>}
  </dialog>;
}

export default function RelationshipsPage({ headerHost }: { headerHost?: HTMLElement | null }) {
  const [domain, setDomain] = useState('seascape'), [family, setFamily] = useState(''), [search, setSearch] = useState('');
  const [resolution, setResolution] = useState(6), [catalog, setCatalog] = useState<RelationshipCatalog>(), [catalogError, setCatalogError] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false), [retry, setRetry] = useState(0), [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<RelationshipField[]>([]), [mode, setMode] = useState<RelationshipQuery['mode']>('features');
  const [method, setMethod] = useState<RelationshipQuery['method']>('spearman'), [cohort, setCohort] = useState<RelationshipQuery['cohort']>('pairwise');
  const [plot, setPlot] = useState<RelationshipQuery['plot']>('auto'), [x, setX] = useState(''), [y, setY] = useState('');
  const [start, setStart] = useState(defaultDates.start), [end, setEnd] = useState(defaultDates.end), [slice, setSlice] = useState('');
  const [quality, setQuality] = useState(false), [encoding, setEncoding] = useState<RelationshipQuery['membershipEncoding']>('none');
  const [interval, setInterval] = useState<RelationshipQuery['interval']>('monthly'), [precision, setPrecision] = useState<RelationshipQuery['precision']>('strict');
  const [categories, setCategories] = useState<RelationshipQuery['categories']>(['srkw']);
  const [result, setResult] = useState<RelationshipResult>(), [applied, setApplied] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [view, setView] = useState('matrix'), [threshold, setThreshold] = useState(.8), [drawer, setDrawer] = useState(false), [dock, setDock] = useState(true);
  const [info, setInfo] = useState<RelationshipField>(), [help, setHelp] = useState(false), [stage, setStage] = useState('');
  const initial = useRef(false), activeButton = useRef<HTMLButtonElement>(null), controller = useRef<AbortController | null>(null), choose = useRef<HTMLButtonElement>(null);
  const importedBindings = useRef<Record<string, string> | undefined>(undefined);
  const timed = mode === 'response' || selected.some(f => f.dataset === 'meteorology');
  const slices = useMemo(() => {
    const fields = selected.filter(f => f.slices?.length);
    return fields.length ? fields[0].slices.filter(s => fields.every(f => f.slices.includes(s))) : [];
  }, [selected]);
  const query = useMemo<RelationshipQuery>(() => ({ variables: selected.map(f => f.key), mode, resolution, method, cohort, plot,
    x: selected.some(f => f.key === x) ? x : selected[0]?.key,
    y: selected.some(f => f.key === y) ? y : selected[1]?.key ?? selected[0]?.key,
    start: timed && (mode !== 'response' || interval !== 'all_time') ? start : null, end: timed && (mode !== 'response' || interval !== 'all_time') ? end : null,
    slice: slice || slices[0] || null, includeQuality: quality, membershipEncoding: encoding, threshold, categories, interval, precision,
  }), [selected, mode, resolution, method, cohort, plot, x, y, timed, interval, start, end, slice, slices, quality, encoding, threshold, categories, precision]);
  const stale = !!result && applied !== JSON.stringify(query);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      setCatalogBusy(true); setCatalogError('');
      const params = new URLSearchParams({ domain, resolution: String(resolution), family, search, quality: String(quality), cursor: String(cursor) });
      relationshipRequest<RelationshipCatalog>(`catalog?${params}`, undefined, abort.signal).then(c => {
        if (abort.signal.aborted) return;
        setCatalog(old => cursor && old ? { ...c, fields: [...old.fields, ...c.fields] } : c);
        if (!initial.current && c.defaults?.length) { setSelected(c.defaults); initial.current = true; }
      }).catch(e => { if (!abort.signal.aborted) { setCatalog(undefined); setCatalogError(e.message); } })
        .finally(() => { if (!abort.signal.aborted) setCatalogBusy(false); });
    }, search ? 250 : 0);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [domain, resolution, family, search, quality, cursor, retry]);
  useEffect(() => {
    if (!drawer) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { setDrawer(false); choose.current?.focus(); } };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [drawer]);

  const apply = async (request = query) => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(''); setStage('Validating observation keys and source support…');
    try {
      const plan = await relationshipRequest<RelationshipPlan>('plan', { ...request, bindings: importedBindings.current }, abort.signal);
      setStage('Calculating complete-pair statistics from local data…');
      const answer = await relationshipRequest<RelationshipResult>('analyze', { ...request, bindings: importedBindings.current ?? plan.bindings }, abort.signal);
      if (abort.signal.aborted) return;
      setResult(answer); setApplied(JSON.stringify(request)); importedBindings.current = undefined;
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Analysis failed. Retry the selection.'); }
    finally { if (!abort.signal.aborted) { setBusy(false); setStage(''); } }
  };
  const selectDomain = (next: string) => { setDomain(next); setFamily(''); setSearch(''); setCursor(0); setDock(true); };
  const toggle = (f: RelationshipField) => {
    importedBindings.current = undefined;
    setSelected(old => old.some(v => v.key === f.key) ? old.filter(v => v.key !== f.key) : old.length < 12 ? [...old, f] : old);
  };
  const exportRecipe = () => {
    if (!result || stale) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.recipe, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `marinecast-relationships-${result.queryId}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importRecipe = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 65536) throw new Error('Recipe exceeds 64 KiB.');
      const data = JSON.parse(await file.text()) as RelationshipResult['recipe'];
      if (data.analysisVersion !== 'relationships-1' || !data.bindings) throw new Error('Unsupported recipe version or missing source bindings.');
      const request = { ...data } as Partial<RelationshipResult['recipe']>;
      delete request.analysisVersion; delete request.samplingSeed; delete request.adapterSha256;
      const plan = await relationshipRequest<RelationshipPlan>('plan', request as RelationshipQuery);
      if (JSON.stringify(plan.bindings) !== JSON.stringify(data.bindings)) throw new Error('Recipe sources changed. Recreate the selection with the current catalog.');
      initial.current = true; setSelected(plan.variables); setResolution(data.resolution); setMode(data.mode); setMethod(data.method); setCohort(data.cohort); setPlot(data.plot);
      setX(data.x ?? ''); setY(data.y ?? ''); setStart(data.start ?? defaultDates.start); setEnd(data.end ?? defaultDates.end); setSlice(data.slice ?? '');
      setQuality(data.includeQuality); setEncoding(data.membershipEncoding); setThreshold(data.threshold); setCategories(data.categories); setInterval(data.interval); setPrecision(data.precision);
      importedBindings.current = data.bindings; setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid local recipe.'); }
  };
  const pairClick = (a: string, b: string) => { setX(a); setY(b); setPlot('auto'); if (!stale && !busy) void apply({ ...query, x: a, y: b, plot: 'auto' }); };
  const actions = <div className="rel-header-actions"><span className="rel-breadcrumb">Analysis <span>/</span> <strong>Relationships</strong></span><button disabled={!result || stale || busy} onClick={exportRecipe} title="Export local recipe"><Download size={18} /><span>Export recipe</span></button><button onClick={() => setHelp(true)} aria-label="Relationships help"><HelpCircle size={19} /></button></div>;
  const numerics = result?.variables.filter(f => f.kind === 'numeric') ?? [];
  const byKey = new Map(result?.variables.map(f => [f.key, f]) ?? []);
  const currentX = selected.find(f => f.key === query.x), currentY = mode === 'response' ? { kind: 'numeric' } : selected.find(f => f.key === query.y);
  const pairKinds = [currentX?.kind, currentY?.kind];
  const compatiblePlots = pairKinds.every(k => k === 'numeric') ? ['scatter', 'density'] : pairKinds.includes('numeric') ? ['box', 'strip'] : ['contingency'];
  const available = Object.keys(domains);
  const selectedKeys = new Set(selected.map(f => f.key));
  const grouped = new Map<string, RelationshipField[]>();
  const orderedFields = !search && !family ? [...selected.filter(f => f.dataset === domain && f.resolution === resolution), ...(catalog?.fields ?? []).filter(f => !selectedKeys.has(f.key))] : catalog?.fields ?? [];
  for (const f of orderedFields) { const group = grouped.get(f.family) ?? []; group.push(f); grouped.set(f.family, group); }

  return <main className={`relationships-page ${!dock ? 'rel-dock-hidden' : ''}`}>
    {headerHost ? createPortal(actions, headerHost) : <div className="rel-inline-actions">{actions}</div>}
    {dock && <DataDomainDock active={domain} open available={available} names={domains} onSelect={selectDomain} activeButton={activeButton} onCollapse={() => setDock(false)}>
      <aside id="domain-layer-panel" className={`rel-variables ${drawer ? 'rel-drawer-open' : ''}`} aria-label="Variables">
        <div className="rel-panel-heading"><h2>Variables</h2><span className="rel-tag">{selected.length} selected</span><button className="rel-mobile-close" onClick={() => setDrawer(false)} aria-label="Close variables"><X size={20} /></button></div>
        <label className="rel-field">Toolkit<select value={domain} onChange={e => selectDomain(e.target.value)}>{Object.entries(domains).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <SourcePicker label="Family" value={family} onChange={v => { setFamily(v); setCursor(0); }} showInformation={false} items={['', ...(catalog?.families ?? [])].map(f => ({ id: f, name: f || 'All available families', group: 'Families', summary: '', details: [] }))} />
        <label className="rel-search"><Search size={17} /><input aria-label="Find a variable" placeholder="Find a variable" value={search} onChange={e => { setSearch(e.target.value); setCursor(0); }} /></label>
        <label className="rel-check"><input type="checkbox" checked={quality} onChange={e => { setQuality(e.target.checked); setCursor(0); }} /> Include quality & context fields</label>
        <div className="rel-variable-list" aria-busy={catalogBusy}>
          {catalogBusy && <p role="status"><LoaderCircle className="rel-spin" size={15} /> Validating current source catalog…</p>}
          {catalogError && <div role="alert"><p>{catalogError}</p><button onClick={() => setRetry(v => v + 1)}>Retry catalog</button></div>}
          {catalog?.unavailable && <p role="status">{catalog.unavailable}</p>}
          {!catalogBusy && !catalogError && catalog && !catalog.fields.length && <p role="status">No variables match this toolkit, native resolution and filter.</p>}
          {[...grouped].map(([name, fs]) => <section key={name}><div className="rel-family-heading"><span>{name}</span><small>{fs.every(f => f.temporal === 'Static') ? 'STATIC' : 'SOURCE SLICES'}</small></div>{fs.map(f => <div className={`rel-variable ${selectedKeys.has(f.key) ? 'is-selected' : ''}`} key={f.key}>
            <label><input type="checkbox" checked={selectedKeys.has(f.key)} disabled={!!f.unsupported || !selectedKeys.has(f.key) && selected.length >= 12} onChange={() => toggle(f)} /><span>{relationshipName(f)}<small>{f.kind} · R{f.resolution}{f.quality ? ' · context' : ''}</small><small>{f.available === null ? f.temporal === 'UTC day' ? 'Availability by day' : 'Availability by slice' : `${n(f.available)} / ${n(f.rows)} ${f.temporal === 'Static' ? 'native cells' : 'source slice rows'}`}</small>{f.unsupported && <small>{f.unsupported}</small>}</span></label>
            <button aria-label={`About ${relationshipName(f)}`} onClick={() => setInfo(f)}><Info size={16} /></button>
          </div>)}</section>)}
          {catalog?.next !== null && catalog?.next !== undefined && <button onClick={() => setCursor(catalog.next!)} disabled={catalogBusy}>Load more ({catalog.total} fields)</button>}
        </div>
        <div className="rel-selection"><strong>Selected across families</strong>{selected.map(f => <button key={f.key} onClick={() => toggle(f)} title={`Remove ${relationshipName(f)}`}>{relationshipName(f)} <X size={12} /></button>)}<button onClick={() => setSelected([])} disabled={!selected.length}>Clear selection</button></div>
        <p className="rel-drawer-note">Only comparable measurements enter the matrix. Quality fields and overlapping memberships stay explicit.</p>
        <label className="rel-import"><Upload size={16} /> Import local recipe<input type="file" accept="application/json,.json" aria-label="Import local recipe" onChange={e => { void importRecipe(e.target.files?.[0]); e.target.value = ''; }} /></label>
      </aside>
    </DataDomainDock>}
    {drawer && <button className="rel-drawer-scrim" aria-label="Dismiss variables" onClick={() => setDrawer(false)} />}
    <div className="rel-workspace">
      <div className="rel-heading"><div><h1>Relationships</h1><p>Explore shared patterns, with the support in view.</p></div><span className="rel-live-badge">Current local data</span></div>
      <div className="rel-mode-tabs" role="tablist" aria-label="Analysis mode"><button role="tab" aria-selected={mode === 'features'} onClick={() => { setMode('features'); setPlot('auto'); }}><GitCompareArrows size={19} /> Feature relationships</button><button role="tab" aria-selected={mode === 'response'} onClick={() => { setMode('response'); setPlot('auto'); }}><FishSymbol size={19} /> Marine-mammal response</button></div>
      <button ref={choose} className="rel-choose" onClick={() => { setDock(true); setDrawer(v => !v); }} aria-expanded={drawer}><SlidersHorizontal size={18} /> Choose variables ({selected.length})</button>
      {!dock && <button className="rel-show-dock" onClick={() => setDock(true)}>Show variables</button>}
      <section className="rel-card rel-context" aria-label="Observation context">
        <div className="rel-context-grid"><label className="rel-field">Study domain<select disabled><option>Vancouver Island – Columbia</option></select></label>
          <label className="rel-field">Comparable support<select value={resolution} onChange={e => { setResolution(Number(e.target.value)); setCursor(0); setSelected([]); initial.current = false; setSlice(''); }}><option value={6}>Native H3 R6</option><option value={8}>Native H3 R8</option><option value={7}>Native H3 R7 · Human</option><option value={5}>Native H3 R5 · Weather</option></select></label>
          {slices.length ? <label className="rel-field">Recorded survey slice<select value={slice || slices[0]} onChange={e => setSlice(e.target.value)}>{slices.map(s => <option key={s}>{s}</option>)}</select></label> : <label className="rel-field">Date window<select disabled><option>{timed ? 'Set UTC bounds below' : 'Not applicable · static features'}</option></select></label>}
          <label className="rel-field">Observation unit<select disabled><option>{mode === 'response' ? 'One row per reported cell' : selected.some(f => f.dataset === 'meteorology') ? 'Cell × UTC day' : 'One row per cell'}</option></select></label>
        </div>
        {timed && <div className="rel-time-settings"><label className="rel-field">Start (inclusive UTC)<input type="date" value={start} disabled={mode === 'response' && interval === 'all_time'} onChange={e => setStart(e.target.value)} /></label><label className="rel-field">End (inclusive UTC)<input type="date" value={end} disabled={mode === 'response' && interval === 'all_time'} onChange={e => setEnd(e.target.value)} /></label>{mode === 'features' && <p>Weather: 1–32 days, native R5 cell-days. Partial metric-days excluded; no upscaling.</p>}</div>}
        {mode === 'response' && <div className="rel-response-settings">
          <div className="rel-response-types"><strong>Recorded Orca types</strong>{(['srkw', 'transient', 'other'] as const).map(c => <label key={c} className="rel-check"><input type="checkbox" checked={categories.includes(c)} onChange={() => setCategories(old => old.includes(c) ? old.filter(v => v !== c) : [...old, c])} />{c === 'srkw' ? 'SRKW' : c === 'transient' ? 'Transient' : 'Other'}</label>)}<small>Other includes NRKW, offshore, mixed and unknown. Other species have no validated adapter.</small></div>
          <label className="rel-field">Positive recorded bins<select value={interval} onChange={e => setInterval(e.target.value as RelationshipQuery['interval'])}>{['daily', 'weekly', 'monthly', 'yearly', 'all_time'].map(v => <option value={v} key={v}>{v === 'all_time' ? 'All time · includes undated' : v.charAt(0).toUpperCase() + v.slice(1) + ' UTC'}</option>)}</select></label>
          <label className="rel-field">Spatial precision<select value={precision} onChange={e => setPrecision(e.target.value as RelationshipQuery['precision'])}><option value="strict">Cell confinement established only</option><option value="reported">Reported assignment · accuracy qualified</option></select></label>
          <p className="rel-response-note">Recorded source records describe reporting, not abundance or validated absences. Positive bins are summed once per R6 cell; unsurveyed cells stay unlabelled. Current source positions are assignment-only; strict confinement may yield no pairs.</p>
        </div>}
        <div className="rel-context-footer"><span><ShieldCheck size={15} />{mode === 'response' ? 'Static predictor × recorded count · one row per reported cell over the window' : selected.some(f => f.dataset === 'meteorology') ? 'Native R5 × UTC day · no weather detail added by H3' : 'Static or one recorded survey slice · one value per native cell · no repeated daily joins'}</span><button className="rel-apply" disabled={busy || !selected.length || mode === 'response' && !categories.length} onClick={() => void apply()}>Apply selection</button></div>
      </section>
      <div className="rel-analysis-toolbar"><div><button aria-pressed={view === 'matrix'} onClick={() => setView('matrix')}><Grid2X2 size={18} /> Matrix & pair</button><button aria-pressed={view === 'families'} onClick={() => setView('families')}><Layers3 size={18} /> Family redundancy</button></div><div className="rel-toolbar-settings"><label className="rel-field rel-cohort">Analysis cohort<select value={cohort} onChange={e => setCohort(e.target.value as RelationshipQuery['cohort'])}><option value="pairwise">Pairwise complete rows</option><option value="complete">Common complete-case cohort</option></select></label><label>Association<select aria-label="Association" value={method} onChange={e => setMethod(e.target.value as RelationshipQuery['method'])}><option value="spearman">Spearman ρ</option><option value="pearson">Pearson r</option></select></label></div></div>
      <div className="rel-status" aria-live="polite">{busy && <span role="status"><LoaderCircle size={16} className="rel-spin" />{stage}<button onClick={() => { controller.current?.abort(); setBusy(false); setStage(''); }}>Cancel analysis</button></span>}{stale && <span className="rel-stale">Selection changed · apply to update results. Displayed results retain their original context.</span>}</div>
      {error && <div className="rel-card rel-error" role="alert"><strong>Comparison unavailable</strong><p>{error}</p><button disabled={busy || !selected.length} onClick={() => void apply()}>Retry selection</button></div>}
      {!result && !busy && !error && <div className="rel-card rel-empty" role="status"><GitCompareArrows size={28} /><h2>Choose variables, then apply</h2><p>Statistics will be calculated from current local products. No illustrative values are shown.</p><p>Select up to 12 variables. Native resolutions, source nulls and temporal support are checked before comparison.</p></div>}
      {result && <>
        <p className="rel-result-context">{result.grain} · {result.cohort.policy === 'pairwise' ? 'Pairwise complete: each coefficient may use different rows' : `Common complete cohort: ${n(result.cohort.commonCompleteRows)} / ${n(result.cohort.unionRows)} rows`}{stale && ' · previous selection'}</p>
        <div className="rel-analysis-grid" aria-busy={busy}>
          <section className="rel-card rel-matrix-panel"><div className="rel-panel-heading"><h2>{view === 'matrix' ? 'Feature correlation' : 'Family redundancy'}</h2><span className="rel-tag">{numerics.length} numeric variables</span></div>
            {view === 'matrix' ? <><p>Grouped by family · select a pair to inspect</p><div className="rel-matrix-scroll"><div className="rel-matrix" style={{ gridTemplateColumns: `100px repeat(${Math.max(1, numerics.length)}, minmax(54px,1fr))` }}><span />{numerics.map(f => <span className="rel-matrix-label" key={f.key} title={f.column}>{relationshipName(f)}</span>)}{numerics.map(a => <div className="rel-matrix-row" key={a.key}><span className="rel-matrix-label">{relationshipName(a)}</span>{numerics.map(b => { const m = result.matrix.find(v => v.x === a.key && v.y === b.key); return <button key={b.key} className={result.pair.x === a.key && result.pair.y === b.key ? 'rel-active-pair' : ''} style={{ background: associationColor(m?.value ?? null), color: m?.value !== null && Math.abs(m?.value ?? 0) > .75 ? '#fff' : '#143454' }} onClick={() => pairClick(a.key, b.key)} disabled={busy || stale} aria-label={`Compare ${relationshipName(a)} with ${relationshipName(b)}`} title={`${m?.value?.toFixed(3) ?? m?.reason ?? 'Undefined'} · n ${m?.complete ?? 0} / ${m?.eligible ?? 0} · excluded ${m?.excluded ?? 0}`}>
              {m?.value?.toFixed(2) ?? '—'}</button>; })}</div>)}</div></div>{numerics.length < 2 && <p>Select at least two numeric variables for a matrix. Categorical pairs remain available in the pair inspector.</p>}<div className="rel-matrix-key"><span>−1</span>{[-1, -.5, 0, .5, 1].map(v => <i key={v} style={{ background: associationColor(v) }} />)}<span>+1</span><small>Signed association</small></div></> : <><label className="rel-field">Exploratory threshold |coefficient| ≥<input type="number" min={0} max={1} step={.05} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label><p>Pairwise screening; no variable is automatically removed. Threshold changes require Apply.</p>{result.families.map(f => <div className="rel-family-summary" key={f.name}><strong>{f.name}</strong><p>{f.aboveThreshold} / {f.testedPairs} tested pairs ≥ {f.threshold} · {f.eligiblePairs} eligible</p>{f.strongest.map(m => <button key={m.x + m.y} onClick={() => pairClick(m.x, m.y)} disabled={stale || busy}>{relationshipName(byKey.get(m.x))} × {relationshipName(byKey.get(m.y))}<strong>{m.value?.toFixed(2)}</strong><small>n {n(m.complete)} / {n(m.eligible)}</small></button>)}</div>)}</>}
            <div className="rel-composition"><strong>Composition deserves a closer look</strong><p>Sand, mud and gravel share a total. A strong correlation can reflect that constraint; it is not evidence that one drives another.</p></div>

          </section>
          <section className="rel-card rel-pair-panel"><div className="rel-panel-heading"><h2>{relationshipName(byKey.get(result.pair.x))} × {relationshipName(byKey.get(result.pair.y))}</h2><span className="rel-tag">{result.pair.plot}</span></div>
            <div className="rel-pair-fields"><label className="rel-field">X variable<select value={query.x} onChange={e => { setX(e.target.value); setPlot('auto'); }}>{selected.map(f => <option key={f.key} value={f.key}>{relationshipName(f)}</option>)}</select></label><label className="rel-field">Y variable<select value={mode === 'response' ? 'response' : query.y} disabled={mode === 'response'} onChange={e => { setY(e.target.value); setPlot('auto'); }}>{mode === 'response' ? <option value="response">Recorded Orca sighting count</option> : selected.map(f => <option key={f.key} value={f.key}>{relationshipName(f)}</option>)}</select></label></div>
            <div className="rel-plot-control"><label>Plot<select value={plot} onChange={e => setPlot(e.target.value as RelationshipQuery['plot'])}><option value="auto">Auto</option>{compatiblePlots.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}</select></label><small>Overrides validated against variable types</small></div>
            <RelationshipsPlots result={result} />
            <dl className="rel-stat-row"><div><dt>{result.pair.statistics ? result.recipe.method === 'spearman' ? 'Spearman ρ' : 'Pearson r' : 'Descriptive groups'}</dt><dd>{result.pair.statistics?.value?.toFixed(2) ?? '—'}</dd><small>{result.pair.statistics?.reason ?? 'Descriptive only'}</small></div><div><dt>Complete pairs</dt><dd>{n(result.pair.diagnostics.complete)}</dd><small>{result.grain.includes('UTC day') ? 'Cell-days; repeated cells' : 'Distinct native cells'}</small></div><div><dt>Paired coverage</dt><dd>{(100 * result.pair.diagnostics.coverage).toFixed(1)}%</dd><small>{n(result.pair.diagnostics.complete)} / {n(result.pair.diagnostics.eligible)} eligible</small></div></dl>
            <p className="rel-plot-note">{result.pair.plot === 'scatter' ? `${n(result.sampling.plotted)} displayed points; deterministic seed ${result.sampling.seed}. ` : ''}{result.sampling.statistics}</p>
          </section>
        </div>
        {result.response && <section className="rel-card rel-response-summary"><h2>Recorded response support</h2><p>{result.response.policy}</p><p>{n(result.response.eligibleRecords)} eligible records · {n(result.response.positiveBins)} positive bins · {n(result.response.distinctCells)} cells · {n(result.response.distinctPeriods)} periods</p><p>{result.response.coverage}</p></section>}
        <details className="rel-card rel-quality"><summary><ShieldCheck size={18} /> Pair quality & join details<span className="rel-tag">{n(result.pair.diagnostics.excluded)} excluded</span></summary><div><p>{result.grain}</p><dl className="rel-quality-counts">{Object.entries(result.pair.diagnostics).filter(([,v]) => typeof v === 'number').map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{typeof v === 'number' ? k === 'coverage' ? `${(v*100).toFixed(1)}%` : n(v) : String(v)}</dd></div>)}</dl><p>{result.pair.diagnostics.exclusionNote}</p><p>Common cohort: {n(result.cohort.commonCompleteRows)} complete / {n(result.cohort.unionRows)} union rows; {n(result.cohort.commonExcluded)} excluded. Source quality fields are retained below; partial qualifications are not silently presented as full support.</p>{Object.entries(result.quality).map(([key,q]) => <details key={key}><summary>{relationshipName(byKey.get(key))} · source & exclusions</summary><pre>{JSON.stringify(q, null, 2)}</pre></details>)}<details><summary>Source generations & normalized recipe</summary><pre>{JSON.stringify(result.recipe, null, 2)}</pre></details></div></details>
      </>}
      <details className="rel-card rel-compatibility"><summary>Support rules & unavailable combinations</summary><p>Selections must share native H3 support. Static and one recorded survey slice use one row per cell. Native weather compares only with R5 weather over the same UTC days. Circular directions, per-river joins, finer-grid weather, broader species responses and species-informed response predictors are unavailable.</p><p>Memberships need explicit encoding. Categories remain labels, with box/strip or contingency summaries.</p><label className="rel-field">Membership encoding<select value={encoding} onChange={e => setEncoding(e.target.value as RelationshipQuery['membershipEncoding'])}><option value="none">Not selected · membership comparisons blocked</option><option value="exact_set">Exact observed membership sets as category labels</option></select></label>{Object.entries(catalog?.unavailableProducts ?? {}).map(([k,v]) => <p key={k}><strong>{k}: </strong>{v}</p>)}</details>
      <footer className="rel-footer"><span>Descriptive exploration · spatial and temporal dependence remain</span><span>Source definitions preserved · no causal or predictive claim</span></footer>
    </div>
    {info && <FieldInfo field={info} onClose={() => setInfo(undefined)} />}
    {help && <Help onClose={() => setHelp(false)} />}
  </main>;
}

function Help({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="rel-dialog" onCancel={onClose} aria-label="Relationships help"><div className="rel-panel-heading"><h2>Read relationships with support in view</h2><button aria-label="Close help" onClick={onClose}><X size={20} /></button></div><p>Select up to 12 source variables across toolkits/families at one native resolution. Apply validates support, then computes descriptive statistics locally. Context changes mark results stale.</p><p>Spearman ranks values; Pearson describes linear association. Neither establishes causation, predictive skill, independence or ecological significance. No p-values or model fit is implied.</p><p>Pairwise complete rows may differ across coefficients. The common cohort explicitly removes any row missing a selected value. Nulls are never filled with zero. Quality details retain source status, matched keys, excluded rows and sampling.</p><p>Recorded Orca counts are source records, not whale abundance or validated absences. Default cell-confinement eligibility can produce zero pairs. Reported-cell comparisons require an explicit accuracy-qualified selection and retain its limitations.</p><p>Local recipes contain product identities, hashes, observation rules, encodings, reducer version and sampling seed. They contain no individual sightings and create no hosted link.</p></dialog>;
}
