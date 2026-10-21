import { describe, expect, it } from 'vitest';
import { scenicStarPositions } from './scenicStars';
import catalog from '../data/scenicStarCatalog.json';

describe('catalog-based scenic sky', () => {
  it('projects a broad, bounded field of real stars instead of random points', () => {
    const positions=scenicStarPositions(new Date('2026-10-17T04:00:00Z'));
    expect(catalog).toHaveLength(4105);
    expect(positions.length).toBeGreaterThan(500);
    expect(positions.every(s=>s.x>=0 && s.x<=1 && s.y>=0 && s.y<=0.165)).toBe(true);
    expect(Math.min(...positions.map(s=>s.x))).toBeLessThan(0.05);
    expect(Math.max(...positions.map(s=>s.x))).toBeGreaterThan(0.95);
    expect(positions.every(s=>s.magnitude<=5.8)).toBe(true);
  });
  it('is deterministic for the same time and follows the sky over time', () => {
    const first=new Date('2026-10-17T04:00:00Z');
    expect(scenicStarPositions(first)).toEqual(scenicStarPositions(first));
    expect(scenicStarPositions(first)).not.toEqual(scenicStarPositions(new Date('2026-10-17T10:00:00Z')));
  });
});
