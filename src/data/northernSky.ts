// Approximate bright-star J2000 catalog positions (degrees; visual magnitude).
// Horizon conversion: https://aa.usno.navy.mil/faq/alt_az
// Mean sidereal time: https://aa.usno.navy.mil/faq/GAST
export const skyLocation = { latitude: 48.55, longitude: -123.08, name: 'San Juan Islands' };
export const skyStars = [
  ['Dubhe',165.93,61.75,1.79], ['Merak',165.46,56.38,2.37],
  ['Phecda',178.46,53.69,2.44], ['Megrez',183.86,57.03,3.31],
  ['Alioth',193.51,55.96,1.77], ['Mizar',200.98,54.93,2.27],
  ['Alkaid',206.89,49.31,1.86], ['Polaris',37.95,89.26,1.98],
  ['Yildun',263.05,86.59,4.35], ['Epsilon UMi',251.49,82.04,4.21],
  ['Zeta UMi',236.01,77.79,4.32], ['Eta UMi',244.38,75.75,4.95],
  ['Pherkad',230.18,71.83,3.05], ['Kochab',222.68,74.16,2.08],
  ['Caph',2.29,59.15,2.27], ['Schedar',10.13,56.54,2.24],
  ['Navi',14.18,60.72,2.15], ['Ruchbah',21.45,60.24,2.68],
  ['Segin',28.60,63.67,3.35],
] as const;
export const skyGroups = [
  { name: 'Big Dipper', paths: [[0,1,2,3,0], [3,4,5,6]] },
  { name: 'Little Dipper', paths: [[7,8,9,10,11,12,13,10]] },
  { name: 'Cassiopeia', paths: [[14,15,16,17,18]] },
];
const rad = Math.PI / 180;
const degrees = (v: number) => v / rad;
const wrap = (v: number) => ((v % 360) + 360) % 360;
export function julianDate(date: Date) { return date.getTime() / 86400000 + 2440587.5; }
export function siderealDegrees(date: Date) {
  const d = julianDate(date) - 2451545;
  const t = d / 36525;
  return wrap(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - t * t * t / 38710000);
}
// IAU 1976 precession from J2000 to the mean equator/equinox of the date.
export function precess(ra: number, dec: number, date: Date) {
  const t = (julianDate(date) - 2451545) / 36525;
  const zeta = (2306.2181*t + 0.30188*t*t + 0.017998*t*t*t) / 3600 * rad;
  const z = (2306.2181*t + 1.09468*t*t + 0.018203*t*t*t) / 3600 * rad;
  const theta = (2004.3109*t - 0.42665*t*t - 0.041833*t*t*t) / 3600 * rad;
  const a = Math.cos(dec*rad) * Math.sin(ra*rad + zeta);
  const b = Math.cos(theta)*Math.cos(dec*rad)*Math.cos(ra*rad+zeta) - Math.sin(theta)*Math.sin(dec*rad);
  const c = Math.sin(theta)*Math.cos(dec*rad)*Math.cos(ra*rad+zeta) + Math.cos(theta)*Math.sin(dec*rad);
  return [wrap(degrees(Math.atan2(a,b)+z)), degrees(Math.asin(Math.max(-1,Math.min(1,c))))];
}
export function horizontal(ra: number, dec: number, date: Date, latitude = skyLocation.latitude, longitude = skyLocation.longitude) {
  const h = (siderealDegrees(date) + longitude - ra) * rad;
  const d = dec * rad, lat = latitude * rad;
  const altitude = degrees(Math.asin(Math.max(-1,Math.min(1, Math.sin(d)*Math.sin(lat)+Math.cos(d)*Math.cos(lat)*Math.cos(h)))));
  const azimuth = wrap(degrees(Math.atan2(-Math.sin(h)*Math.cos(d), Math.sin(d)*Math.cos(lat)-Math.cos(d)*Math.sin(lat)*Math.cos(h))));
  return { altitude, azimuth };
}
export function northernSky(date: Date) {
  return skyStars.map(([name, ra, dec, magnitude]) => {
    const [r,d] = precess(ra,dec,date);
    const position = horizontal(r,d,date);
    const bearing = ((position.azimuth + 180) % 360) - 180;
    return { name, magnitude, ...position, x: 300 + bearing * 2.8, y: 286 - position.altitude * 2.8,
      visible: position.altitude >= 0 && Math.abs(bearing) <= 90 };
  });
}
export function sunAltitude(date: Date) {
  const n = julianDate(date) - 2451545;
  const g = wrap(357.529 + 0.98560028*n)*rad;
  const l = (wrap(280.459 + 0.98564736*n) + 1.915*Math.sin(g)+0.020*Math.sin(2*g))*rad;
  const e = (23.439 - 0.00000036*n)*rad;
  return horizontal(wrap(degrees(Math.atan2(Math.cos(e)*Math.sin(l),Math.cos(l)))),degrees(Math.asin(Math.sin(e)*Math.sin(l))),date).altitude;
}
