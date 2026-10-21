import { describe, expect, it, vi } from 'vitest';
import { applyBasemapTheme } from './basemapTheme';
import type { StyleSpecification } from 'maplibre-gl';

describe('basemap theme', () => {
  it('recolors provider geography reversibly without changing data ramps', () => {
    const map = { setPaintProperty: vi.fn() };
    const layers: StyleSpecification['layers'] = [
      { id:'land',type:'background' }, { id:'water',type:'fill',source:'provider' },
      { id:'forest',type:'fill',source:'provider' }, { id:'place-label',type:'symbol',source:'provider' },
    ];
    applyBasemapTheme(map,layers,'dark');
    expect(map.setPaintProperty).toHaveBeenCalledWith('water','fill-color','#112C3D');
    expect(map.setPaintProperty).toHaveBeenCalledWith('place-label','text-color','#B8CDD4');
    expect(map.setPaintProperty.mock.calls.some(([id])=>/h3|viewshed/.test(id))).toBe(false);
    applyBasemapTheme(map,layers,'light');
    expect(map.setPaintProperty).toHaveBeenLastCalledWith('place-label','text-halo-color','#E9EBE4');
    expect(map.setPaintProperty).toHaveBeenCalledWith('water','fill-color','#DCE9EA');
  });
});
