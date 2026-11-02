import { describe, expect, it } from 'vitest';
import { horizontal, julianDate, precess, siderealDegrees, skyLocation } from './northernSky';

describe('live northern sky coordinate transforms', () => {
  const epoch = new Date('2000-01-01T12:00:00Z');
  it('uses the J2000 Julian date and Greenwich sidereal reference', () => {
    expect(julianDate(epoch)).toBe(2451545);
    expect(siderealDegrees(epoch)).toBeCloseTo(280.46061837, 7);
    const [ra,dec] = precess(165.93,61.75,epoch);
    expect(ra).toBeCloseTo(165.93,8);
    expect(dec).toBeCloseTo(61.75,8);
  });
  it('places the north celestial pole at observer latitude', () => {
    const pole = horizontal(0,90,epoch);
    expect(pole.altitude).toBeCloseTo(skyLocation.latitude,8);
    expect(Math.min(pole.azimuth,360-pole.azimuth)).toBeLessThan(0.00001);
  });
  it('places equatorial stars east at rising and south on the meridian', () => {
    const lst = siderealDegrees(epoch)+skyLocation.longitude;
    const rising=horizontal(lst+90,0,epoch);
    expect(rising.altitude).toBeCloseTo(0,8);
    expect(rising.azimuth).toBeCloseTo(90,8);
    const transit=horizontal(lst,0,epoch);
    expect(transit.altitude).toBeCloseTo(90-skyLocation.latitude,8);
    expect(transit.azimuth).toBeCloseTo(180,8);
  });
});
