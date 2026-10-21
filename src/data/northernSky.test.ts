import { describe, expect, it } from 'vitest';
import { horizontal, julianDate, northernSky, precess, siderealDegrees, skyLocation, sunAltitude } from './northernSky';

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
  it('changes the Dipper with time while Polaris stays near north', () => {
    const morning=northernSky(new Date('2026-10-17T04:00:00Z'));
    const later=northernSky(new Date('2026-10-17T10:00:00Z'));
    expect(Math.abs(morning[0].altitude-later[0].altitude)).toBeGreaterThan(5);
    for (const sky of [morning,later]) {
      const polaris=sky.find(s=>s.name==='Polaris')!;
      expect(Math.abs(polaris.altitude-skyLocation.latitude)).toBeLessThan(1);
      expect(polaris.visible).toBe(true);
      expect(Math.min(polaris.azimuth,360-polaris.azimuth)).toBeLessThan(2);
    }
  });
  it('distinguishes local summer daytime and night', () => {
    expect(sunAltitude(new Date('2026-06-21T20:00:00Z'))).toBeGreaterThan(60);
    expect(sunAltitude(new Date('2026-06-21T08:00:00Z'))).toBeLessThan(-10);
  });
});
