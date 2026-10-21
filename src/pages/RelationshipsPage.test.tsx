import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RelationshipsPage from './RelationshipsPage';
import type { RelationshipField, RelationshipQuery, RelationshipResult } from '../data/relationships';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../data/relationships', async original => ({ ...await original<typeof import('../data/relationships')>(), relationshipRequest: request }));
vi.mock('./RelationshipsPlots', () => ({ default: () => <div role="img" aria-label="Source-backed pair plot" /> }));
const fields: RelationshipField[] = ['Sand fraction', 'Mud fraction'].map((name, i) => ({ key: `seascape:${i}`, id: `${i}`, column: `${i}`, productId: 'source', dataset: 'seascape', resolution: 6, name, family: 'Substrate', unit: 'not declared', definition: 'Current source definition', sourceSha256: 'sha', modelingEligibility: 'research', available: 8, rows: 10, kind: 'numeric', quality: false, temporal: 'Static', slices: [] }));
const counts = { eligible: 10, matchedKeys: 10, complete: 8, excluded: 2, coverage: .8, missingLeftKey: 0, missingRightKey: 0, leftNull: 2, rightNull: 2, bothNull: 2, exclusionNote: 'Counts overlap' };
function result(q: RelationshipQuery): RelationshipResult {
  return { version: 'relationships-1', queryId: 'query', recipe: { ...q, analysisVersion: 'relationships-1', samplingSeed: 19, adapterSha256: 'adapter' }, bindings: { source: 'sha' }, variables: fields, grain: 'One row per native H3 R6 cell · static support', quality: {}, cohort: { policy: 'pairwise', unionRows: 10, commonCompleteRows: 8, commonExcluded: 2 }, matrix: fields.flatMap(a => fields.map(b => ({ x: a.key, y: b.key, value: a.key === b.key ? 1 : -.5, reason: null, ...counts }))), pair: { x: fields[0].key, y: fields[1].key, diagnostics: counts, plot: 'scatter', allowedPlots: ['scatter', 'density'], reason: null, statistics: { value: -.5, method: 'spearman', reason: null }, points: [], density: null, groups: [], contingency: null }, families: [], response: null, sampling: { seed: 19, plotted: 8, plotLimit: 2000, statistics: 'All complete eligible pairs' }, warnings: [] };
}
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path: string, q?: RelationshipQuery) => path.startsWith('catalog') ? { fields, defaults: fields, families: ['Substrate'], total: 2, next: null } : path === 'plan' ? { variables: fields, bindings: { source: 'sha' }, grain: 'Native cells' } : result(q!));
});
describe('Relationships local analysis flow', () => {
  it('starts with a truthful empty state and computes the native selection', async () => {
    const user = userEvent.setup(); render(<RelationshipsPage />);
    expect(screen.getByText('No illustrative values are shown.', { exact: false })).toBeVisible();
    await waitFor(() => expect(screen.getByText('2 selected')).toBeInTheDocument());
    expect(screen.getByLabelText('Date window')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Apply selection' }));
    expect(await screen.findByRole('img', { name: 'Source-backed pair plot' })).toBeVisible();
    const call = request.mock.calls.find(c => c[0] === 'analyze')!;
    expect(call[1].variables).toEqual(fields.map(f => f.key)); expect(call[1].bindings).toEqual({ source: 'sha' });
    expect(screen.getAllByText('80.0%')[0]).toBeVisible();
  });
  it('marks changed context stale and disables exporting previous results', async () => {
    const user = userEvent.setup(); render(<RelationshipsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Apply selection' }));
    await screen.findByRole('img', { name: 'Source-backed pair plot' });
    await user.selectOptions(screen.getByLabelText('Association'), 'pearson');
    expect(screen.getByText(/Selection changed/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export recipe' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Apply selection' }));
    await waitFor(() => expect(screen.queryByText(/Selection changed/)).not.toBeInTheDocument());
  });
  it('keeps source errors retryable without inventing results', async () => {
    const user = userEvent.setup(); request.mockRejectedValueOnce(new Error('Source catalog changed'));
    render(<RelationshipsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Source catalog changed');
    await user.click(screen.getByRole('button', { name: 'Retry catalog' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled());
    request.mockImplementationOnce(async () => { throw new Error('Native resolutions differ'); });
    await user.click(screen.getByRole('button', { name: 'Apply selection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Native resolutions differ');
    expect(screen.queryByRole('img', { name: 'Source-backed pair plot' })).not.toBeInTheDocument();
  });
  it('makes recorded-response precision and positive-bin interpretation explicit', async () => {
    const user = userEvent.setup(); render(<RelationshipsPage />);
    await user.click(screen.getByRole('tab', { name: 'Marine-mammal response' }));
    expect(screen.getByLabelText('Spatial precision')).toHaveValue('strict');
    expect(screen.getByText(/unsurveyed cells stay unlabelled/)).toBeVisible();
    expect(screen.getByLabelText('Positive recorded bins')).toHaveValue('monthly');
    await user.selectOptions(screen.getByLabelText('Spatial precision'), 'reported');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Apply selection' }));
    await waitFor(() => expect(request.mock.calls.some(c => c[0] === 'analyze')).toBe(true));
    const q = request.mock.calls.find(c => c[0] === 'analyze')![1];
    expect(q.mode).toBe('response'); expect(q.precision).toBe('reported'); expect(q.categories).toEqual(['srkw']);
  });
  it('suppresses late results after cancellation', async () => {
    const user = userEvent.setup(); let complete: (v: RelationshipResult) => void = () => {};
    render(<RelationshipsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply selection' })).toBeEnabled());
    request.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Apply selection' }));
    await user.click(screen.getByRole('button', { name: 'Cancel analysis' }));
    complete(result({ variables: fields.map(f => f.key) } as RelationshipQuery));
    await waitFor(() => expect(screen.queryByText(/Calculating complete-pair/)).not.toBeInTheDocument());
    expect(screen.queryByRole('img', { name: 'Source-backed pair plot' })).not.toBeInTheDocument();
  });
});
