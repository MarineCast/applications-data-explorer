export interface MapCoordinates {
  lat: number;
  lon: number;
  left: number;
  top: number;
}

export function coordinateText(lat: number, lon: number) {
  // The basemap can show repeated world copies; copy conventional WGS84
  // longitude and latitude-first order, rather than a viewport world offset.
  const longitude = ((lon + 180) % 360 + 360) % 360 - 180;
  const fixed = (value: number) => (Math.abs(value) < .0000005 ? 0 : value).toFixed(6);
  return `${fixed(lat)}, ${fixed(longitude)}`;
}

export function coordinatePopupPosition(x: number, y: number, width: number, height: number) {
  return {
    left: Math.max(8, Math.min(x + 12, width - 232 - 8)),
    top: Math.max(8, Math.min(y + 12, height - 172 - 8)),
  };
}
