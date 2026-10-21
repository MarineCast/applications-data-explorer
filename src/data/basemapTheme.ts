import type { Map, StyleSpecification } from 'maplibre-gl';
import type { AppTheme } from '../theme/appTheme';
export const basemapPalette = (theme: AppTheme) => theme === 'dark'
  ? { land:'#23383E', forest:'#2B4246', ocean:'#112C3D', coast:'#637F85', snow:'#34474D', label:'#B8CDD4', road:'#52696F' }
  : { land:'#E9EBE4', forest:'#D8DED2', ocean:'#DCE9EA', coast:'#829C98', snow:'#E3E6DD', label:'#456273', road:'#BBC4BE' };

// Only provider basemap layers are passed in; scientific overlay paints stay intact.
export function applyBasemapTheme(map: Pick<Map,'setPaintProperty'>, layers: StyleSpecification['layers'], theme: AppTheme) {
  const c = basemapPalette(theme);
  for (const layer of layers) {
    if (layer.type === 'background') map.setPaintProperty(layer.id,'background-color',c.land);
    if (layer.type === 'fill') {
      if (/water|ocean/i.test(layer.id)) {
        map.setPaintProperty(layer.id,'fill-color',c.ocean);
        map.setPaintProperty(layer.id,'fill-outline-color',c.coast);
      } else if (/glacier|snow|ice/i.test(layer.id)) map.setPaintProperty(layer.id,'fill-color',c.snow);
      else if (/forest|wood/i.test(layer.id)) map.setPaintProperty(layer.id,'fill-color',c.forest);
      else if (/landcover|landuse|park|grass|scrub/i.test(layer.id)) map.setPaintProperty(layer.id,'fill-color',['match',['get','class'],['wood','forest'],c.forest,c.land]);
      else if (/building|residential|land|pedestrian|aeroway/i.test(layer.id)) map.setPaintProperty(layer.id,'fill-color',c.land);
    }
    if (layer.type === 'line' && /coast|water.*(line|outline)|shore/i.test(layer.id)) map.setPaintProperty(layer.id,'line-color',c.coast);
    if (layer.type === 'line' && /road|transportation|bridge|tunnel|path|track|trail|contour|boundary/i.test(layer.id)) map.setPaintProperty(layer.id,'line-color',c.road);
    if (layer.type === 'symbol') {
      map.setPaintProperty(layer.id,'text-color',c.label);
      map.setPaintProperty(layer.id,'text-halo-color',c.land);
    }
  }
}
