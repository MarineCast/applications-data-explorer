// Equatorial/horizon transforms for Home's scenic star catalog.
// Horizon conversion: https://aa.usno.navy.mil/faq/alt_az
// Mean sidereal time: https://aa.usno.navy.mil/faq/GAST
export const skyLocation = { latitude: 48.55, longitude: -123.08, name: 'San Juan Islands' };
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
